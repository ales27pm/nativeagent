import Foundation

/// Typed errors thrown by the llama.cpp backend.
enum LlamaCppError: LocalizedError {
  case notLinked
  case fileNotFound(path: String)
  case invalidFormat(expected: String, got: String)
  case fileNotReadable(path: String)
  case fileEmpty(path: String)
  case contextInitFailed
  case tokenizationFailed
  case decodeFailed
  case modelNotLoaded(modelId: String)

  var errorDescription: String? {
    switch self {
    case .notLinked:
      return "llama.cpp is not linked. " +
        "Add the Swift Package 'https://github.com/ggml-org/llama.cpp' " +
        "(product: llama) to the iOS target, then run npx expo prebuild --clean && npx expo run:ios."
    case .fileNotFound(let path):
      return "File not found at path: \(path)"
    case .invalidFormat(let expected, let got):
      return "Invalid model format. " +
        "Expected .\(expected), got .\(got). " +
        "llama.cpp requires GGUF format. " +
        "Download a .gguf file from HuggingFace and place it in the app Documents folder."
    case .fileNotReadable(let path):
      return "File is not readable at path: \(path)"
    case .fileEmpty(let path):
      return "File is empty (0 bytes) at path: \(path). " +
        "The model file may be corrupt or the download was incomplete."
    case .contextInitFailed:
      return "Context initialization returned null. " +
        "The model may require more RAM than is available, " +
        "or the context length is too large for this device."
    case .tokenizationFailed:
      return "Tokenization failed. " +
        "The prompt may be empty, invalid UTF-8, or exceed the context window."
    case .decodeFailed:
      return "llama_decode returned non-zero. " +
        "The model may be corrupt or context overflow occurred."
    case .modelNotLoaded(let modelId):
      return "No model is loaded with ID: '\(modelId)'. Call loadModel before runInference."
    }
  }
}
