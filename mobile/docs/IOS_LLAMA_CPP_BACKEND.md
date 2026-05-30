# iOS llama.cpp Backend — Phase 2B

Implementation guide for the llama.cpp inference backend on iOS.

---

## Why llama.cpp first

| Factor | llama.cpp | MLX Swift | Core ML |
|--------|-----------|-----------|---------|
| Model format | GGUF (universal) | MLX weights | .mlmodelc / .mlpackage |
| Model availability | Thousands on HuggingFace | Growing | Requires Apple conversion |
| Platform | iOS + Android | iOS only (Apple Silicon) | iOS only |
| Quantization | Q4_0, Q4_K_M, Q8_0, F16 | Varies | INT4, INT8 |
| Phase 2B viability | High | Medium | Low (conversion toolchain) |

llama.cpp wins Phase 2B because:
1. GGUF models are already scanned and discovered by `listInstalledModels()`
2. It is the most widely battle-tested on-device inference engine
3. It runs on the same `.gguf` files on both iOS and Android (consistent model format)
4. The Swift Package exists and integrates cleanly with Expo Modules API

---

## Architecture

```
NativeLLMRuntimeModule.swift
  └─ LlamaCppBackend (conforms to LLMBackend protocol)
       └─ LlamaCppModelSession (owns llama_model* + llama_context*)
            └─ Real llama.cpp C API calls
                 ├─ llama_load_model_from_file()
                 ├─ llama_new_context_with_model()
                 ├─ llama_tokenize()
                 ├─ llama_decode()
                 ├─ llama_get_logits() — greedy sampling (Phase 2B)
                 └─ llama_token_to_piece()
```

All llama.cpp-specific code is guarded by `#if canImport(llama)`. Without the Swift Package linked, this code is excluded from the binary at compile time and the backend honestly reports `isLinked = false`.

---

## Expected GGUF model format

llama.cpp loads `.gguf` files (GGML Unified Format). These are quantized weight files produced by `llama.cpp`'s `convert_hf_to_gguf.py` script or downloaded pre-quantized from HuggingFace.

Recommended quantizations for mobile:
| Quantization | Size/B param | Quality | RAM ~3B model |
|---|---|---|---|
| Q4_K_M | ~2.3 GB/7B | Good | ~1.8 GB |
| Q4_0 | ~2.0 GB/7B | OK | ~1.6 GB |
| Q8_0 | ~4.1 GB/7B | Very good | ~3.3 GB |

For iOS testing in Phase 2B, use a small model:
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
xcrun simctl get_app_container booted <bundle-id> data
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

The scanner skips hidden files and does not recurse into `.mlmodelc`/`.mlpackage` directories (treated as single opaque units). For each model, it returns: id, name, localPath, format, sizeBytes, discoveredAt (ISO 8601).

---

## How loadModel validation works

`loadModel(request)` performs these checks in order, regardless of whether llama.cpp is linked:

1. **File exists** — `FileManager.fileExists(atPath:)` → throws `LlamaCppError.fileNotFound`
2. **File readable** — `FileManager.isReadableFile(atPath:)` → throws `LlamaCppError.fileNotReadable`
3. **Extension is .gguf** — throws `LlamaCppError.invalidFormat(expected: "gguf", got: …)`
4. **Size > 0 bytes** — throws `LlamaCppError.fileEmpty`

If all checks pass and llama.cpp IS linked:
5. **`llama_load_model_from_file`** — loads weights into RAM. Returns `LoadModelResult { loaded: true }`

If all checks pass and llama.cpp is NOT linked:
5. Returns `LoadModelResult { loaded: false, message: "File validated — llama.cpp not linked" }`

---

## How backend health works

`getLLMRuntimeHealth()` returns:

| Condition | `backend` | `available` | `reasonUnavailable` |
|-----------|-----------|-------------|---------------------|
| Sandbox (no native module) | `'none'` | `false` | "Native module not linked…" |
| Dev build, llama.cpp not linked | `'none'` | `false` | "llama.cpp Swift Package is not linked…" |
| Dev build, llama.cpp linked | `'llama_cpp'` | `true` | `null` |

---

## How to link llama.cpp locally

### Step 1 — Prebuild

```bash
cd mobile
npx expo prebuild --clean
```

This generates `ios/<ProjectName>.xcworkspace` with `NativeLLMRuntime` as a CocoaPod.

### Step 2 — Open Xcode

```bash
open ios/<ProjectName>.xcworkspace
```

### Step 3 — Add Swift Package

