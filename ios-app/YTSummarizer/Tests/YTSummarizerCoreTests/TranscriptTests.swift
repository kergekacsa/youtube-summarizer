import XCTest
@testable import YTSummarizerCore

final class TranscriptTests: XCTestCase {

    // RED 1 — tracer bullet
    func test_throwsOnEmptyString() {
        XCTAssertThrowsError(try normalizeJson3("")) { error in
            XCTAssertTrue(
                error.localizedDescription.lowercased().contains("empty"),
                "Expected 'empty' in: \(error.localizedDescription)"
            )
        }
    }

    func test_throwsOnWhitespaceOnly() {
        XCTAssertThrowsError(try normalizeJson3("   \n  "))
    }

    func test_throwsOnInvalidJSON() {
        XCTAssertThrowsError(try normalizeJson3("not json at all"))
    }

    func test_parsesSingleEvent() throws {
        let json3 = #"{"events":[{"tStartMs":1000,"segs":[{"utf8":"Hello"}]}]}"#
        let segments = try normalizeJson3(json3)
        XCTAssertEqual(segments, [TranscriptSegment(sec: 1, text: "Hello")])
    }

    func test_floorsMillisecondsToSeconds() throws {
        let json3 = #"{"events":[{"tStartMs":3500,"segs":[{"utf8":"Hi"}]}]}"#
        let segments = try normalizeJson3(json3)
        XCTAssertEqual(segments.first?.sec, 3)
    }

    func test_joinsMultipleSegsWithinOneEvent() throws {
        let json3 = #"{"events":[{"tStartMs":0,"segs":[{"utf8":"Hello "},{"utf8":"world"}]}]}"#
        let segments = try normalizeJson3(json3)
        XCTAssertEqual(segments.first?.text, "Hello world")
    }

    func test_filtersWhitespaceOnlySegments() throws {
        let json3 = #"{"events":[{"tStartMs":0,"segs":[{"utf8":"  "}]},{"tStartMs":1000,"segs":[{"utf8":"Real text"}]}]}"#
        let segments = try normalizeJson3(json3)
        XCTAssertEqual(segments.count, 1)
        XCTAssertEqual(segments.first?.text, "Real text")
    }

    func test_emptyEventsArrayReturnsEmpty() throws {
        let json3 = #"{"events":[]}"#
        XCTAssertTrue(try normalizeJson3(json3).isEmpty)
    }

    func test_missingEventsKeyReturnsEmpty() throws {
        XCTAssertTrue(try normalizeJson3("{}").isEmpty)
    }
}
