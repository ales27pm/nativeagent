# NativeLLMRuntime — Contract

API contract, native lifecycle, unavailable states, error codes, and backend decision matrix for `native-llm-runtime`.

---

## Phase scope

**Phase 2A** established:
- The TypeScript API surface (all function signatures and types)
- The native module skeleton (iOS Swift + Android Kotlin)
- Real model file scanning (Documents / app files directory)
- Typed unavailable and backend-not-linked return states
- The LLM diagnostics screen

**Phase 2B added:**
- `LLMBackend` Swift protocol — abstraction for swappable inference backends
- `LlamaCppBackend` — concrete backend, real llama.cpp integration (guarded by `#if canImport(llama)`)
- `LlamaCppModelSession` — owns `llama_model*` + `llama_context*`, runs greedy sampling loop
- `LlamaCppError` — typed error enum covering all failure modes
- Updated `NativeLLMRuntimeModule` — routes all calls through the backend abstraction
- Real `loadModel` validation: file exists, readable, `.gguf` extension, size > 0
- Real `loadModel` execution: `llama_model_load_from_file` when llama.cpp IS linked
- Real `runInference`: greedy token sampling loop via `llama_decode` + `llama_get_logits`
- `runInference` on iOS without llama.cpp: throws `BackendUnavailableError`
- New TypeScript types: `RunInferenceRequest`, `RunInferenceResult`, `LLMRuntimeErrorCode`
- New TypeScript error classes: `BackendUnavailableError`, `ModelNotLoadedError`, `ModelLoadFailedError`
- `supportedFormats` field added to `LLMRuntimeHealth`

**Phase 2B.5 added:**
- `isLinked: boolean` in `LLMRuntimeHealth`
- `durationMs: number` in `RunInferenceResult`
- Updated LLM Diagnostics: `isLinked` row, backend linked status, GGUF ready row
- DEV TOOLS block: model path input, Load/Unload/Smoke Test buttons
- `docs/IOS_LLAMA_CPP_LINK_VALIDATION.md`

**Phase 2B.6 adds:**
- `LlamaCppCApiAdapter.swift` — isolates llama.cpp API version differences
- `LlamaCppModelSession.swift` updated to call adapter methods only
- `supportsStreaming` fixed to `false` (was incorrectly `isLinked`)
- `supportedFormats` now `['gguf']` when linked, `[]` when not linked
- `llama_backend_init()` one-time call via adapter static initializer
- Android stale messages updated
- `docs/LLAMA_CPP_API_COMPATIBILITY.md` — API version drift reference
- App config naming hardened (name, slug, scheme, bundleIdentifier, package)

**Phase 2B.7 adds:**
- `supportsQuantizedModels` fixed to `isLinked` (was incorrectly `true` when not linked)
- `LlamaCppCApiAdapter.tokenize` / `tokenToPiece` — use `withUnsafeMutableBufferPointer`, throw typed errors
- New `LlamaCppError` cases: `vocabUnavailable`, `emptyVocabulary`, `detokenizationFailed`, `invalidLogits`, `inferenceBusy`
- `LlamaCppModelSession` — vocab size and EOS token validated and cached at init; fails fast on corrupt/empty vocab
- KV cache reset (`llama_kv_cache_clear`) before every inference — prevents stale state from prior runs
- Inference serialization via `NSLock` — throws `inferenceBusy` if inference is already running
- LLM Diagnostics phase tag updated to "PHASE 2B.7 — iOS COMPILE HARDENING"
- Android diagnostics no longer reference Phase 2C for the Android backend

**Not included in Phase 2B:**
- Temperature / top-P / top-K sampling (Phase 2C, iOS)
- Streaming token output (Phase 2C, iOS)
- Cancellation (Phase 2C, iOS)
- Android inference backend (dedicated future phase, not Phase 2C)
- MLX Swift backend (future phase)

---

## TypeScript API

