# iOS llama.cpp Backend — Phase 2B / 2B.8

Implementation guide for the llama.cpp inference backend on iOS.

---

## Why llama.cpp first

| Factor | llama.cpp | MLX Swift | Core ML |
|--------|-----------|-----------|---------|
| Model format | GGUF (universal) | MLX weights | .mlmodelc / .mlpackage |
| Model availability | Thousands on HuggingFace | Growing | Requires Apple conversion |
| Platform | iOS + Android (future) | iOS only (Apple Silicon) | iOS only |
| Quantization | Q4_0, Q4_K_M, Q8_0, F16 | Varies | INT4, INT8 |

llama.cpp wins because:
1. GGUF models are already scanned and discovered by `listInstalledModels()`
2. It is the most widely battle-tested on-device inference engine
3. The Swift Package integrates cleanly with Expo Modules API

---

## Architecture

```
NativeLLMRuntimeModule.swift
  └─ LlamaCppBackend (conforms to LLMBackend protocol)
       └─ LlamaCppCApiAdapter (stable API layer — handles version drift)
            └─ LlamaCppModelSession (owns llama_model* + llama_context*)
                 └─ Real llama.cpp C API calls via adapter
```

All llama.cpp-specific code is guarded by `#if canImport(llama)`. Without the Swift Package linked, this code is excluded from the binary at compile time and the backend honestly reports `isLinked = false`.

See `docs/LLAMA_CPP_API_COMPATIBILITY.md` for the full API version matrix and how to resolve compile errors from API drift.

---

## Expected GGUF model format

llama.cpp loads `.gguf` files (GGML Unified Format). These are quantized weight files produced by `llama.cpp`'s `convert_hf_to_gguf.py` script or downloaded pre-quantized from HuggingFace.

Recommended quantizations for mobile:
| Quantization | Size/7B params | Quality | RAM ~3B model |
|---|---|---|---|
| Q4_K_M | ~2.3 GB | Good | ~1.8 GB |
| Q4_0 | ~2.0 GB | OK | ~1.6 GB |
| Q8_0 | ~4.1 GB | Very good | ~3.3 GB |

For iOS testing, use a small model:
- `Llama-3.2-1B-Instruct.Q4_K_M.gguf` (~700 MB) — fits in iPhone RAM
- `Phi-3.5-mini-instruct.Q4_K_M.gguf` (~2.2 GB) — good quality, larger device needed

---

## Where to place models

Models must be placed in the app's Documents directory. This directory is app-sandboxed and accessible to the Swift `FileManager`.

**Path on simulator:**
```
~/Library/Developer/CoreSimulator/Devices/<device-uuid>/data/Containers/Data/Application/<app-uuid>/Documents/
```

**Path on device (via Files app):**
In iOS Settings → NativeAgent → Files → Documents, or transfer via Xcode Device Manager.

**Quickest method for testing:**
```bash
# Copy a .gguf file into a running simulator's Documents
xcrun simctl get_app_container booted app.ales27pm.nativeagent data
# → prints the data container path
# then: cp model.gguf <data-path>/Documents/
```

---

## How model discovery works

`listInstalledModels()` scans `NSDocumentDirectory` recursively. It discovers:

| Extension | Format reported | Notes |
|-----------|----------------|-------|
| `.gguf` | `gguf` | Primary llama.cpp format |
| `.bin` | `bin` | Raw weights (some older formats) |
| `.mlmodelc` | `mlmodelc` | Core ML compiled package (directory) |
| `.mlpackage` | `mlpackage` | Core ML source package (directory) |

The scanner skips hidden files and does not recurse into `.mlmodelc`/`.mlpackage` directories. For each model, it returns: id, name, localPath, format, sizeBytes, discoveredAt (ISO 8601).

---

## How loadModel validation works

`loadModel(request)` performs these checks in order, regardless of whether llama.cpp is linked:

1. **File exists** — `FileManager.fileExists(atPath:)` → throws `LlamaCppError.fileNotFound`
2. **File readable** — `FileManager.isReadableFile(atPath:)` → throws `LlamaCppError.fileNotReadable`
3. **Extension is .gguf** — throws `LlamaCppError.invalidFormat(expected: "gguf", got: …)`
4. **Size > 0 bytes** — throws `LlamaCppError.fileEmpty`

