import SwiftUI

struct ContentView: View {
    @State private var videoURL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    @State private var entries: [LogEntry] = []
    @State private var testing = false

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                Text("Approach A: WKUserScript patches fetch/XHR at document-start → CC-button trigger → captures timedtext response")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text("Mirrors chrome-extension/src/content/main-world.ts. Run with: cd ios-app/spike && swift run")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }

            HStack {
                TextField("YouTube URL", text: $videoURL)
                    .textFieldStyle(.roundedBorder)
                Button(testing ? "Testing…" : "Run Spike") {
                    entries = []
                    testing = true
                }
                .disabled(testing || videoURL.isEmpty)
                Button("Reset") {
                    entries = []
                    testing = false
                }
            }

            if testing {
                YouTubeWebView(videoURL: videoURL) { entry in
                    entries.append(entry)
                }
                .frame(height: 440)
                .border(Color.secondary.opacity(0.4))
                .overlay(alignment: .topLeading) {
                    Text("WKWebView")
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                        .padding(4)
                }
            }

            ScrollView {
                LazyVStack(alignment: .leading, spacing: 2) {
                    ForEach(entries) { e in
                        HStack(alignment: .top, spacing: 8) {
                            Text(e.badge)
                                .font(.system(.caption, design: .monospaced, weight: .medium))
                                .foregroundStyle(e.color)
                                .frame(width: 62, alignment: .leading)
                            Text(e.message)
                                .font(.system(.caption, design: .monospaced))
                                .textSelection(.enabled)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                }
                .padding(8)
            }
            .frame(minHeight: 150)
            .background(Color(nsColor: .controlBackgroundColor))
            .border(Color.secondary.opacity(0.4))

            // Outcome guide
            GroupBox("Expected outcomes") {
                VStack(alignment: .leading, spacing: 4) {
                    Text("✅ [OK] [FETCH/XHR] N bytes  →  Approach A works; build iOS app on this")
                        .font(.caption).foregroundStyle(.green)
                    Text("❌ [FAIL] 0 bytes  →  pot token not forwarded; proceed to Approach B (proxyConfigurations)")
                        .font(.caption).foregroundStyle(.red)
                    Text("⚠️ CC button not found / no intercept  →  mobile site may not load same player; check UA")
                        .font(.caption).foregroundStyle(.orange)
                }
                .padding(4)
            }
        }
        .padding()
        .frame(minWidth: 760, minHeight: 820)
    }
}

struct LogEntry: Identifiable {
    enum Kind { case info, success, failure, warning }
    let id = UUID()
    let type: Kind
    let message: String

    var badge: String {
        switch type {
        case .info:    return "[info]"
        case .success: return "[OK]"
        case .failure: return "[FAIL]"
        case .warning: return "[warn]"
        }
    }

    var color: Color {
        switch type {
        case .info:    return .secondary
        case .success: return .green
        case .failure: return .red
        case .warning: return .orange
        }
    }
}