```typescript
// Sync — safe to call anywhere, does not cross native bridge
isLLMRuntimeAvailable(): boolean

// All async functions cross the native bridge.
// When the native module is not linked, getLLMRuntimeHealth() returns a safe
// JS-layer offline value instead of throwing. All others throw
// NativeLLMRuntimeUnavailableError when the module is not linked.

getLLMRuntimeHealth(): Promise<LLMRuntimeHealth>
listInstalledModels(): Promise<InstalledLLMModel[]>
loadModel(request: LoadModelRequest): Promise<LoadModelResult>
unloadModel(modelId: string): Promise<UnloadModelResult>
runInference(request: RunInferenceRequest): Promise<RunInferenceResult>
```

---

## Types

```typescript
type LLMRuntimeBackend =
  | 'none'        // no backend linked
  | 'llama_cpp'   // llama.cpp via C++ FFI
  | 'mlx'         // MLX Swift (Apple Silicon only)
  | 'coreml'      // Core ML on-device
  | 'executorch'  // Meta ExecuTorch
  | 'mediapipe';  // Google MediaPipe LLM Inference

type LLMRuntimeHealth = {
  available: boolean;
  isLinked: boolean;
  platform: 'ios' | 'android';
  backend: LLMRuntimeBackend;
  supportsStreaming: boolean;       // false until Phase 2C
  supportsCancellation: boolean;   // false until Phase 2C
  supportsQuantizedModels: boolean;
  supportedFormats: Array<'gguf' | 'mlmodelc' | 'mlpackage' | 'bin' | 'unknown'>;
  loadedModelId: string | null;
  reasonUnavailable: string | null;
};

type InstalledLLMModel = {
  id: string;          // filename (e.g. "llama-3.2-1b.gguf")
  name: string;        // filename without extension
  localPath: string;   // absolute path on device
  format: 'gguf' | 'mlmodelc' | 'mlpackage' | 'bin' | 'unknown';
  sizeBytes: number;
  discoveredAt: string; // ISO 8601
};

type LoadModelRequest = {
  modelId: string;
  localPath: string;
  preferredBackend?: LLMRuntimeBackend;
  contextLength?: number;
};

type LoadModelResult = {
  loaded: boolean;         // true only when llama.cpp is linked and file loads successfully
  modelId: string;
  backend: LLMRuntimeBackend;
  message: string;
};

type RunInferenceRequest = {
  modelId: string;
  prompt: string;
  maxTokens?: number;      // default 256
  temperature?: number;    // Phase 2C (greedy only in 2B)
  topP?: number;           // Phase 2C
  stopSequences?: string[];
};

type RunInferenceResult = {
  text: string;            // real token output — never fake
  tokensGenerated: number;
  tokensSeen: number;
  durationMs: number;
  backend: LLMRuntimeBackend;
  modelId: string;
};

type LLMRuntimeErrorCode =
  | 'BACKEND_UNAVAILABLE'
  | 'MODEL_NOT_LOADED'
  | 'MODEL_LOAD_FAILED'
  | 'INFERENCE_NOT_IMPLEMENTED'
  | 'FILE_NOT_FOUND'
  | 'INVALID_FORMAT'
  | 'FILE_NOT_READABLE'
  | 'RUNTIME_UNAVAILABLE';

type UnloadModelResult = {
  unloaded: boolean;
  modelId: string;
  message: string;
};
```

---

## Error types

```typescript
class NativeLLMRuntimeUnavailableError  // code: 'RUNTIME_UNAVAILABLE'
class BackendUnavailableError           // code: 'BACKEND_UNAVAILABLE' — module linked but backend not
class ModelNotLoadedError               // code: 'MODEL_NOT_LOADED'
class ModelLoadFailedError              // code: 'MODEL_LOAD_FAILED'
class LLMInferenceNotImplementedError   // code: 'INFERENCE_NOT_IMPLEMENTED'
```

---

## runInference contract

`runInference(request)` call path:

