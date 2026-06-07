// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "YTSummarizer",
    platforms: [.iOS(.v17)],
    targets: [
        // Pure business logic — no UIKit, no @main. Tested via YTSummarizerCoreTests.
        .target(
            name: "YTSummarizerCore",
            path: "Sources/YTSummarizerCore",
            resources: [.process("Resources")]
        ),
        // iOS app — depends on Core, owns the UI layer and WebView.
        .target(
            name: "YTSummarizer",
            dependencies: ["YTSummarizerCore"],
            path: "Sources/YTSummarizer"
        ),
        .testTarget(
            name: "YTSummarizerCoreTests",
            dependencies: ["YTSummarizerCore"],
            path: "Tests/YTSummarizerCoreTests"
        )
    ]
)
