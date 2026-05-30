# NativeLLMRuntime — Contract (Phase 2A + 2B)

API contract, native lifecycle, unavailable states, error codes, and backend decision matrix for `native-llm-runtime`.

---

## Phase scope

**Phase 2A** established:
- The TypeScript API surface (all function signatures and types)
- The native module skeleton (iOS Swift + Android Kotlin)
- Real model file scanning (Documents / app files directory)
- Typed unavailable and backend-not-linked return states
- The LLM diagnostics screen

**Phase 2B adds:**
- `LLMBackend` Swift protocol — abstraction for swappable inference backends
- `LlamaCppBackend` — concrete backend, real llama.cpp integration (guarded by `#if canImport(llama)`)
- `LlamaCppModelSession` — owns `llama_model*` + `llama_context*`, runs greedy sampling loop
- `LlamaCppError` — typed error enum covering all failure modes
- Updated `NativeLLMRuntimeModule` — routes all calls through the backend abstraction
- Real `loadModel` validation: file exists, readable, `.gguf` extension, size > 0
- Real `loadModel` execution: `llama_load_model_from_file` when llama.cpp IS linked
- Real `runInference`: greedy token sampling loop via `llama_decode` + `llama_get_logits`
- `runInference` on iOS without llama.cpp: throws `BackendUnavailableError`
- `runInference` on Android: throws `LLMInferenceNotImplementedError` (Phase 2C)
- New TypeScript types: `RunInferenceRequest`, `RunInferenceResult`, `LLMRuntimeErrorCode`
- New TypeScript error classes: `BackendUnavailableError`, `ModelNotLoadedError`, `ModelLoadFailedError`
- `supportedFormats` field added to `LLMRuntimeHealth`

**Phase 2B does NOT include:**
- Temperature / top-P / top-K sampling (Phase 2C)
- Streaming token output (Phase 2C)
- Cancellation (Phase 2C)
- Android inference backend (Phase 2C)
- MLX Swift backend (Phase 2C)

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

// Phase 2B placeholder — always throws LLMInferenceNotImplementedError
runInference(prompt: string): Promise<never>
```

---

## Types

```typescript
type LLMRuntimeBackend =
  | 'none'        // no backend linked (Phase 2A default)
  | 'llama_cpp'   // llama.cpp via C++ FFI
  | 'mlx'         // MLX Swift (Apple Silicon only)
  | 'coreml'      // Core ML on-device
  | 'executorch'  // Meta ExecuTorch
  | 'mediapipe';  // Google MediaPipe LLM Inference

type LLMRuntimeHealth = {
  available: boolean;
  platform: 'ios' | 'android';
  backend: LLMRuntimeBackend;
  supportsStreaming: boolean;
  supportsCancellation: boolean;
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

// Phase 2B additions
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

| State | Throws |
|-------|--------|
| Sandbox / Expo Go (native module null) | `NativeLLMRuntimeUnavailableError` |
| Dev build, `runInference` not in native module (Android) | `LLMInferenceNotImplementedError` |
| Dev build iOS, llama.cpp not linked | `BackendUnavailableError` (from native) |
| Dev build iOS, llama.cpp linked, no model loaded | `ModelNotLoadedError` (from native) |
| Dev build iOS, llama.cpp linked, model loaded | Returns `RunInferenceResult` with real token output |

**No fake output is ever returned.** Any non-null `text` in `RunInferenceResult` comes from a real llama.cpp token-sampling loop.

---

## Native lifecycle

### Phase 2A lifecycle

```
App launch
  └─ isLLMRuntimeAvailable()          → false (sandbox/Expo Go) or true (dev build)
  └─ getLLMRuntimeHealth()            → available: false, backend: 'none'
  └─ listInstalledModels()            → scans Documents/ for .gguf / .bin files
  └─ loadModel({ modelId, path })     → validates file existence, returns loaded: false
  └─ unloadModel(modelId)             → clears internal state, returns unloaded: false
  └─ runInference(prompt)             → throws LLMInferenceNotImplementedError (always)
```

### Phase 2B lifecycle (planned)

```
App launch
  └─ isLLMRuntimeAvailable()          → true
  └─ getLLMRuntimeHealth()            → available: true, backend: 'llama_cpp' | 'mlx' | ...
  └─ listInstalledModels()            → real model list from Documents/
  └─ loadModel({ modelId, path })     → initializes engine context, loads weights
  └─ runInference(prompt)             → streams tokens via callback or returns string
  └─ unloadModel(modelId)             → releases engine memory
```

---

## Expected unavailable states

| Condition | `isLLMRuntimeAvailable()` | `getLLMRuntimeHealth().available` | `getLLMRuntimeHealth().reasonUnavailable` |
|-----------|:---:|:---:|---|
| Expo Go / sandbox | `false` | `false` | "Native module not linked…" |
| Dev build, Phase 2A | `true` | `false` | "No inference backend linked. Phase 2B will integrate…" |
| Dev build, Phase 2B (planned) | `true` | `true` | `null` |

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

Note: Android does not have native package formats equivalent to `.mlmodelc`. ExecuTorch uses `.pte` files — will be added in Phase 2B.

---

## Backend decision matrix

| Backend | Platform | Format | Quantization | Streaming | Notes |
|---------|----------|--------|:---:|:---:|-------|
| llama.cpp | iOS + Android | GGUF | Q4_K_M, Q8_0, F16 | Yes (callback) | Best cross-platform option; large community |
| MLX Swift | iOS only | MLX weights | Varies | Yes | Apple Silicon only; fastest on M-series |
| Core ML | iOS only | .mlmodelc / .mlpackage | INT4, INT8 | Partial | Apple-native; requires model conversion |
| ExecuTorch | Android (iOS beta) | .pte | INT8 | Yes (callback) | Meta; good for Llama family |
| MediaPipe | Android | .bin / .task | INT4, INT8 | Yes | Google; easiest Android integration |

### Recommendation

- **Phase 2B iOS**: start with `llama.cpp` via a Swift wrapper (e.g. `llama.swift`). Easiest path, widest GGUF model compatibility.
- **Phase 2B Android**: start with `llama.cpp` Android JNI. Same model files as iOS — single model download works on both platforms.
- **Phase 2C**: add MLX Swift for Apple Silicon performance path on iOS.

---

## Why fake inference is forbidden

NativeAgent is a trust-critical tool. Returning fake generated text at any layer — even as a placeholder — creates:

1. **Developer confusion** — a fake response that "works" masks the real integration gap
2. **Test contamination** — tests pass against fake output, not real inference
3. **User trust violation** — if a user receives fake AI output, the product is lying

`runInference` throws `LLMInferenceNotImplementedError` with a clear message. It will not return any string until a real inference backend is linked and validated in Phase 2B.

---

## Error types

```typescript
// Thrown when the native module is not linked (Expo Go / missing prebuild)
class NativeLLMRuntimeUnavailableError extends Error {
  name: 'NativeLLMRuntimeUnavailableError'
}

// Thrown by runInference() at all times in Phase 2A
class LLMInferenceNotImplementedError extends Error {
  name: 'LLMInferenceNotImplementedError'
}
```
