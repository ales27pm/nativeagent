import Foundation

// MARK: - Native struct types (passed between module and backends)

struct LoadModelRequestNative {
  let modelId: String
  let localPath: String
  let preferredBackend: String?
  let contextLength: Int
}

struct LoadModelResultNative {
  let loaded: Bool
  let modelId: String
  let backend: String
  let message: String
}

struct UnloadModelResultNative {
  let unloaded: Bool
  let modelId: String
  let message: String
}

struct RunInferenceRequestNative {
  let modelId: String
  let prompt: String
  let maxTokens: Int
  let temperature: Float
  let topP: Float
  let stopSequences: [String]
}

struct RunInferenceResultNative {
  let text: String
  let tokensGenerated: Int
  let tokensSeen: Int
  let backend: String
  let modelId: String
}

// MARK: - Backend protocol

/// Every LLM backend (llama.cpp, MLX, ExecuTorch, …) must conform to this protocol.
protocol LLMBackend: AnyObject {
  /// Canonical backend name reported to JS: 'llama_cpp', 'mlx', 'none', etc.
  var backendName: String { get }

  /// True only when the native library is actually linked into this binary.
  var isLinked: Bool { get }

  var supportsStreaming: Bool { get }
  var supportsCancellation: Bool { get }
  var supportsQuantizedModels: Bool { get }

  /// Model file formats this backend can load.
  var supportedFormats: [String] { get }

  /// ID of the currently loaded model, or nil if none is loaded.
  var currentModelId: String? { get }

  /// Human-readable message when isLinked == false, nil otherwise.
  func reasonNotLinked() -> String?

  func loadModel(request: LoadModelRequestNative) async throws -> LoadModelResultNative
  func unloadModel(modelId: String) async -> UnloadModelResultNative
  func runInference(request: RunInferenceRequestNative) async throws -> RunInferenceResultNative
}
