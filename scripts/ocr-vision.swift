import Foundation
import CoreGraphics
import ImageIO
import Vision

guard CommandLine.arguments.count >= 2 else {
  fputs("usage: ocr-vision <image> [--json]\n", stderr)
  exit(1)
}

let path = CommandLine.arguments[1]
let asJson = CommandLine.arguments.contains("--json")
let url = URL(fileURLWithPath: path)

guard let src = CGImageSourceCreateWithURL(url as CFURL, nil),
      let cgImage = CGImageSourceCreateImageAtIndex(src, 0, nil)
else {
  fputs("could not load image\n", stderr)
  exit(2)
}

func recognize(_ revision: Int, level: VNRequestTextRecognitionLevel) throws -> [VNRecognizedTextObservation] {
  let request = VNRecognizeTextRequest()
  request.recognitionLevel = level
  request.usesLanguageCorrection = false
  request.revision = revision
  let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
  try handler.perform([request])
  return request.results ?? []
}

var observations: [VNRecognizedTextObservation] = []
var lastError: Error?
let attempts: [(Int, VNRequestTextRecognitionLevel)] = [
  (VNRecognizeTextRequestRevision1, .fast),
  (VNRecognizeTextRequestRevision1, .accurate),
  (2, .fast),
  (2, .accurate),
]
if #available(macOS 13.0, *) {
  // revision 3 tried last
}

for (rev, level) in attempts {
  do {
    observations = try recognize(rev, level: level)
    lastError = nil
    break
  } catch {
    lastError = error
  }
}

if observations.isEmpty, let lastError {
  fputs("vision failed: \(lastError)\n", stderr)
  exit(3)
}

struct Line: Encodable {
  let text: String
  let confidence: Float
  let x: Float
  let y: Float
  let w: Float
  let h: Float
}

let lines: [Line] = observations.compactMap { obs in
  guard let cand = obs.topCandidates(1).first else { return nil }
  let bb = obs.boundingBox
  return Line(
    text: cand.string,
    confidence: cand.confidence,
    x: Float(bb.origin.x),
    y: Float(bb.origin.y),
    w: Float(bb.size.width),
    h: Float(bb.size.height)
  )
}

if asJson {
  let payload: [String: Any] = [
    "text": lines.map(\.text).joined(separator: "\n"),
    "lines": lines.map { line -> [String: Any] in
      [
        "text": line.text,
        "confidence": line.confidence,
        "x": line.x,
        "y": line.y,
        "w": line.w,
        "h": line.h,
      ]
    },
  ]
  do {
    let data = try JSONSerialization.data(withJSONObject: payload)
    FileHandle.standardOutput.write(data)
    FileHandle.standardOutput.write(Data("\n".utf8))
  } catch {
    fputs("json encode failed: \(error)\n", stderr)
    exit(4)
  }
} else {
  print(lines.map(\.text).joined(separator: "\n"))
}