If all checks pass and llama.cpp IS linked:
5. Calls `LlamaCppCApiAdapter.loadModel(path:params:)` → loads weights into RAM. Returns `loaded: true`

If all checks pass and llama.cpp is NOT linked:
5. Returns `loaded: false, message: "File validated — llama.cpp not linked"`

---

## How backend health works

`getLLMRuntimeHealth()` returns:

| Condition | `backend` | `available` | `supportsStreaming` |
|-----------|-----------|-------------|---------------------|
| Sandbox (no native module) | `'none'` | `false` | `false` |
| Dev build, llama.cpp not linked | `'none'` | `false` | `false` |
| Dev build, llama.cpp linked | `'llama_cpp'` | `true` | `false` |

`supportsStreaming` is always `false` until Phase 2C implements real token streaming.

---

## ⚠️ Manual linking risk

Adding the llama.cpp Swift Package in Xcode is **manual**. Running `npx expo prebuild --clean` regenerates the `ios/` directory and wipes all manually added Package targets. You must re-add the Swift Package after every prebuild.

**After every `npx expo prebuild --clean`:**

1. Re-open `ios/NativeAgent.xcworkspace`
2. File → Add Package Dependencies → `https://github.com/ggml-org/llama.cpp`
3. Product: **llama**, Target: **NativeLLMRuntime**
4. Rebuild

A production-grade fix (Expo config plugin, xcframework vendoring, or SPM source vendoring into the repo) is planned for a later phase when llama.cpp is ready for production use.

---

## How to link llama.cpp locally

### Step 1 — Prebuild

```bash
cd mobile
npx expo prebuild --clean
```

This generates `ios/NativeAgent.xcworkspace` with `NativeLLMRuntime` as a CocoaPod.

### Step 2 — Open Xcode

```bash
open ios/NativeAgent.xcworkspace
```

### Step 3 — Add Swift Package

In Xcode:
1. **File → Add Package Dependencies…**
2. Enter URL: `https://github.com/ggml-org/llama.cpp`
3. Version rule: **Exact Version** — pin to a known tested tag (e.g. `b4960`). Tracking "latest stable" or master risks silent API drift that breaks the Swift compile. See `docs/LLAMA_CPP_API_COMPATIBILITY.md` for the flag reference.
4. Select product: **llama**
5. Target: **NativeLLMRuntime** (the local module target, NOT the main app target)
6. Click **Add Package**

### Step 4 — Rebuild

```bash
npx expo run:ios
```

Or build and run from Xcode.

### Step 5 — Verify

Open the LLM Diagnostics screen. Check:
```
backend    → llama_cpp   (green)
available  → true        (green)
isLinked   → true        (green)
```

---

## Known iOS build gotchas

### Gotcha 1 — Wrong target for the Swift Package

The llama Swift Package must be added to the **NativeLLMRuntime** target, not the main app target.

### Gotcha 2 — C++ interop

llama.cpp internally uses C++. If you see build errors about `c++17` or `c++20`, add to the NativeLLMRuntime target's build settings:
```
OTHER_CPLUSPLUSFLAGS = -std=c++17
```

### Gotcha 3 — ARM64 simulator only

llama.cpp builds for ARM64. On Intel Macs, add to the target build settings:
```
EXCLUDED_ARCHS[sdk=iphonesimulator*] = x86_64
```

### Gotcha 4 — Memory pressure on small devices

Use the smallest model that meets your quality bar (Q4_K_M quantization of a 1B model recommended for development).

### Gotcha 5 — llama.cpp API version drift

`LlamaCppCApiAdapter.swift` isolates all API version differences. If the current API names (`llama_model_load_from_file`, `llama_init_from_model`, etc.) cause compile errors with your pinned version, add:
```
Other Swift Flags → -DLLAMA_CPP_LEGACY_API
```
See `docs/LLAMA_CPP_API_COMPATIBILITY.md` for the full matrix.

