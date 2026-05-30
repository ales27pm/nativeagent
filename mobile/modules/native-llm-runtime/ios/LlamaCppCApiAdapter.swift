// LlamaCppCApiAdapter.swift
//
// Stable Swift wrapper around the llama.cpp C API.
// Isolates API version differences so LlamaCppModelSession never calls
// raw llama.cpp symbols directly — only adapter methods.
//
// API drift handled here:
//   Legacy (pre-b4000):  llama_load_model_from_file, llama_new_context_with_model,
//                        llama_free_model, llama_n_vocab, llama_token_eos,
//                        llama_tokenize(model:…), llama_token_to_piece(model:…)
//   Current (b4000+):    llama_model_load_from_file, llama_init_from_model,
//                        llama_model_free, llama_model_get_vocab,
//                        llama_vocab_n_tokens, llama_vocab_eos,
//                        llama_tokenize(vocab:…), llama_token_to_piece(vocab:…)
//
// Default build uses current API names.
// If Xcode reports "use of undeclared identifier 'llama_model_load_from_file'",
// add -DLLAMA_CPP_LEGACY_API to Other Swift Flags for the NativeLLMRuntime target
// and rebuild. See docs/LLAMA_CPP_API_COMPATIBILITY.md for the full matrix.
//
// Backend init:
// llama_backend_init() is required by pre-b4700 builds before any model load.
// In b4700+ it became a no-op / removed. The adapter calls it unconditionally;
// if your version removed it entirely, add -DLLAMA_CPP_NO_BACKEND_INIT to
// Other Swift Flags to suppress the call.
//
// KV state:
// llama_kv_cache_clear() is NOT called here. Its availability varies across
// llama.cpp releases and calling it risks a compile error against an unknown
// version of the Swift Package. Phase 2B.8 avoids stale KV state by creating
// a fresh llama_context per runInference call instead of clearing the cache.
//
// This file is compiled ONLY when the llama Swift Package is linked
// (#if canImport(llama) is true).

#if canImport(llama)
import llama
import Foundation

enum LlamaCppCApiAdapter {

  // MARK: - One-time backend initializer

  private static let _backendInitOnce: Void = {
    #if !LLAMA_CPP_NO_BACKEND_INIT
    llama_backend_init()
    #endif
  }()

  /// Call before the first model load. Safe to call multiple times — runs once.
  static func ensureBackendInitialized() {
    _ = _backendInitOnce
  }

  // MARK: - Model lifecycle

  static func loadModel(
    path: String,
    params: llama_model_params
  ) -> OpaquePointer? {
    #if LLAMA_CPP_LEGACY_API
    return llama_load_model_from_file(path, params)
    #else
    return llama_model_load_from_file(path, params)
    #endif
  }

  static func freeModel(_ model: OpaquePointer) {
    #if LLAMA_CPP_LEGACY_API
    llama_free_model(model)
    #else
    llama_model_free(model)
    #endif
  }

  // MARK: - Context lifecycle

  static func createContext(
    model: OpaquePointer,
    params: llama_context_params
  ) -> OpaquePointer? {
    #if LLAMA_CPP_LEGACY_API
    return llama_new_context_with_model(model, params)
    #else
    return llama_init_from_model(model, params)
    #endif
  }

  // MARK: - Vocab accessors

  /// Returns vocab pointer (current API) or nil for legacy API (use model pointer directly).
  static func getVocab(model: OpaquePointer) -> OpaquePointer? {
    #if LLAMA_CPP_LEGACY_API
    return nil
    #else
    return llama_model_get_vocab(model)
    #endif
  }

  /// Returns vocabulary size. Throws if the vocab pointer is unavailable or the size is 0.
  static func vocabSize(model: OpaquePointer) throws -> Int {
    #if LLAMA_CPP_LEGACY_API
    let n = Int(llama_n_vocab(model))
    guard n > 0 else { throw LlamaCppError.emptyVocabulary }
    return n
    #else
    guard let vocab = llama_model_get_vocab(model) else { throw LlamaCppError.vocabUnavailable }
    let n = Int(llama_vocab_n_tokens(vocab))
    guard n > 0 else { throw LlamaCppError.emptyVocabulary }
    return n
    #endif
  }

  /// Returns the EOS token. Throws if the vocab pointer is unavailable.
  static func eosToken(model: OpaquePointer) throws -> llama_token {
    #if LLAMA_CPP_LEGACY_API
    return llama_token_eos(model)
    #else
    guard let vocab = llama_model_get_vocab(model) else { throw LlamaCppError.vocabUnavailable }
    return llama_vocab_eos(vocab)
    #endif
  }

  // MARK: - Tokenization

