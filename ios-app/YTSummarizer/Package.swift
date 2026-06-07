// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "YTSummarizer",
    platforms: [.iOS(.v17), .macCatalyst(.v15), .macOS(.v14)],
    products: [
        // YTSummarizerCore is the only importable product.
        // The iOS app UI lives in Sources/YTSummarizer/ and is compiled
        // directly by the Xcode app target (not as a library target here).
        .library(name: "YTSummarizerCore", targets: ["YTSummarizerCore"]),
    ],
    targets: [
        .target(
            name: "YTSummarizerCore",
            path: "Sources/YTSummarizerCore",
            resources: [.process("Resources")]
        ),
        .testTarget(
            name: "YTSummarizerCoreTests",
            dependencies: ["YTSummarizerCore"],
            path: "Tests/YTSummarizerCoreTests"
        )
    ]
)
