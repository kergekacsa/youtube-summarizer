import Foundation

// MARK: - Constants (API key replaced in NIM-14)

let claudeAPIKey = ProcessInfo.processInfo.environment["ANTHROPIC_API_KEY"] ?? ""
let claudeModel  = "claude-sonnet-4-6"

// MARK: - Timestamp snapping

/// Snap every section.sec to the nearest real transcript segment start ≤ sec.
/// Sections before the first segment are clamped to the first segment.
///
/// Mirrors `snapTimestamps` in `chrome-extension/lib/summarize.ts`.
func snapTimestamps(summary: Summary, realSegmentStarts: [Int]) -> Summary {
    let sorted = realSegmentStarts.sorted()
    guard !sorted.isEmpty else { return summary }
    let snappedSections = summary.sections.map { section -> Section in
        let snapped = findFloor(sorted: sorted, target: section.sec) ?? sorted[0]
        guard snapped != section.sec else { return section }
        return Section(sec: snapped, title: section.title, summary: section.summary)
    }
    return Summary(language: summary.language, sections: snappedSections)
}

private func findFloor(sorted: [Int], target: Int) -> Int? {
    var result: Int?
    for val in sorted {
        if val <= target { result = val } else { break }
    }
    return result
}

// MARK: - Response parsing

/// Extract and validate a `Summary` from a raw Anthropic Messages API response dictionary.
func parseSummaryResponse(_ response: [String: Any]) throws -> Summary {
    guard let content = response["content"] as? [[String: Any]],
          let toolUse = content.first(where: {
              $0["type"] as? String == "tool_use" &&
              $0["name"] as? String == "submit_summary"
          }),
          let input = toolUse["input"] as? [String: Any] else {
        throw SummarizeError.missingToolUse
    }

    guard let language = input["language"] as? String else {
        throw SummarizeError.missingLanguage
    }

    guard let sectionsRaw = input["sections"] as? [[String: Any]], !sectionsRaw.isEmpty else {
        throw SummarizeError.missingSections
    }

    let sections = try sectionsRaw.map { s -> Section in
        guard let sec   = s["sec"]     as? Int,
              let title = s["title"]   as? String,
              let sum   = s["summary"] as? String else {
            throw SummarizeError.malformedSection
        }
        return Section(sec: sec, title: title, summary: sum)
    }

    return Summary(language: language, sections: sections)
}

// MARK: - Claude API call

/// Call the Anthropic Messages API, force a `submit_summary` tool call,
/// and return the snapped summary.
func callClaude(transcript: [TranscriptSegment]) async throws -> Summary {
    guard let promptURL = Bundle.module.url(forResource: "prompt", withExtension: "md"),
          let schemaURL = Bundle.module.url(forResource: "schema",  withExtension: "json") else {
        throw SummarizeError.apiError("prompt.md or schema.json not found in bundle")
    }

    let promptText = try String(contentsOf: promptURL, encoding: .utf8)
    let schemaData = try Data(contentsOf: schemaURL)
    guard let schema = try? JSONSerialization.jsonObject(with: schemaData) as? [String: Any] else {
        throw SummarizeError.apiError("schema.json is not a valid JSON object")
    }

    let userMessage = renderUserMessage(transcript: transcript)
    let body: [String: Any] = [
        "model":      claudeModel,
        "max_tokens": 4096,
        "system":     promptText,
        "tools":      [schema],
        "tool_choice": ["type": "tool", "name": "submit_summary"],
        "messages":   [["role": "user", "content": userMessage]]
    ]
    let bodyData = try JSONSerialization.data(withJSONObject: body)

    var request = URLRequest(url: URL(string: "https://api.anthropic.com/v1/messages")!)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.setValue(claudeAPIKey,       forHTTPHeaderField: "x-api-key")
    request.setValue("2023-06-01",       forHTTPHeaderField: "anthropic-version")
    request.httpBody = bodyData

    let (data, response) = try await URLSession.shared.data(for: request)
    guard let http = response as? HTTPURLResponse else {
        throw SummarizeError.apiError("Unexpected response type")
    }
    guard http.statusCode == 200 else {
        let body = String(data: data, encoding: .utf8) ?? "(empty body)"
        throw SummarizeError.apiError("HTTP \(http.statusCode): \(body)")
    }

    guard let responseJSON = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
        throw SummarizeError.apiError("Response is not a JSON object")
    }

    let summary = try parseSummaryResponse(responseJSON)
    return snapTimestamps(summary: summary, realSegmentStarts: transcript.map { $0.sec })
}

// MARK: - Helpers

private func renderUserMessage(transcript: [TranscriptSegment]) -> String {
    let body = transcript.map { "[\($0.sec)] \($0.text)" }.joined(separator: "\n")
    return "Summarize this video transcript:\n\n\(body)"
}
