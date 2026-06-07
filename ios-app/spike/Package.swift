// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "TranscriptSpike",
    platforms: [.macOS(.v14)],
    dependencies: [
        .package(path: "../YTSummarizer"),
    ],
    targets: [
        .executableTarget(
            name: "TranscriptSpike",
            dependencies: [
                .product(name: "YTSummarizerCore", package: "YTSummarizer"),
            ],
            path: "Sources/TranscriptSpike"
        )
    ]
)
