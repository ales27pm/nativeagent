# NativeLLMRuntime — Phase 2A Contract

API contract, native lifecycle, unavailable states, and backend decision matrix for `native-llm-runtime`.

---

## Phase scope

**Phase 2A** establishes:
- The TypeScript API surface (all function signatures and types)
- The native module skeleton (iOS Swift + Android Kotlin)
- Real model file scanning (Documents / app files directory)
- Typed unavailable and backend-not-linked return states
- The LLM diagnostics screen

**Phase 2A does NOT include:**
- Any inference engine (no llama.cpp, no MLX, no ExecuTorch)
- Real model loading (loadModel validates file existence, returns backend-not-linked)
- Streaming, cancellation, context management
- `runInference` — it throws `LLMInferenceNotImplementedError` at all times

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
  loaded: boolean;         // always false in Phase 2A
  modelId: string;
  backend: LLMRuntimeBackend;
  message: string;
};

type UnloadModelResult = {
  unloaded: boolean;
  modelId: string;
  message: string;
};
```

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
