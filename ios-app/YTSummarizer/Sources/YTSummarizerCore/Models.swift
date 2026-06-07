import Foundation

public struct TranscriptSegment: Equatable {
    public let sec: Int
    public let text: String
    public init(sec: Int, text: String) { self.sec = sec; self.text = text }
}

public struct SummarySection: Equatable {
    public let sec: Int
    public let title: String
    public let summary: String
    public init(sec: Int, title: String, summary: String) {
        self.sec = sec; self.title = title; self.summary = summary
    }
}

public struct Summary: Equatable {
    public let language: String
    public let sections: [SummarySection]
    public init(language: String, sections: [SummarySection]) {
        self.language = language; self.sections = sections
    }
}

public enum TranscriptError: LocalizedError {
    case emptyResponse
    case invalidJSON

    public var errorDescription: String? {
        switch self {
        case .emptyResponse:
            return "Caption track returned an empty response — the transcript may be unavailable for this video."
        case .invalidJSON:
            return "Caption track response was not valid json3."
        }
    }
}

public enum SummarizeError: LocalizedError {
    case missingToolUse
    case missingLanguage
    case missingSections
    case malformedSection
    case apiError(String)

    public var errorDescription: String? {
        switch self {
        case .missingToolUse:   return "Claude did not call submit_summary"
        case .missingLanguage:  return "submit_summary: missing language"
        case .missingSections:  return "submit_summary: sections must be a non-empty array"
        case .malformedSection: return "submit_summary: malformed section"
        case .apiError(let m):  return "API error: \(m)"
        }
    }
}
