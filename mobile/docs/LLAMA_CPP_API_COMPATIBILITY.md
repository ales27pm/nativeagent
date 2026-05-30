# llama.cpp API Compatibility

Reference for handling llama.cpp C API drift across releases. Read this when Xcode reports "use of undeclared identifier" errors after pinning or updating the llama.cpp Swift Package.

---

## Why API compatibility matters

The ggml-org/llama.cpp repository evolves rapidly. Major API renames happen every few hundred builds. If you pin to a specific git tag, new Swift Package updates may introduce compile errors because function names changed. If you use an older tag, the current code expects names that don't exist yet.

`LlamaCppCApiAdapter.swift` is the single place in NativeAgent that wraps all llama.cpp symbol calls. This isolates every API version difference behind compile flags, so `LlamaCppModelSession.swift` never breaks when the C API evolves.

---

## Old vs current API names

| Purpose | Legacy (pre-b4000) | Current (b4000+) |
|---------|-------------------|-----------------|
| Load model | `llama_load_model_from_file` | `llama_model_load_from_file` |
| Free model | `llama_free_model` | `llama_model_free` |
| Create context | `llama_new_context_with_model` | `llama_init_from_model` |
| Vocab size | `llama_n_vocab(model)` | `llama_vocab_n_tokens(vocab)` |
| EOS token | `llama_token_eos(model)` | `llama_vocab_eos(vocab)` |
| Tokenize | `llama_tokenize(model, …)` | `llama_tokenize(vocab, …)` |
| Token to piece | `llama_token_to_piece(model, …)` | `llama_token_to_piece(vocab, …)` |
| Backend init | `llama_backend_init()` | no-op / removed in b4700+ |

The key structural change between legacy and current API is the **model pointer vs vocab pointer distinction**. In the legacy API, tokenization functions took the `llama_model *` directly. In the current API, you first call `llama_model_get_vocab(model)` to get a `llama_vocab *`, then pass that to tokenization functions. This separates model weight management from vocabulary / tokenizer concerns.

---

## Model pointer vs vocab pointer

**Legacy flow:**
```
llama_model *model = llama_load_model_from_file(path, params);
llama_tokenize(model, text, …);          // model used directly
llama_token_to_piece(model, token, …);  // model used directly
llama_n_vocab(model);                    // model used directly
llama_token_eos(model);                  // model used directly
```

**Current flow:**
```
llama_model *model = llama_model_load_from_file(path, params);
llama_vocab *vocab = llama_model_get_vocab(model);  // separate vocab pointer
llama_tokenize(vocab, text, …);           // vocab used
llama_token_to_piece(vocab, token, …);   // vocab used
llama_vocab_n_tokens(vocab);             // vocab used
llama_vocab_eos(vocab);                  // vocab used
```

The vocab pointer is owned by the model. Do not free it separately. The model frees it when `llama_model_free(model)` is called.

---

## Why tokenization should use vocab

The separation exists because:
1. A model has exactly one vocabulary, but the vocabulary can be reused without reloading weights
2. Future API versions may allow sharing a vocab across model instances
3. Passing model pointers to tokenization functions mixes concerns — the tokenizer doesn't need access to the weight tensors

Using `llama_model_get_vocab` correctly and passing the result to all tokenization calls makes the code robust against further API evolution.

---

## Why llama_model_load_from_file / llama_init_from_model are preferred

- They are the current canonical names in `llama.h`
- They follow the `llama_model_*` / `llama_context_*` naming convention introduced to make the API more consistent
- The legacy names will eventually be removed (some versions already produce deprecation warnings)

NativeAgent defaults to the current API names. If you need to target an older Swift Package tag, use `-DLLAMA_CPP_LEGACY_API`.

---

## How to fix compile errors from API drift

### Error: "use of undeclared identifier 'llama_model_load_from_file'"

Your pinned llama.cpp version uses legacy names. Add to the **NativeLLMRuntime** target's Build Settings:
```
Other Swift Flags → -DLLAMA_CPP_LEGACY_API
```

### Error: "use of undeclared identifier 'llama_load_from_file'" (neither name works)

Your version may have a different name entirely. Check `llama.h` in the Swift Package sources:
1. In Xcode, open Package Dependencies → llama.cpp → include/llama.h
2. Search for `_load_` to find the current model loading function
3. Update `LlamaCppCApiAdapter.loadModel(path:params:)` to use the correct name

### Error: "use of undeclared identifier 'llama_backend_init'"

Your version removed the backend init call. Add to Build Settings:
```
Other Swift Flags → -DLLAMA_CPP_NO_BACKEND_INIT
```

### Error: "use of undeclared identifier 'llama_model_get_vocab'"

Very old version (pre-vocab-pointer split). Add:
```
Other Swift Flags → -DLLAMA_CPP_LEGACY_API
```

---

## Exact files to inspect if Xcode fails

| File | Role |
|------|------|
| `modules/native-llm-runtime/ios/LlamaCppCApiAdapter.swift` | All raw C API calls — change names here first |
| `modules/native-llm-runtime/ios/LlamaCppModelSession.swift` | Uses adapter only; should not need changes |
| `modules/native-llm-runtime/ios/LlamaCppBackend.swift` | Backend protocol conformance; no raw C API calls |
| Swift Package cache: `~/.swiftpm/` | Cached package sources — delete to force re-resolve |

**Never edit LlamaCppModelSession.swift to add raw C API calls.** Route all llama.cpp symbols through the adapter. This keeps drift fixes in one place.

---

## Additional hardening (Phase 2B.7)

Phase 2B.7 added these changes to the adapter:
- `tokenize` and `tokenToPiece` now use `withUnsafeMutableBufferPointer` for safe C array interop
- Both methods `throws` — vocab unavailability surfaces as `LlamaCppError.vocabUnavailable`
- `vocabSize` and `eosToken` now `throws` — empty vocabulary surfaces as `LlamaCppError.emptyVocabulary`
- `clearKVCache(_:)` added — wraps `llama_kv_cache_clear` for the session to call before each inference

These changes do not affect the compile flag interface. `-DLLAMA_CPP_LEGACY_API` and `-DLLAMA_CPP_NO_BACKEND_INIT` work the same as before.

---

## Compile flag reference

| Flag | Effect |
|------|--------|
| `-DLLAMA_CPP_LEGACY_API` | Use pre-b4000 API names (`llama_load_model_from_file`, `llama_new_context_with_model`, etc.) |
| `-DLLAMA_CPP_NO_BACKEND_INIT` | Skip `llama_backend_init()` call (for b4700+ builds that removed it) |

Add these in Xcode → NativeLLMRuntime target → Build Settings → Other Swift Flags.

---

## Checking your llama.cpp version

After adding the Swift Package, find the resolved version:

1. In Xcode: File → Packages → Update to Latest Package Versions (to see current)
2. Or check `ios/nativeagent.xcworkspace/xcshareddata/swiftpm/Package.resolved` for the pinned commit

The build number (e.g. `b4500`) is in the package's `Package.swift` or README. API names changed around `b3600`–`b4000`.