### Gotcha 6 — llama_backend_init removed

Very new llama.cpp builds (b4700+) removed `llama_backend_init()`. If you see "use of undeclared identifier 'llama_backend_init'", add:
```
Other Swift Flags → -DLLAMA_CPP_NO_BACKEND_INIT
```

---

## Inference context isolation (Phase 2B.8)

Each `runInference` call creates a fresh `llama_context` and frees it when the call returns. The `llama_model` stays loaded across multiple calls — only the context is recreated.

**Why:** `llama_kv_cache_clear()` (the previous approach) varies in availability across llama.cpp package releases; calling it risked a compile error. Creating a fresh context is always safe and always produces clean state.

**Tradeoff:** Context creation adds latency per inference call. For Phase 2B smoke testing this is acceptable. Phase 2C may re-introduce context reuse once a stable memory-reset strategy is confirmed against the linked package version.

---

## Greedy sampling (Phase 2B)

Phase 2B uses argmax (greedy) sampling: at each step, pick the token with the highest logit.

Phase 2C (iOS) will add:
- Temperature scaling
- Top-P (nucleus) sampling
- Top-K sampling
- Repetition penalties
- The llama.cpp sampler chain API
- Token-by-token streaming
- Cancellation support

Android inference is planned for a dedicated future phase separate from Phase 2C.

---

## Current capability flags

| Flag | Phase 2B value | Changes in |
|------|---------------|------------|
| `supportsStreaming` | `false` | Phase 2C |
| `supportsCancellation` | `false` | Phase 2C |
| `supportsQuantizedModels` | `true` | — |
| `supportedFormats` | `['gguf']` when linked, `[]` when not | — |

---

## Link validation (Phase 2B.5)

After linking llama.cpp and placing a `.gguf` model, use the **LLM Diagnostics → DEV TOOLS** section to validate end-to-end:

1. Paste the model's absolute path in the MODEL PATH input
2. Tap **LOAD MODEL** → expect `LOAD SUCCESS`
3. Tap **SMOKE TEST** → sends `"Q: What is 2+2? A:"` to `runInference`

The SMOKE TEST button is enabled only when `isLinked = true` and a model is loaded.

Full walkthrough: `docs/IOS_LLAMA_CPP_LINK_VALIDATION.md`

---

## Common compile errors

### "No such module 'llama'"
The Swift Package was added to the wrong Xcode target. It must be added to **NativeLLMRuntime**, not the main app target.

### "Cannot find type 'llama_model' in scope"
C++ interop issue. In NativeLLMRuntime target Build Settings:
```
Other C++ Flags → -std=c++17
```

### "use of undeclared identifier 'llama_model_load_from_file'"
Your pinned llama.cpp version uses legacy API names. Add to Other Swift Flags:
```
-DLLAMA_CPP_LEGACY_API
```

### "use of undeclared identifier 'llama_backend_init'"
Your llama.cpp version removed this call. Add to Other Swift Flags:
```
-DLLAMA_CPP_NO_BACKEND_INIT
```

### "Undefined symbol: llama_model_load_from_file"
Clean build (⌘⇧K) and rebuild. Verify `llama` appears in **Link Binary With Libraries** for the NativeLLMRuntime target.

### Architecture mismatch on Intel Mac simulator
```
Excluded Architectures [iphonesimulator] → x86_64
```

---

## Memory pressure warning

| Device RAM | Max safe model size |
|------------|---------------------|
| 4 GB | 1B Q4_K_M (~900 MB) |
| 6 GB | 3B Q4_K_M (~1.8 GB) |
| 8 GB+ | 7B Q4_K_M (~4 GB) |

For Phase 2B validation, always start with a 1B Q4_K_M model.

---

## Testing without a device

If you don't have an iOS device and can't link llama.cpp in the Vibecode sandbox:

1. The LLM diagnostics screen shows `backend: none`, `available: false` with a clear reason
2. `loadModel()` still runs full file validation (finds file, checks extension, checks size)
3. `runInference()` throws `BackendUnavailableError` with a clear message
4. No fake output is ever produced