| State | Result |
|-------|--------|
| Sandbox / Expo Go (native module null) | throws `NativeLLMRuntimeUnavailableError` |
| Dev build, Android | throws `LLMInferenceNotImplementedError` |
| Dev build iOS, llama.cpp not linked | throws `BackendUnavailableError` (from native) |
| Dev build iOS, llama.cpp linked, no model loaded | throws `ModelNotLoadedError` (from native) |
| Dev build iOS, llama.cpp linked, model loaded | returns `RunInferenceResult` with real token output |

**No fake output is ever returned.** Any non-null `text` in `RunInferenceResult` comes from a real llama.cpp token-sampling loop.

---

## Native lifecycle

### Current state (Phase 2B.7)

```
App launch
  └─ isLLMRuntimeAvailable()          → false (sandbox/Expo Go) or true (dev build)
  └─ getLLMRuntimeHealth()            → iOS: available: false/true, backend: 'none'/'llama_cpp'
                                         Android: available: false, backend: 'none'
  └─ listInstalledModels()            → scans Documents/ for .gguf / .bin files
  └─ loadModel({ modelId, path })     → iOS: validates + loads if llama.cpp linked
                                         Android: validates file, returns loaded: false
  └─ unloadModel(modelId)             → clears session, frees memory (iOS), clears state (Android)
  └─ runInference(request)            → iOS+linked: real greedy inference
                                         iOS unlinked: throws BackendUnavailableError
                                         Android: throws LLMInferenceNotImplementedError
```

---

## Expected unavailable states

| Condition | `isLLMRuntimeAvailable()` | `getLLMRuntimeHealth().available` | `supportsStreaming` |
|-----------|:---:|:---:|:---:|
| Expo Go / sandbox | `false` | `false` | `false` |
| Dev build, llama.cpp not linked (iOS) | `true` | `false` | `false` |
| Dev build, llama.cpp linked (iOS) | `true` | `true` | `false` |
| Dev build (Android) | `true` | `false` | `false` |

`supportsStreaming` is always `false` until Phase 2C implements real token streaming.

---

## Model scanning

### iOS
Scans `NSDocumentDirectory` recursively.

Supported file formats discovered:
- `.gguf` — GGML/llama.cpp quantized model
- `.bin` — raw weights (various formats)
- `.mlmodelc` — compiled Core ML model package (directory, not recursed)
- `.mlpackage` — Core ML model package (directory, not recursed)

### Android
Scans `context.filesDir` recursively.

Supported file formats discovered:
- `.gguf` — GGML/llama.cpp quantized model
- `.bin` — raw weights (various formats)

---

## Backend decision matrix

| Backend | Platform | Format | Quantization | Streaming | Status |
|---------|----------|--------|:---:|:---:|-------|
| llama.cpp | iOS (linked) | GGUF | Q4_K_M, Q8_0, F16 | Phase 2C (iOS) | Real inference on iOS |
| llama.cpp | Android | GGUF | — | — | Planned (dedicated Android phase) |
| MLX Swift | iOS only | MLX weights | Varies | Phase 2C (iOS) | Planned (future phase) |
| Core ML | iOS only | .mlmodelc / .mlpackage | INT4, INT8 | Partial | Planned (future phase) |
| ExecuTorch | Android (iOS beta) | .pte | INT8 | — | Planned (future phase) |
| MediaPipe | Android | .bin / .task | INT4, INT8 | — | Planned (future phase) |

---

## Why fake inference is forbidden

NativeAgent is a trust-critical tool. Returning fake generated text at any layer — even as a placeholder — creates:

1. **Developer confusion** — a fake response that "works" masks the real integration gap
2. **Test contamination** — tests pass against fake output, not real inference
3. **User trust violation** — if a user receives fake AI output, the product is lying

`runInference` throws errors with clear messages. It does not return any string unless a real inference backend is linked, a model is loaded, and the greedy sampling loop produces actual tokens.
