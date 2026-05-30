// LlamaCppModelSession.swift
//
// This entire file is compiled ONLY when the llama Swift Package is linked.
// To enable: add https://github.com/ggml-org/llama.cpp (product: llama) as a
// Swift Package dependency to the NativeLLMRuntime target in Xcode, then rebuild.
//
// All llama.cpp C API calls are routed through LlamaCppCApiAdapter, which
// handles API version differences (legacy vs current naming) via compile flags.
// See docs/LLAMA_CPP_API_COMPATIBILITY.md for the full API drift matrix.
//
// Nothing in this file is reachable in a standard Vibecode/Expo Go build.

#if canImport(llama)
import llama
import Foundation

/// Holds a live llama_model* and llama_context* for a single loaded model.
/// Owns both pointers and frees them on deinit.
final class LlamaCppModelSession {
  let modelId: String
  private let llamaModel: OpaquePointer  // llama_model *
  private let llamaContext: OpaquePointer  // llama_context *

  // Cached at init to fail-fast on vocab problems and avoid redundant calls per inference.
  private let cachedVocabSize: Int
  private let cachedEosToken: llama_token

  // Prevents concurrent runInference calls on the same session.
  // Does NOT implement cancellation — that is Phase 2C.
  private let inferenceLock = NSLock()

  init(modelId: String, path: String, contextLength: Int) throws {
    LlamaCppCApiAdapter.ensureBackendInitialized()

    var modelParams = llama_model_default_params()
    modelParams.n_gpu_layers = 0  // CPU-only; Metal/GPU offload added in Phase 2C

    guard let model = LlamaCppCApiAdapter.loadModel(path: path, params: modelParams) else {
      throw LlamaCppError.fileNotFound(path: path)
    }

    // Validate vocab before context creation — fail early with a clear error.
    let vocabSize = try LlamaCppCApiAdapter.vocabSize(model: model)
    let eosToken = try LlamaCppCApiAdapter.eosToken(model: model)

    var ctxParams = llama_context_default_params()
    ctxParams.n_ctx = UInt32(max(512, min(contextLength, 4096)))
    ctxParams.n_batch = 512
    ctxParams.n_ubatch = 512

    guard let ctx = LlamaCppCApiAdapter.createContext(model: model, params: ctxParams) else {
      LlamaCppCApiAdapter.freeModel(model)
      throw LlamaCppError.contextInitFailed
    }

    self.modelId = modelId
    self.llamaModel = model
    self.llamaContext = ctx
    self.cachedVocabSize = vocabSize
    self.cachedEosToken = eosToken
  }

  deinit {
    llama_free(llamaContext)
    LlamaCppCApiAdapter.freeModel(llamaModel)
  }

  // MARK: - Inference (greedy, Phase 2B — temperature/top-p sampling in Phase 2C)

  func generate(request: RunInferenceRequestNative) throws -> RunInferenceResultNative {
    // Serialization guard: reject if an inference call is already in progress.
    guard inferenceLock.try() else { throw LlamaCppError.inferenceBusy }
    defer { inferenceLock.unlock() }

    let startTime = Date()

    // Clear KV cache before every inference to prevent stale state from a prior call.
    LlamaCppCApiAdapter.clearKVCache(llamaContext)

    // Tokenize prompt.
    let bufSize = request.prompt.utf8.count + 64
    var tokenBuf = [llama_token](repeating: 0, count: bufSize)

    let nPrompt = try LlamaCppCApiAdapter.tokenize(
      model: llamaModel,
      text: request.prompt,
      addSpecial: true,
      parseSpecial: false,
      buffer: &tokenBuf,
      maxTokens: Int32(bufSize)
    )
    guard nPrompt > 0 else { throw LlamaCppError.tokenizationFailed }

    let promptTokens = Array(tokenBuf.prefix(Int(nPrompt)))

    // Decode the prompt batch.
    var batch = llama_batch_init(max(Int32(promptTokens.count), 512), 0, 1)
    for (i, tok) in promptTokens.enumerated() {
      addToken(&batch, token: tok, pos: Int32(i), seqId: 0, logits: i == promptTokens.count - 1)
    }
    guard llama_decode(llamaContext, batch) == 0 else {
      llama_batch_free(batch)
      throw LlamaCppError.decodeFailed
    }
    llama_batch_free(batch)

    // Greedy sampling loop.
    var output: [llama_token] = []
    var nCur = Int32(promptTokens.count)
    let maxNew = max(1, request.maxTokens)

    while output.count < maxNew {
      guard let logits = llama_get_logits(llamaContext) else {
        throw LlamaCppError.invalidLogits
      }

      // Argmax (greedy) — avoids sampler chain complexity for Phase 2B.
      var best = 0
      var bestVal = logits[0]
      for i in 1..<cachedVocabSize {
        if logits[i] > bestVal { bestVal = logits[i]; best = i }
      }
      let next = llama_token(best)
      if next == cachedEosToken { break }

      // Check stop sequences before committing the token.
      let currentText = try detokenize(tokens: output + [next])
      if request.stopSequences.contains(where: { currentText.hasSuffix($0) }) { break }

      output.append(next)

      var nb = llama_batch_init(1, 0, 1)
      addToken(&nb, token: next, pos: nCur, seqId: 0, logits: true)
      nCur += 1
      if llama_decode(llamaContext, nb) != 0 { llama_batch_free(nb); break }
      llama_batch_free(nb)
    }

    let durationMs = Int(Date().timeIntervalSince(startTime) * 1000)
    return RunInferenceResultNative(
      text: try detokenize(tokens: output),
      tokensGenerated: output.count,
      tokensSeen: Int(nPrompt),
      durationMs: durationMs,
      backend: "llama_cpp",
      modelId: modelId
    )
  }

  // MARK: - Helpers

  /// Converts a token array to its UTF-8 string representation.
  /// Throws LlamaCppError.detokenizationFailed if a token piece cannot be decoded.
  private func detokenize(tokens: [llama_token]) throws -> String {
    var result = ""
    var buf = [CChar](repeating: 0, count: 256)
    for tok in tokens {
      let n = try LlamaCppCApiAdapter.tokenToPiece(model: llamaModel, token: tok, buffer: &buf)
      if n < 0 { throw LlamaCppError.detokenizationFailed }
      if n > 0 {
        result += String(bytes: buf.prefix(Int(n)).map { UInt8(bitPattern: $0) }, encoding: .utf8) ?? ""
      }
    }
    return result
  }

  // Mirrors the llama_batch_add C macro.
  private func addToken(
    _ batch: inout llama_batch,
    token: llama_token,
    pos: llama_pos,
    seqId: llama_seq_id,
    logits: Bool
  ) {
    let i = Int(batch.n_tokens)
    batch.token[i] = token
    batch.pos[i] = pos
    batch.n_seq_id[i] = 1
    if let outer = batch.seq_id, let inner = outer[i] { inner[0] = seqId }
    batch.logits[i] = logits ? 1 : 0
    batch.n_tokens += 1
  }
}
#endif
