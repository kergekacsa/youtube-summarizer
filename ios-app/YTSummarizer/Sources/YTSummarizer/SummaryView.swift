import SwiftUI
import YTSummarizerCore

struct SummaryView: View {
    let summary: Summary
    let videoID: String

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 16) {
                ForEach(Array(summary.sections.enumerated()), id: \.offset) { _, section in
                    SectionCard(section: section, videoID: videoID)
                }
            }
            .padding()
        }
    }
}

private struct SectionCard: View {
    let section: Section
    let videoID: String

    private var timestampURL: URL? {
        guard !videoID.isEmpty else { return nil }
        return URL(string: "https://www.youtube.com/watch?v=\(videoID)&t=\(section.sec)s")
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                if let url = timestampURL {
                    Link(destination: url) {
                        Label(formatTime(section.sec), systemImage: "play.circle.fill")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.red)
                    }
                } else {
                    Text(formatTime(section.sec))
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                }
                Text(section.title)
                    .font(.headline)
            }
            Text(section.summary)
                .font(.body)
                .foregroundStyle(.secondary)
        }
        .padding()
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 12))
    }

    private func formatTime(_ totalSec: Int) -> String {
        let h = totalSec / 3600
        let m = (totalSec % 3600) / 60
        let s = totalSec % 60
        return h > 0
            ? String(format: "%d:%02d:%02d", h, m, s)
            : String(format: "%d:%02d", m, s)
    }
}
