import SwiftUI
import WebKit
import YTSummarizerCore

/// Hidden WKWebView that loads a YouTube page, injects the JS interceptor at
/// document_start, and calls `onResult` when the timedtext response is captured.
///
/// Must remain in the view hierarchy (even with opacity 0) for the YouTube
/// player to initialise and issue its CC fetch.
struct YouTubeWebView: UIViewRepresentable {
    let urlString: String
    let onResult: (Result<[TranscriptSegment], Error>) -> Void

    func makeCoordinator() -> Coordinator { Coordinator(onResult: onResult) }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        // Allow autoplay — WKWebView blocks media by default requiring a user gesture.
        // Without this the YouTube player stays paused and never fetches captions.
        config.mediaTypesRequiringUserActionForPlayback = []
        config.allowsInlineMediaPlayback = true
        let uc = config.userContentController
        uc.add(context.coordinator, name: "transcriptCapture")

        // Injected at document_start — same timing as Chrome's MAIN-world content script.
        let script = WKUserScript(
            source: interceptorJS,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        )
        uc.addUserScript(script)

        let wv = WKWebView(frame: .zero, configuration: config)
        wv.navigationDelegate = context.coordinator
        // Force desktop UA so YouTube serves the standard player with CC button.
        // The mobile site uses a different layout without .ytp-subtitles-button.
        wv.customUserAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
        if let url = URL(string: urlString) {
            wv.load(URLRequest(url: url))
        }
        return wv
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    // MARK: - Coordinator

    final class Coordinator: NSObject, WKScriptMessageHandler, WKNavigationDelegate {
        let onResult: (Result<[TranscriptSegment], Error>) -> Void
        private var didCapture = false

        init(onResult: @escaping (Result<[TranscriptSegment], Error>) -> Void) {
            self.onResult = onResult
        }

        func userContentController(
            _ userContentController: WKUserContentController,
            didReceive message: WKScriptMessage
        ) {
            DispatchQueue.main.async { self.handle(message) }
        }

        private func handle(_ message: WKScriptMessage) {
            guard message.name == "transcriptCapture", !didCapture else { return }
            guard let d = message.body as? [String: Any],
                  let body = d["body"] as? String, !body.isEmpty else { return }
            didCapture = true
            do {
                onResult(.success(try normalizeJson3(body)))
            } catch {
                onResult(.failure(error))
            }
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            if !didCapture { onResult(.failure(error)) }
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            if !didCapture { onResult(.failure(error)) }
        }
    }
}