In Xcode:
1. **File → Add Package Dependencies…**
2. Enter URL: `https://github.com/ggml-org/llama.cpp`
3. Set version rule: **Up to Next Major** from the latest stable tag
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
```

---

## Known iOS build gotchas

### Gotcha 1 — Wrong target for the Swift Package

The llama Swift Package must be added to the **NativeLLMRuntime** target, not the main app target. If you add it to the wrong target, the module won't compile.

### Gotcha 2 — C++ interop

llama.cpp internally uses C++. Xcode may warn about C++ standard settings. If you see build errors about `c++17` or `c++20`, add this to the NativeLLMRuntime target's build settings:
```
OTHER_CPLUSPLUSFLAGS = -std=c++17
```

### Gotcha 3 — ARM64 simulator only

llama.cpp builds for ARM64. If your Mac is Intel and you run on a simulator, you may hit architecture mismatches. Workaround: test on a physical device, or add `EXCLUDED_ARCHS[sdk=iphonesimulator*] = x86_64` to the target build settings.

### Gotcha 4 — Memory pressure on small devices

Running a 3B+ model on an iPhone with 4 GB RAM may cause the OS to kill the app. Use the smallest model that meets your quality bar (Q4_K_M quantization of a 1B model recommended for development).

### Gotcha 5 — llama.cpp API versions

The llama.cpp API evolves between releases. `LlamaCppModelSession.swift` uses the stable API surface as of mid-2025. If you pin to a newer version, check:
- `llama_load_model_from_file` → may become `llama_model_load_from_file`
- `llama_new_context_with_model` → may become `llama_init_from_model`
- `llama_free_model` → may become `llama_model_free`

The `#if canImport(llama)` guard means you'll get a compile error if these change, not a runtime crash.

---

## Greedy sampling (Phase 2B)

Phase 2B uses argmax (greedy) sampling: at each step, pick the token with the highest logit. This is deterministic and simple but produces repetitive output for long sequences.

Phase 2C will add:
- Temperature scaling
- Top-P (nucleus) sampling
- Top-K sampling
- Repetition penalties
- The llama.cpp sampler chain API

---

## Next steps for streaming inference (Phase 2C)

Phase 2B returns the complete generated text after all tokens are sampled. Phase 2C will add token-by-token streaming via:

1. Add `AsyncStream<String>` return type to `runInference`
2. Yield each `llama_token_to_piece` result as it is sampled
3. Expose streaming via an `EventEmitter` in the Expo module (or React Native's event bridge)
4. Cancel support via a `Task` flag checked in the sample loop

---

## Link validation (Phase 2B.5)

After linking llama.cpp and placing a `.gguf` model, use the **LLM Diagnostics → DEV TOOLS** section to validate end-to-end:

1. Paste the model's absolute path in the MODEL PATH input
2. Tap **LOAD MODEL** → expect `LOAD SUCCESS`
3. Tap **SMOKE TEST** → sends `"Q: What is 2+2? A:"` to `runInference`

The SMOKE TEST button is enabled only when `isLinked = true` and a model is loaded. It will never fire fake inference.

Full walkthrough: `docs/IOS_LLAMA_CPP_LINK_VALIDATION.md`

---

## Common compile errors

### "No such module 'llama'"
The Swift Package was added to the wrong Xcode target. It must be added to **NativeLLMRuntime**, not the main app target. Remove it from the wrong target and re-add.

### "Cannot find type 'llama_model' in scope"
C++ interop issue. In NativeLLMRuntime target Build Settings:
```
Other C++ Flags → -std=c++17
```

### "Undefined symbol: llama_load_model_from_file"
Clean build (⌘⇧K) and rebuild. If it persists, verify `llama` appears in **Link Binary With Libraries** for the NativeLLMRuntime target.

### Architecture mismatch on Intel Mac simulator
```
Excluded Architectures [iphonesimulator] → x86_64
```

### llama.cpp API renamed between releases
Post-mid-2025 releases may rename:
- `llama_load_model_from_file` → `llama_model_load_from_file`
- `llama_new_context_with_model` → `llama_init_from_model`
- `llama_free_model` → `llama_model_free`

The `#if canImport(llama)` guard means mismatches produce compile errors, not runtime crashes.

---

## Memory pressure warning

Running large models on mobile can exhaust RAM and cause the OS to kill the app silently (no crash log). Guidelines:

| Device RAM | Max safe model size |
|------------|---------------------|
| 4 GB | 1B Q4_K_M (~900 MB) |
| 6 GB | 3B Q4_K_M (~1.8 GB) |
| 8 GB+ | 7B Q4_K_M (~4 GB) |

For Phase 2B validation, always start with a 1B Q4_K_M model. If the app disappears mid-inference, reduce model size.

---

## Testing without a device

If you don't have an iOS device and can't link llama.cpp in the Vibecode sandbox:

1. The LLM diagnostics screen shows `backend: none`, `available: false` with a clear reason
2. `loadModel()` still runs full file validation (finds file, checks extension, checks size)
3. `runInference()` throws `BackendUnavailableError` with a clear message
4. No fake output is ever produced

This lets you test the entire model management flow (discovery, validation, load/unload) without ever needing a real inference backend linked.
