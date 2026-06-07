// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "TranscriptSpike",
    platforms: [.macOS(.v14)],
    targets: [
        .executableTarget(
            name: "TranscriptSpike",
            path: "Sources/TranscriptSpike"
        )
    ]
)