// MARK: - Interceptor JS
// Mirrors chrome-extension/src/content/main-world.ts.
// Posts full json3 body (not just a preview) so the coordinator can normalise it.
private let interceptorJS = """
(function () {
    'use strict';

    var TIMEDTEXT = '/api/timedtext';
    var didCapture = false;

    function emitCapture(payload) {
        didCapture = true;
        try { window.webkit.messageHandlers.transcriptCapture.postMessage(payload); }
        catch (e) {}
    }

    // --- Patch fetch ---
    var _fetch = window.fetch;
    window.fetch = function patchedFetch(input, init) {
        var url = (typeof input === 'string') ? input
                : (input instanceof URL)      ? input.href
                : (input && input.url != null) ? input.url : '';
        var p = _fetch.apply(this, arguments);
        if (url.includes(TIMEDTEXT)) {
            p.then(function (res) {
                return res.clone().text();
            }).then(function (body) {
                emitCapture({ method: 'fetch', url: url, bytes: body.length, body: body });
            }).catch(function () {});
        }
        return p;
    };

    // --- Patch XHR ---
    var _open = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url) {
        this.__ytsUrl = String(url);
        return _open.apply(this, arguments);
    };

    var _send = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function () {
        var url = this.__ytsUrl || '';
        if (url.includes(TIMEDTEXT)) {
            this.addEventListener('load', function () {
                var text = this.responseText || '';
                emitCapture({ method: 'xhr', url: url, bytes: text.length, body: text });
            });
        }
        return _send.apply(this, arguments);
    };

    // --- Read ytInitialPlayerResponse ---
    function tryPR() {
        var pr = window.ytInitialPlayerResponse;
        if (pr && pr.videoDetails) {
            try {
                window.webkit.messageHandlers.playerResponse.postMessage({
                    found: true,
                    title: pr.videoDetails.title || '',
                    videoId: pr.videoDetails.videoId || ''
                });
            } catch (e) {}
            return true;
        }
        return false;
    }
    if (!tryPR()) {
        var ticks = 0;
        var prTimer = setInterval(function () {
            if (tryPR() || ++ticks > 30) clearInterval(prTimer);
        }, 300);
    }
    document.addEventListener('yt-navigate-finish', tryPR);

    // --- Auto-accept cookie consent (GDPR dialog blocks player load) ---
    function acceptConsent() {
        var btn = document.querySelector('button[aria-label="Accept all"]') ||
                  document.querySelector('button[aria-label="Alle akzeptieren"]') ||
                  document.querySelector('button[aria-label="Alles accepteren"]') ||
                  document.querySelector('.yt-spec-button-shape-next--call-to-action');
        if (btn) { btn.click(); return true; }
        return false;
    }
    if (!acceptConsent()) {
        var consentObserver = new MutationObserver(function () { if (acceptConsent()) consentObserver.disconnect(); });
        consentObserver.observe(document.documentElement, { childList: true, subtree: true });
    }

    // --- Trigger captions: three-stage fallback with retry ---
    // didCapture is set by emitCapture when a real timedtext body arrives —
    // that is the only signal that stops the retry loop.

    // Stage 1: direct .ytp-subtitles-button (disabled during ads — will retry)
    function triggerViaCCButton() {
        var btn = document.querySelector('.ytp-subtitles-button');
        if (btn && btn.getAttribute('aria-disabled') !== 'true') {
            if (btn.getAttribute('aria-pressed') === 'true') {
                btn.click();
                setTimeout(function () { btn.click(); }, 400);
            } else {
                btn.click();
            }
            return true;
        }
        return false;
    }

    // Stage 2: YouTube player JS API — only when tracks are available
    function triggerViaPlayerAPI() {
        var player = document.getElementById('movie_player');
        if (!player || typeof player.getOption !== 'function') return false;
        try {
            var tracks = player.getOption('captions', 'tracklist') || [];
            if (tracks.length > 0) {
                player.setOption('captions', 'track', tracks[0]);
                return true;
            }
        } catch (e) {}
        return false;
    }

    // Stage 3: Settings gear → Subtitles submenu → first real track (skip "Off")
    function triggerViaSettingsMenu() {
        var gear = document.querySelector('.ytp-settings-button');
        if (!gear) return false;
        gear.click();
        setTimeout(function () {
            var items = document.querySelectorAll('.ytp-menuitem');
            var found = false;
            for (var i = 0; i < items.length; i++) {
                var label = items[i].querySelector('.ytp-menuitem-label');
                if (label && /subtitle|caption/i.test(label.textContent)) {
                    items[i].click();
                    found = true;
                    setTimeout(function () {
                        var subItems = document.querySelectorAll('.ytp-menuitem');
                        for (var j = 0; j < subItems.length; j++) {
                            var sub = subItems[j].querySelector('.ytp-menuitem-label');
                            if (sub && sub.textContent.trim() && !/^off$/i.test(sub.textContent.trim())) {
                                subItems[j].click();
                                break;
                            }
                        }
                    }, 600);
                    break;
                }
            }
            if (!found) gear.click();
        }, 600);
        return true;
    }

    // Auto-play: YouTube defers the timedtext fetch until playback starts.
    function tryPlay() {
        var btn = document.querySelector('.ytp-play-button');
        if (btn && btn.getAttribute('aria-label') && /play/i.test(btn.getAttribute('aria-label'))) {
            btn.click();
        }
    }

    function tryTrigger() {
        if (didCapture) return;
        triggerViaCCButton() || triggerViaPlayerAPI() || triggerViaSettingsMenu();
    }

    // Try to start playback so YouTube initialises the caption track
    setTimeout(tryPlay, 1500);

    // React immediately whenever the CC button (re-)appears — covers ad → video transition
    var ccObserver = new MutationObserver(function () {
        if (!didCapture && document.querySelector('.ytp-subtitles-button')) tryTrigger();
    });
    ccObserver.observe(document.documentElement, { childList: true, subtree: true });

    // Retry every 2 s for up to 40 s; only didCapture stops the loop
    var retries = 0;
    var retryTimer = setInterval(function () {
        if (didCapture || ++retries >= 20) { clearInterval(retryTimer); return; }
        tryTrigger();
    }, 2000);

})();
"""
