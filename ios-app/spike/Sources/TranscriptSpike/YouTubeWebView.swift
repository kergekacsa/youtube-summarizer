import SwiftUI
import WebKit

struct YouTubeWebView: NSViewRepresentable {
    let videoURL: String
    let onLog: (LogEntry) -> Void

    func makeCoordinator() -> Coordinator { Coordinator(onLog: onLog) }

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

        init(onLog: @escaping (LogEntry) -> Void) {
            self.onLog = onLog
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
                log(.success, "ytInitialPlayerResponse found — \"\(title)\" (videoId: \(vid))")

            case "transcriptCapture":
                guard let d = message.body as? [String: Any] else { return }
                let method  = (d["method"]  as? String ?? "?").uppercased()
                let bytes   = d["bytes"]    as? Int    ?? 0
                let url     = d["url"]      as? String ?? ""
                let preview = d["preview"]  as? String ?? ""

                if bytes == 0 {
                    log(.failure, "[\(method)] timedtext captured but 0 bytes — pot token NOT forwarded")
                    log(.warning, "Approach A FAILS. Next: implement Approach B (WKWebsiteDataStore.proxyConfigurations)")
                    log(.info, "URL: \(url.prefix(160))")
                } else {
                    log(.success, "[\(method)] \(bytes) bytes received — APPROACH A WORKS ✓")
                    log(.info, "URL: \(url.prefix(160))")
                    log(.info, "Data preview: \(preview.prefix(120))")
                }

            default:
                break
            }
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            DispatchQueue.main.async {
                self.log(.info, "Page loaded — waiting for YouTube player to initialise…")
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
// Patches window.fetch and XMLHttpRequest to intercept /api/timedtext requests,
// reads ytInitialPlayerResponse, and triggers the CC button to make the player
// issue its own authorized (pot-bearing) caption fetch.
private let interceptorJS = """
(function () {
    'use strict';

    var TIMEDTEXT = '/api/timedtext';

    function spikeLog(msg) {
        try { window.webkit.messageHandlers.spikeLog.postMessage(String(msg)); }
        catch (e) {}
    }

    function emitCapture(payload) {
        try { window.webkit.messageHandlers.transcriptCapture.postMessage(payload); }
        catch (e) { spikeLog('emitCapture error: ' + e); }
    }

    spikeLog('Interceptor installed at document_start');

    // --- Patch fetch ---------------------------------------------------------
    var _fetch = window.fetch;
    window.fetch = function patchedFetch(input, init) {
        var url = (typeof input === 'string') ? input
                : (input instanceof URL)      ? input.href
                : (input && input.url != null) ? input.url : '';
        var p = _fetch.apply(this, arguments);
        if (url.includes(TIMEDTEXT)) {
            spikeLog('fetch intercepted — URL length: ' + url.length);
            p.then(function (res) {
                return res.clone().text();
            }).then(function (body) {
                emitCapture({ method: 'fetch', url: url, bytes: body.length, preview: body.slice(0, 400) });
            }).catch(function (e) {
                spikeLog('fetch clone error: ' + e);
            });
        }
        return p;
    };

    // --- Patch XHR -----------------------------------------------------------
    var _open = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url) {
        this.__spikeUrl = String(url);
        return _open.apply(this, arguments);
    };

    var _send = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function (body) {
        var url = this.__spikeUrl || '';
        if (url.includes(TIMEDTEXT)) {
            spikeLog('XHR intercepted — URL length: ' + url.length);
            this.addEventListener('load', function () {
                var text = this.responseText || '';
                emitCapture({ method: 'xhr', url: url, bytes: text.length, preview: text.slice(0, 400) });
            });
        }
        return _send.apply(this, arguments);
    };

    spikeLog('fetch and XHR patched OK');

    // --- Read ytInitialPlayerResponse ----------------------------------------
    function tryPR() {
        var pr = window.ytInitialPlayerResponse;
        if (pr && pr.videoDetails) {
            try {
                window.webkit.messageHandlers.playerResponse.postMessage({
                    found: true,
                    title: pr.videoDetails.title || '',
                    videoId: pr.videoDetails.videoId || ''
                });
            } catch (e) { spikeLog('playerResponse post error: ' + e); }
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

    // --- Trigger CC button (mirrors main-world.ts) ---------------------------
    function ccButton() { return document.querySelector('.ytp-subtitles-button'); }

    function triggerCaptions() {
        var btn = ccButton();
        if (btn && btn.getAttribute('aria-disabled') !== 'true') {
            spikeLog('CC button found — aria-pressed=' + btn.getAttribute('aria-pressed'));
            if (btn.getAttribute('aria-pressed') === 'true') {
                // Already on — toggle off then on to force a fresh fetch
                btn.click();
                setTimeout(function () { btn.click(); }, 400);
            } else {
                btn.click();
            }
            return true;
        }
        spikeLog('CC button not found at trigger time');
        return false;
    }

    setTimeout(function () {
        spikeLog('3 s — attempting CC trigger');
        if (!triggerCaptions()) {
            setTimeout(function () {
                spikeLog('7 s — retry CC trigger');
                triggerCaptions();
            }, 4000);
        }
    }, 3000);

})();
"""
