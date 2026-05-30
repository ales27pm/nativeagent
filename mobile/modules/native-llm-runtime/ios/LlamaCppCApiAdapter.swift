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

  static func vocabSize(model: OpaquePointer) -> Int {
    #if LLAMA_CPP_LEGACY_API
    return Int(llama_n_vocab(model))
    #else
    guard let vocab = llama_model_get_vocab(model) else { return 0 }
    return Int(llama_vocab_n_tokens(vocab))
    #endif
  }

  static func eosToken(model: OpaquePointer) -> llama_token {
    #if LLAMA_CPP_LEGACY_API
    return llama_token_eos(model)
    #else
    guard let vocab = llama_model_get_vocab(model) else { return -1 }
    return llama_vocab_eos(vocab)
    #endif
  }

  // MARK: - Tokenization

  static func tokenize(
    model: OpaquePointer,
    text: String,
    addSpecial: Bool,
    parseSpecial: Bool,
    buffer: inout [llama_token],
    maxTokens: Int32
  ) -> Int32 {
    let bytes = Array(text.utf8)
    let byteCount = Int32(bytes.count)
    #if LLAMA_CPP_LEGACY_API
    return llama_tokenize(model, text, byteCount, &buffer, maxTokens, addSpecial, parseSpecial)
    #else
    guard let vocab = llama_model_get_vocab(model) else { return -1 }
    return llama_tokenize(vocab, text, byteCount, &buffer, maxTokens, addSpecial, parseSpecial)
    #endif
  }

  static func tokenToPiece(
    model: OpaquePointer,
    token: llama_token,
    buffer: inout [CChar],
    special: Bool = false
  ) -> Int32 {
    #if LLAMA_CPP_LEGACY_API
    return llama_token_to_piece(model, token, &buffer, Int32(buffer.count), 0, special)
    #else
    guard let vocab = llama_model_get_vocab(model) else { return 0 }
    return llama_token_to_piece(vocab, token, &buffer, Int32(buffer.count), 0, special)
    #endif
  }
}
#endif
