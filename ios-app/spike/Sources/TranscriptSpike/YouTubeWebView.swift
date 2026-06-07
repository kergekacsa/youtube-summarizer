import SwiftUI
import WebKit

struct YouTubeWebView: NSViewRepresentable {
    let videoURL: String
    let onLog: (LogEntry) -> Void
    var onTranscript: ((String) -> Void)? = nil

    func makeCoordinator() -> Coordinator { Coordinator(onLog: onLog, onTranscript: onTranscript) }

    func makeNSView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        let uc = config.userContentController

        uc.add(context.coordinator, name: "spikeLog")
        uc.add(context.coordinator, name: "playerResponse")
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
        if let url = URL(string: videoURL) {
            wv.load(URLRequest(url: url))
        }
        return wv
    }

    func updateNSView(_ nsView: WKWebView, context: Context) {}

    // MARK: - Coordinator

    final class Coordinator: NSObject, WKScriptMessageHandler, WKNavigationDelegate {
        let onLog: (LogEntry) -> Void
        let onTranscript: ((String) -> Void)?

        init(onLog: @escaping (LogEntry) -> Void, onTranscript: ((String) -> Void)?) {
            self.onLog = onLog
            self.onTranscript = onTranscript
        }

        func userContentController(
            _ userContentController: WKUserContentController,
            didReceive message: WKScriptMessage
        ) {
            DispatchQueue.main.async { self.handle(message) }
        }

        private func handle(_ message: WKScriptMessage) {
            switch message.name {

            case "spikeLog":
                log(.info, message.body as? String ?? "\(message.body)")

            case "playerResponse":
                guard let d = message.body as? [String: Any],
                      d["found"] as? Bool == true else { return }
                let title = d["title"] as? String ?? "?"
                let vid   = d["videoId"] as? String ?? "?"
                log(.success, "ytInitialPlayerResponse — \"\(title)\" (videoId: \(vid))")

            case "transcriptCapture":
                guard let d = message.body as? [String: Any] else { return }
                let method = (d["method"] as? String ?? "?").uppercased()
                let bytes  = d["bytes"]  as? Int    ?? 0
                let url    = d["url"]    as? String ?? ""
                let body   = d["body"]   as? String ?? ""

                if bytes == 0 {
                    log(.failure, "[\(method)] 0 bytes — pot token not forwarded")
                } else {
                    log(.success, "[\(method)] \(bytes) bytes — Approach A ✓")
                    log(.info, "URL: \(url.prefix(120))")
                    onTranscript?(body)
                }

            default:
                break
            }
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            DispatchQueue.main.async {
                self.log(.info, "Page loaded — waiting for player…")
            }
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            DispatchQueue.main.async { self.log(.failure, "Navigation failed: \(error.localizedDescription)") }
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            DispatchQueue.main.async { self.log(.failure, "Provisional navigation failed: \(error.localizedDescription)") }
        }

        private func log(_ kind: LogEntry.Kind, _ msg: String) {
            onLog(LogEntry(type: kind, message: msg))
        }
    }
}

// Mirrors chrome-extension/src/content/main-world.ts
// Posts FULL body (not a preview) so the coordinator can normalise it.
private let interceptorJS = """
(function () {
    'use strict';

    var TIMEDTEXT = '/api/timedtext';
    var didCapture = false;

    function spikeLog(msg) {
        try { window.webkit.messageHandlers.spikeLog.postMessage(String(msg)); }
        catch (e) {}
    }

    function emitCapture(payload) {
        if (didCapture) return;
        didCapture = true;
        try { window.webkit.messageHandlers.transcriptCapture.postMessage(payload); }
        catch (e) { spikeLog('emitCapture error: ' + e); }
    }

    spikeLog('Interceptor installed at document_start');

    // --- Patch fetch ---
    var _fetch = window.fetch;
    window.fetch = function patchedFetch(input, init) {
        var url = (typeof input === 'string') ? input
                : (input instanceof URL)      ? input.href
                : (input && input.url != null) ? input.url : '';
        var p = _fetch.apply(this, arguments);
        if (url.includes(TIMEDTEXT)) {
            spikeLog('fetch intercepted');
            p.then(function (res) {
                return res.clone().text();
            }).then(function (body) {
                emitCapture({ method: 'fetch', url: url, bytes: body.length, body: body });
            }).catch(function (e) {
                spikeLog('fetch clone error: ' + e);
            });
        }
        return p;
    };

    // --- Patch XHR ---
    var _open = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url) {
        this.__spikeUrl = String(url);
        return _open.apply(this, arguments);
    };

    var _send = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function () {
        var url = this.__spikeUrl || '';
        if (url.includes(TIMEDTEXT)) {
            spikeLog('XHR intercepted');
            this.addEventListener('load', function () {
                var text = this.responseText || '';
                emitCapture({ method: 'xhr', url: url, bytes: text.length, body: text });
            });
        }
        return _send.apply(this, arguments);
    };

    spikeLog('fetch and XHR patched');

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

    // --- Trigger CC button ---
    function triggerViaCCButton() {
        var btn = document.querySelector('.ytp-subtitles-button');
        if (btn && btn.getAttribute('aria-disabled') !== 'true') {
            spikeLog('CC button found — aria-pressed=' + btn.getAttribute('aria-pressed'));
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

    function triggerViaPlayerAPI() {
        var player = document.getElementById('movie_player');
        if (!player || typeof player.getOption !== 'function') return false;
        try {
            var tracks = player.getOption('captions', 'tracklist') || [];
            if (tracks.length > 0) {
                player.setOption('captions', 'track', tracks[0]);
                spikeLog('captions set via player API');
                return true;
            }
        } catch (e) {}
        return false;
    }

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

    function tryTrigger() {
        if (didCapture) return;
        triggerViaCCButton() || triggerViaPlayerAPI() || triggerViaSettingsMenu();
    }

    var ccObserver = new MutationObserver(function () {
        if (!didCapture && document.querySelector('.ytp-subtitles-button')) tryTrigger();
    });
    ccObserver.observe(document.documentElement, { childList: true, subtree: true });

    var retries = 0;
    var retryTimer = setInterval(function () {
        if (didCapture || ++retries >= 20) { clearInterval(retryTimer); return; }
        tryTrigger();
    }, 2000);

})();
"""
