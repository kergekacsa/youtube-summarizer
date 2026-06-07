import SwiftUI
import YTSummarizerCore

struct ContentView: View {
    @State private var videoURL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    @State private var entries: [LogEntry] = []
    @State private var testing = false
    @State private var summary: Summary? = nil
    @State private var summaryError: String? = nil
    @State private var isSummarizing = false

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                Text("End-to-end pipeline: WKWebView intercepts timedtext → normalise → Claude → summary")
                    .font(.caption).foregroundStyle(.secondary)
                Text("Set ANTHROPIC_API_KEY in Edit Scheme → Run → Environment Variables")
                    .font(.caption).foregroundStyle(.tertiary)
            }

            HStack {
                TextField("YouTube URL", text: $videoURL)
                    .textFieldStyle(.roundedBorder)
                Button(testing ? "Running…" : "Run") {
                    entries = []
                    summary = nil
                    summaryError = nil
                    testing = true
                }
                .disabled(testing || videoURL.isEmpty)
                Button("Reset") {
                    entries = []
                    summary = nil
                    summaryError = nil
                    isSummarizing = false
                    testing = false
                }
            }

            if testing {
                YouTubeWebView(videoURL: videoURL, onLog: { entries.append($0) }, onTranscript: handleTranscript)
                    .frame(height: 440)
                    .border(Color.secondary.opacity(0.4))
                    .overlay(alignment: .topLeading) {
                        Text("WKWebView").font(.caption2).foregroundStyle(.tertiary).padding(4)
                    }
            }

            // Log
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
            .frame(minHeight: 100, maxHeight: 200)
            .background(Color(nsColor: .controlBackgroundColor))
            .border(Color.secondary.opacity(0.4))

            // Summary
            if isSummarizing {
                GroupBox("Summary") {
                    HStack { ProgressView(); Text("Calling Claude…").padding(.leading, 8) }
                        .padding(4)
                }
            } else if let err = summaryError {
                GroupBox("Summary error") {
                    Text(err).foregroundStyle(.red).font(.caption).padding(4)
                }
            } else if let s = summary {
                GroupBox("Summary — \(s.language.uppercased()) · \(s.sections.count) sections") {
                    ScrollView {
                        LazyVStack(alignment: .leading, spacing: 10) {
                            ForEach(Array(s.sections.enumerated()), id: \.offset) { _, sec in
                                VStack(alignment: .leading, spacing: 3) {
                                    HStack(spacing: 6) {
                                        Text(formatTime(sec.sec))
                                            .font(.caption.weight(.semibold))
                                            .foregroundStyle(.secondary)
                                        Text(sec.title).font(.headline)
                                    }
                                    Text(sec.summary).font(.body)
                                }
                                Divider()
                            }
                        }
                        .padding(6)
                    }
                    .frame(minHeight: 100, maxHeight: 320)
                }
            }
        }
        .padding()
        .frame(minWidth: 760, minHeight: 820)
    }

    // MARK: - Transcript handler

    private func handleTranscript(_ body: String) {
        do {
            let segments = try normalizeJson3(body)
            entries.append(LogEntry(type: .success, message: "Normalised \(segments.count) segments → calling Claude…"))
            isSummarizing = true
            Task {
                do {
                    let result = try await callClaude(transcript: segments)
                    await MainActor.run {
                        summary = result
                        isSummarizing = false
                        entries.append(LogEntry(type: .success, message: "Done — \(result.sections.count) sections (\(result.language))"))
                    }
                } catch {
                    await MainActor.run {
                        summaryError = error.localizedDescription
                        isSummarizing = false
                        entries.append(LogEntry(type: .failure, message: "Claude: \(error.localizedDescription)"))
                    }
                }
            }
        } catch {
            entries.append(LogEntry(type: .failure, message: "Normalise failed: \(error.localizedDescription)"))
        }
    }

    private func formatTime(_ totalSec: Int) -> String {
        let h = totalSec / 3600
        let m = (totalSec % 3600) / 60
        let s = totalSec % 60
        return h > 0 ? String(format: "%d:%02d:%02d", h, m, s) : String(format: "%d:%02d", m, s)
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