  /// Tokenizes `text` into `buffer`. Returns the number of tokens written.
  /// Uses withUnsafeMutableBufferPointer for safe C interop.
  /// If llama_tokenize returns a negative count, abs(result) is the required buffer size;
  /// the buffer is resized and the call is retried once. Throws tokenizationFailed on retry failure.
  /// Throws LlamaCppError.vocabUnavailable if vocab pointer is nil (current API).
  static func tokenize(
    model: OpaquePointer,
    text: String,
    addSpecial: Bool,
    parseSpecial: Bool,
    buffer: inout [llama_token],
    maxTokens: Int32
  ) throws -> Int32 {
    let byteCount = Int32(text.utf8.count)
    #if LLAMA_CPP_LEGACY_API
    var result = try buffer.withUnsafeMutableBufferPointer { bufPtr throws -> Int32 in
      guard let base = bufPtr.baseAddress else { throw LlamaCppError.tokenizationFailed }
      return llama_tokenize(model, text, byteCount, base, maxTokens, addSpecial, parseSpecial)
    }
    if result < 0 {
      let required = Int(-result)
      buffer = [llama_token](repeating: 0, count: required)
      result = try buffer.withUnsafeMutableBufferPointer { bufPtr throws -> Int32 in
        guard let base = bufPtr.baseAddress else { throw LlamaCppError.tokenizationFailed }
        return llama_tokenize(model, text, byteCount, base, Int32(required), addSpecial, parseSpecial)
      }
      if result < 0 { throw LlamaCppError.tokenizationFailed }
    }
    return result
    #else
    guard let vocab = llama_model_get_vocab(model) else { throw LlamaCppError.vocabUnavailable }
    var result = try buffer.withUnsafeMutableBufferPointer { bufPtr throws -> Int32 in
      guard let base = bufPtr.baseAddress else { throw LlamaCppError.tokenizationFailed }
      return llama_tokenize(vocab, text, byteCount, base, maxTokens, addSpecial, parseSpecial)
    }
    if result < 0 {
      let required = Int(-result)
      buffer = [llama_token](repeating: 0, count: required)
      result = try buffer.withUnsafeMutableBufferPointer { bufPtr throws -> Int32 in
        guard let base = bufPtr.baseAddress else { throw LlamaCppError.tokenizationFailed }
        return llama_tokenize(vocab, text, byteCount, base, Int32(required), addSpecial, parseSpecial)
      }
      if result < 0 { throw LlamaCppError.tokenizationFailed }
    }
    return result
    #endif
  }

  /// Converts a single token to its UTF-8 string piece.
  /// Uses withUnsafeMutableBufferPointer for safe C interop.
  /// If llama_token_to_piece returns a negative value, abs(result) is the required byte count;
  /// the buffer is resized and the call is retried once. Throws detokenizationFailed on retry failure.
  /// There is no silent empty-string fallback — callers must handle thrown errors.
  /// Throws LlamaCppError.vocabUnavailable if vocab pointer is nil (current API).
  /// Returns the byte count written (> 0 on success).
  static func tokenToPiece(
    model: OpaquePointer,
    token: llama_token,
    buffer: inout [CChar],
    special: Bool = false
  ) throws -> Int32 {
    #if LLAMA_CPP_LEGACY_API
    var result = try buffer.withUnsafeMutableBufferPointer { bufPtr throws -> Int32 in
      guard let base = bufPtr.baseAddress else { throw LlamaCppError.detokenizationFailed }
      return llama_token_to_piece(model, token, base, Int32(bufPtr.count), 0, special)
    }
    if result < 0 {
      let required = Int(-result)
      buffer = [CChar](repeating: 0, count: required)
      result = try buffer.withUnsafeMutableBufferPointer { bufPtr throws -> Int32 in
        guard let base = bufPtr.baseAddress else { throw LlamaCppError.detokenizationFailed }
        return llama_token_to_piece(model, token, base, Int32(required), 0, special)
      }
      if result < 0 { throw LlamaCppError.detokenizationFailed }
    }
    return result
    #else
    guard let vocab = llama_model_get_vocab(model) else { throw LlamaCppError.vocabUnavailable }
    var result = try buffer.withUnsafeMutableBufferPointer { bufPtr throws -> Int32 in
      guard let base = bufPtr.baseAddress else { throw LlamaCppError.detokenizationFailed }
      return llama_token_to_piece(vocab, token, base, Int32(bufPtr.count), 0, special)
    }
    if result < 0 {
      let required = Int(-result)
      buffer = [CChar](repeating: 0, count: required)
      result = try buffer.withUnsafeMutableBufferPointer { bufPtr throws -> Int32 in
        guard let base = bufPtr.baseAddress else { throw LlamaCppError.detokenizationFailed }
        return llama_token_to_piece(vocab, token, base, Int32(required), 0, special)
      }
      if result < 0 { throw LlamaCppError.detokenizationFailed }
    }
    return result
    #endif
  }
}
#endif
