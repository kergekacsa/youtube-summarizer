# Transcript Spike — Approach A

Tests whether `WKUserScript` (injected at `document_start`) can intercept YouTube's
pot-bearing `/api/timedtext` request the same way the Chrome extension's MAIN-world
content script does. This is the gating question for the iOS transcript strategy.

## What it tests

1. Loads a YouTube watch page in a visible `WKWebView`
2. Injects a script at `document_start` that patches `window.fetch` + `XMLHttpRequest`
   (same logic as `chrome-extension/src/content/main-world.ts`)
3. Reads `ytInitialPlayerResponse` for title/videoId confirmation
4. Clicks the CC button at the 3 s mark to make the player issue its own authorized
   (pot-bearing) caption fetch
5. Reports: method used (fetch/XHR), byte count, URL, and a data preview

## Requirements

- macOS 14+ (Sonoma)
- Xcode 15+ installed (provides Swift 5.9 and WebKit headers)

## Run

```bash
cd ios-app/spike
swift run
```

A window opens. Paste any captioned YouTube URL and click **Run Spike**.

## Reading the results

| Log line | Meaning | Next step |
|---|---|---|
| `[OK] [FETCH] N bytes` | Approach A works — WKWebView session carries the player's pot token | Build iOS app on this; proceed to Phase 2 architecture |
| `[OK] [XHR] N bytes` | Same result via XHR path | As above |
| `[FAIL] 0 bytes` | Request intercepted but response is empty — pot token not forwarded to native URLSession | Implement Approach B (`WKWebsiteDataStore.proxyConfigurations`) |
| CC button not found | Player may not have loaded; desktop YouTube player may behave differently in WKWebView | Wait longer or inspect user agent |

## If you get a network / blank page error

WKWebView needs outgoing network access. When running via `swift run` in Terminal the
macOS sandbox is typically not applied. If you open the package in Xcode and run from
there, add the entitlement: Target → Signing & Capabilities → App Sandbox → check
**Outgoing Connections (Client)**.

## Approach B (proxyConfigurations) — if Approach A fails

`WKWebsiteDataStore.proxyConfigurations` (macOS 14 / iOS 17 API) lets you route all
WebView traffic through a local proxy you control. The native proxy receives the full
timedtext request — URL, headers, and response body — including the pot token. This is
more complex to implement but is the fallback if the JS-level interception above can see
the URL but not the response bytes.
