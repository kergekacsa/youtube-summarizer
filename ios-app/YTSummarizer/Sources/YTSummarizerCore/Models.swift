import Foundation

struct TranscriptSegment: Equatable {
    let sec: Int
    let text: String
}

struct Section: Equatable {
    let sec: Int
    let title: String
    let summary: String
}

struct Summary: Equatable {
    let language: String
    let sections: [Section]
}

enum TranscriptError: LocalizedError {
    case emptyResponse
    case invalidJSON

    var errorDescription: String? {
        switch self {
        case .emptyResponse:
            return "Caption track returned an empty response — the transcript may be unavailable for this video."
        case .invalidJSON:
            return "Caption track response was not valid json3."
        }
    }
}

enum SummarizeError: LocalizedError {
    case missingToolUse
    case missingLanguage
    case missingSections
    case malformedSection
    case apiError(String)

    var errorDescription: String? {
        switch self {
        case .missingToolUse:   return "Claude did not call submit_summary"
        case .missingLanguage:  return "submit_summary: missing language"
        case .missingSections:  return "submit_summary: sections must be a non-empty array"
        case .malformedSection: return "submit_summary: malformed section"
        case .apiError(let m):  return "API error: \(m)"
        }
    }
}
