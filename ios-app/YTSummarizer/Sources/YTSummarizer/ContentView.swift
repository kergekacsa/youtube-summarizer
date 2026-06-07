import SwiftUI
import YTSummarizerCore

enum AppState {
    case idle
    case loading(url: String)
    case summarizing
    case done(summary: Summary, videoID: String)
    case error(String)
}

struct ContentView: View {
    @State private var urlText = ""
    @State private var state: AppState = .idle

    var body: some View {
        NavigationStack {
            ZStack {
                // The WKWebView must stay in the view hierarchy while loading so
                // the YouTube player can initialise and issue its CC fetch.
                if case .loading(let url) = state {
                    YouTubeWebView(urlString: url, onResult: handleWebViewResult)
                        .frame(width: 1, height: 1)
                        .opacity(0)
                        .allowsHitTesting(false)
                }

                switch state {
                case .idle:
                    inputView
                case .loading:
                    progressView(message: "Capturing transcript…")
                case .summarizing:
                    progressView(message: "Summarizing with Claude…")
                case .done(let summary, let videoID):
                    SummaryView(summary: summary, videoID: videoID)
                case .error(let message):
                    errorView(message: message)
                }
            }
            .navigationTitle("YT Summarizer")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                if case .done = state {
                    ToolbarItem(placement: .topBarLeading) {
                        Button("New") { state = .idle }
                    }
                }
            }
        }
    }

    // MARK: - Subviews

    private var inputView: some View {
        VStack(spacing: 24) {
            Spacer()
            Image(systemName: "play.rectangle.fill")
                .font(.system(size: 60))
                .foregroundStyle(.red)
            Text("Paste a YouTube URL to get a summary")
                .font(.headline)
                .multilineTextAlignment(.center)
            VStack(spacing: 12) {
                TextField("https://www.youtube.com/watch?v=…", text: $urlText)
                    .textFieldStyle(.roundedBorder)
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(.never)
                    .keyboardType(.URL)
                Button(action: startSummarize) {
                    Label("Summarize", systemImage: "sparkles")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .disabled(urlText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
            .padding(.horizontal)
            Spacer()
        }
    }

    private func progressView(message: String) -> some View {
        VStack(spacing: 16) {
            Spacer()
            ProgressView().scaleEffect(1.5)
            Text(message).font(.subheadline).foregroundStyle(.secondary)
            Spacer()
        }
    }

    private func errorView(message: String) -> some View {
        VStack(spacing: 16) {
            Spacer()
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 48))
                .foregroundStyle(.orange)
            Text(message)
                .multilineTextAlignment(.center)
                .padding(.horizontal)
            Button("Try Again") { state = .idle }
                .buttonStyle(.bordered)
            Spacer()
        }
    }

    // MARK: - Actions

    private func startSummarize() {
        let url = urlText.trimmingCharacters(in: .whitespacesAndNewlines)
        state = .loading(url: url)
    }

    private func handleWebViewResult(_ result: Result<[TranscriptSegment], Error>) {
        switch result {
        case .failure(let error):
            state = .error(error.localizedDescription)
        case .success(let transcript):
            let videoID = extractVideoID(from: urlText) ?? ""
            state = .summarizing
            Task {
                do {
                    let summary = try await callClaude(transcript: transcript)
                    await MainActor.run { state = .done(summary: summary, videoID: videoID) }
                } catch {
                    await MainActor.run { state = .error(error.localizedDescription) }
                }
            }
        }
    }

    private func extractVideoID(from urlString: String) -> String? {
        guard let url = URL(string: urlString),
              let components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
            return nil
        }
        return components.queryItems?.first(where: { $0.name == "v" })?.value
    }
}
