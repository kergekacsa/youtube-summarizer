import XCTest
@testable import YTSummarizerCore

final class SummarizeTests: XCTestCase {

    // MARK: - snapTimestamps

    func test_snap_leavesUnchangedWhenSecAlreadyMatches() {
        let summary = Summary(language: "en", sections: [SummarySummarySection(sec: 10, title: "A", summary: "B")])
        let result = snapTimestamps(summary: summary, realSegmentStarts: [5, 10, 20])
        XCTAssertEqual(result.sections[0].sec, 10)
    }

    func test_snap_snapsToGreatestRealSegmentBelowOrEqualToSec() {
        let summary = Summary(language: "en", sections: [SummarySection(sec: 15, title: "A", summary: "B")])
        let result = snapTimestamps(summary: summary, realSegmentStarts: [5, 10, 20])
        XCTAssertEqual(result.sections[0].sec, 10)
    }

    func test_snap_clampsToFirstSegmentWhenSecIsBeforeTranscript() {
        let summary = Summary(language: "en", sections: [SummarySection(sec: 2, title: "A", summary: "B")])
        let result = snapTimestamps(summary: summary, realSegmentStarts: [5, 10, 20])
        XCTAssertEqual(result.sections[0].sec, 5)
    }

    func test_snap_preservesLanguageTitleAndSummaryText() {
        let summary = Summary(language: "hu", sections: [SummarySection(sec: 12, title: "Fejezet", summary: "Szöveg")])
        let result = snapTimestamps(summary: summary, realSegmentStarts: [5, 10, 20])
        XCTAssertEqual(result.language, "hu")
        XCTAssertEqual(result.sections[0].title, "Fejezet")
        XCTAssertEqual(result.sections[0].summary, "Szöveg")
        XCTAssertEqual(result.sections[0].sec, 10)
    }

    // MARK: - parseSummaryResponse

    func test_parse_returnsSummaryFromValidToolUseResponse() throws {
        let sections: [[String: Any]] = [
            ["sec": 0, "title": "Introduction", "summary": "The video starts here."]
        ]
        let input: [String: Any] = ["language": "en", "sections": sections]
        let content: [[String: Any]] = [
            ["type": "tool_use", "name": "submit_summary", "input": input]
        ]
        let response: [String: Any] = ["content": content]

        let summary = try parseSummaryResponse(response)
        XCTAssertEqual(summary.language, "en")
        XCTAssertEqual(summary.sections.count, 1)
        XCTAssertEqual(summary.sections[0].title, "Introduction")
        XCTAssertEqual(summary.sections[0].sec, 0)
    }

    func test_parse_throwsWhenNoSubmitSummaryBlock() {
        let content: [[String: Any]] = [
            ["type": "text", "text": "I cannot help."]
        ]
        let response: [String: Any] = ["content": content]
        XCTAssertThrowsError(try parseSummaryResponse(response)) { error in
            XCTAssertTrue(
                error.localizedDescription.contains("submit_summary"),
                "Expected 'submit_summary' in: \(error.localizedDescription)"
            )
        }
    }

    func test_parse_throwsWhenLanguageMissing() {
        let sections: [[String: Any]] = [["sec": 0, "title": "A", "summary": "B"]]
        let input: [String: Any] = ["sections": sections]
        let content: [[String: Any]] = [
            ["type": "tool_use", "name": "submit_summary", "input": input]
        ]
        XCTAssertThrowsError(try parseSummaryResponse(["content": content]))
    }

    func test_parse_throwsWhenSectionsEmpty() {
        let input: [String: Any] = ["language": "en", "sections": [[String: Any]]()]
        let content: [[String: Any]] = [
            ["type": "tool_use", "name": "submit_summary", "input": input]
        ]
        XCTAssertThrowsError(try parseSummaryResponse(["content": content]))
    }
}
