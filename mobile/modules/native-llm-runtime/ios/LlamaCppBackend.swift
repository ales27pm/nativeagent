// LlamaCppBackend.swift
//
// Implements the LLMBackend protocol for llama.cpp.
//
// Compile-time detection: `#if canImport(llama)` is true ONLY when the
// llama Swift Package is linked into the target. Without that package,
// the real loading/inference code is excluded from the binary and the
// backend reports isLinked = false at all times.
//
// To enable real inference locally:
//   1. npx expo prebuild --clean
//   2. Open ios/<project>.xcworkspace in Xcode
//   3. File > Add Package Dependencies…
//      URL: https://github.com/ggml-org/llama.cpp
//      Product: llama  (add to NativeLLMRuntime target)
//   4. Add "-DLLAMA_CPP_AVAILABLE" to Other Swift Flags if using flag-based detection
//   5. Build and run on device or simulator

#if canImport(llama)
import llama
#endif
import Foundation

final class LlamaCppBackend: LLMBackend {

  // MARK: - Protocol properties

  var backendName: String {
    #if canImport(llama)
    return "llama_cpp"
    #else
    return "none"
    #endif
  }

  var isLinked: Bool {
    #if canImport(llama)
    return true
    #else
    return false
    #endif
  }

  var supportsStreaming: Bool { isLinked }
  var supportsCancellation: Bool { false }  // cancellable in Phase 2C
  var supportsQuantizedModels: Bool { true }  // GGUF Q4/Q8 supported
  var supportedFormats: [String] { ["gguf"] }

  func reasonNotLinked() -> String? {
    guard !isLinked else { return nil }
    return "llama.cpp Swift Package is not linked. " +
      "Add https://github.com/ggml-org/llama.cpp (product: llama) " +
      "to the NativeLLMRuntime Xcode target, then rebuild. " +
      "See docs/IOS_LLAMA_CPP_BACKEND.md for step-by-step instructions."
  }

  // MARK: - Session state (non-nil only when llama.cpp is linked and model loaded)

  #if canImport(llama)
  private var session: LlamaCppModelSession? = nil
  #endif

  var currentModelId: String? {
    #if canImport(llama)
    return session?.modelId
    #else
    return nil
    #endif
  }

  // MARK: - LLMBackend conformance

  func loadModel(request: LoadModelRequestNative) async throws -> LoadModelResultNative {
    let fm = FileManager.default

    // File validation always runs regardless of whether llama.cpp is linked
    guard fm.fileExists(atPath: request.localPath) else {
      throw LlamaCppError.fileNotFound(path: request.localPath)
    }
    guard fm.isReadableFile(atPath: request.localPath) else {
      throw LlamaCppError.fileNotReadable(path: request.localPath)
    }

    let ext = (request.localPath as NSString).pathExtension.lowercased()
    guard ext == "gguf" else {
      throw LlamaCppError.invalidFormat(expected: "gguf", got: ext.isEmpty ? "(none)" : ext)
    }

    let attrs = try? fm.attributesOfItem(atPath: request.localPath)
    let sizeBytes = (attrs?[.size] as? Int) ?? 0
    guard sizeBytes > 0 else {
      throw LlamaCppError.fileEmpty(path: request.localPath)
    }

    #if canImport(llama)
    // Backend is linked — attempt real model load
    let ctxLen = request.contextLength > 0 ? request.contextLength : 2048
    let s = try LlamaCppModelSession(
      modelId: request.modelId,
      path: request.localPath,
      contextLength: ctxLen
    )
    session = s
    return LoadModelResultNative(
      loaded: true,
      modelId: request.modelId,
      backend: "llama_cpp",
      message: "Model loaded via llama.cpp. Context: \(ctxLen) tokens, file: \(sizeBytes) bytes."
    )
    #else
    // Backend not linked — file is valid but we can't load
    return LoadModelResultNative(
      loaded: false,
      modelId: request.modelId,
      backend: "none",
      message: "File validated (.gguf, \(sizeBytes) bytes) — " +
        "llama.cpp is not linked. " +
        "See docs/IOS_LLAMA_CPP_BACKEND.md to activate real loading."
    )
    #endif
  }

  func unloadModel(modelId: String) async -> UnloadModelResultNative {
    #if canImport(llama)
    let wasLoaded = session?.modelId == modelId
    if wasLoaded { session = nil }
    return UnloadModelResultNative(
      unloaded: wasLoaded,
      modelId: modelId,
      message: wasLoaded ? "Model unloaded and memory freed." : "No model was loaded with that ID."
    )
    #else
    return UnloadModelResultNative(
      unloaded: false,
      modelId: modelId,
      message: "llama.cpp is not linked — no session to unload."
    )
    #endif
  }

  func runInference(request: RunInferenceRequestNative) async throws -> RunInferenceResultNative {
    #if canImport(llama)
    guard let s = session, s.modelId == request.modelId else {
      throw LlamaCppError.modelNotLoaded(modelId: request.modelId)
    }
    return try s.generate(request: request)
    #else
    throw LlamaCppError.notLinked
    #endif
  }
}
