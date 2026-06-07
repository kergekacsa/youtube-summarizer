import Foundation

/// Normalise a YouTube json3 caption payload into transcript segments.
///
/// Mirrors `normalizeJson3` in `chrome-extension/lib/transcript.ts`.
/// Input is the raw body captured by the JS interceptor via the player's own
/// (pot-bearing) timedtext request — direct fetches return empty without the token.
public func normalizeJson3(_ raw: String) throws -> [TranscriptSegment] {
    let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else {
        throw TranscriptError.emptyResponse
    }

    guard let data = trimmed.data(using: .utf8),
          let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
        throw TranscriptError.invalidJSON
    }

    let events = json["events"] as? [[String: Any]] ?? []
    return events.compactMap { event -> TranscriptSegment? in
        // tStartMs is in milliseconds; floor to whole seconds (matches Math.floor in TS)
        let tStartMs = (event["tStartMs"] as? NSNumber)?.doubleValue ?? 0.0
        let sec = Int(tStartMs / 1000.0)

        let segs = event["segs"] as? [[String: Any]] ?? []
        let text = segs
            .compactMap { $0["utf8"] as? String }
            .joined()
            .trimmingCharacters(in: .whitespacesAndNewlines)

        return text.isEmpty ? nil : TranscriptSegment(sec: sec, text: text)
    }
}
