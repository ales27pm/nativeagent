# Local llama.cpp Smoke Test Guide — Phase 2B.9

Step-by-step guide for running a real local Xcode validation with the ggml-org/llama.cpp Swift Package and a small GGUF model.

---

## ⚠️ Prerequisites

- macOS with Xcode 15 or later
- CocoaPods installed: `gem install cocoapods`
- bun installed: `brew install bun`
- An iOS Simulator (ARM64) or a physical iPhone
- A GGUF model file on your Mac (see Model Placement below)

> **Vibecode preview cannot run this test.** The llama.cpp Swift Package requires a native dev build compiled in Xcode. The Vibecode preview/sandbox always shows `nativeAvailable: false` and `isLinked: false` — this is correct and expected behavior, not a bug.

---

## Step 1 — Prebuild

```bash
cd mobile
bun install
npx expo prebuild --clean
```

This generates `ios/NativeAgent.xcworkspace` with `NativeLLMRuntime` as a CocoaPods target.

**Expected:** `ios/` directory appears with `NativeAgent.xcworkspace`.

> ⚠️ Every `prebuild --clean` wipes the `ios/` directory. Any Swift Package you manually added in Xcode is lost and must be re-added after each prebuild.

---

## Step 2 — Open Xcode Workspace

```bash
open ios/NativeAgent.xcworkspace
```

Always open the `.xcworkspace` file, not `.xcodeproj`. Opening `.xcodeproj` directly bypasses CocoaPods linking.

---

## Step 3 — Add the llama.cpp Swift Package

In Xcode:

1. **File → Add Package Dependencies…**
2. Enter URL: `https://github.com/ggml-org/llama.cpp`
3. Version rule: **Exact Version** — pin to a known tested tag (e.g. `b4960`) rather than tracking "latest stable". If you use a moving branch or "Up to Next Major", llama.cpp API drift may break the Swift compile without warning. See `docs/LLAMA_CPP_API_COMPATIBILITY.md` for the flag reference.
4. Product to add: **llama**
5. Target: **NativeLLMRuntime** ← critical — NOT the main app target
6. Click **Add Package**

**Verify:** In Project Navigator → NativeLLMRuntime → Frameworks, `llama` should appear.

---

## Step 4 — Build and Run

Build via Xcode (⌘R) or:

```bash
npx expo run:ios
```

**Expected compile output:** Zero errors. The `#if canImport(llama)` guards in `LlamaCppBackend.swift`, `LlamaCppModelSession.swift`, and `LlamaCppCApiAdapter.swift` activate, compiling the real inference code path.

If you see compile errors, see the **Xcode Compile Failure Checklist** below.

---

## Step 5 — Verify Backend Status

Open the **LLM RUNTIME** screen (Diagnostics → LLM RUNTIME).

Check RUNTIME HEALTH:

| Field | Expected value |
|-------|---------------|
| `nativeAvailable` | `true` |
| `isLinked` | `true` |
| `available` | `true` |
| `backend` | `llama_cpp` |
| `supportedFormats` | `gguf` |
| `supportsQuantized` | `true` |
| `supportsStreaming` | `false` (Phase 2C) |
| `supportsCancellation` | `false` (Phase 2C) |
| `reasonUnavailable` | `null` |

If `isLinked` still shows `false` after rebuilding, the Swift Package was not added to the **NativeLLMRuntime** target — repeat Step 3.

---

## Step 6 — Place a GGUF Model

### Recommended test models

| Model | Size | RAM | Notes |
|-------|------|-----|-------|
| `Llama-3.2-1B-Instruct.Q4_K_M.gguf` | ~700 MB | ~900 MB | Best for first validation |
| `Phi-3.5-mini-instruct.Q4_K_M.gguf` | ~2.2 GB | ~2.8 GB | Better quality, needs 6 GB RAM device |

Start with the 1B model. Larger models may crash from memory pressure on simulators or older devices.

> ⚠️ Large GGUF models (>2 GB) may cause the app to be killed (signal 9) on simulators or devices with less than 6 GB RAM. If inference crashes, switch to a smaller model.

---

### Method A — Simulator: xcrun container copy (fastest)

```bash
# 1. Get the simulator data container path
xcrun simctl get_app_container booted app.ales27pm.nativeagent data
# Prints: /Users/you/Library/Developer/CoreSimulator/Devices/<uuid>/data/Containers/Data/Application/<app-uuid>

# 2. Copy your model
cp /path/to/model.gguf <printed-path>/Documents/
```

### Method B — Xcode Devices and Simulators

1. **Window → Devices and Simulators**
2. Select your device or simulator
3. Find your app under **Installed Apps**
4. Click the gear icon → **Download Container…**
5. Open the container in Finder
6. Drag the `.gguf` file into the **AppData/Documents/** folder
7. Click the gear icon → **Replace Container**

### Method C — iOS Files App (physical device only)

On a physical iPhone, NativeAgent's Documents folder is accessible via:
`iOS Files App → On My iPhone → NativeAgent`

Drag your `.gguf` file there directly.

---

## Step 7 — Load Model and Run Smoke Test

In the **DEV TOOLS — MODEL MANAGEMENT** block:

1. Paste the model's full path into **MODEL PATH**:
   - Simulator: the `Documents/model.gguf` path from Step 6A
   - Device: use the Files app to copy the path (long press → Get Info → path)
2. Tap **LOAD MODEL**

   Expected result:
   ```
   LOAD SUCCESS
   File validated and model loaded via llama.cpp.
   ```

3. Tap **SMOKE TEST** (enabled only when `isLinked = true` and a model is loaded)

   Smoke prompt: `"Q: What is 2+2? A:"`

   Expected result panel:
   ```
   SMOKE PASS  ✓ REAL NATIVE
   "4"
   backend         llama_cpp
   modelId         model.gguf
   tokensSeen      8
   tokensGenerated 3
   durationMs      312ms
   timestamp       2025-...
   [COPY RESULT]
   ```

   Any non-empty `text` from `llama_cpp` backend with `tokensGenerated > 0` is a passing result.

---

## Success Criteria

| Check | Expected |
|-------|----------|
| `nativeAvailable` | `true` |
| `isLinked` | `true` |
| `backend` | `llama_cpp` |
| `available` | `true` |
| `supportsQuantizedModels` | `true` |
| `supportsStreaming` | `false` |
| `supportsCancellation` | `false` |
| `reasonUnavailable` | `null` |
| LOAD MODEL result | `loaded: true` |
| `loadedModelId` | filename of the loaded model |
| SMOKE TEST `text` | non-empty string |
| SMOKE TEST `tokensGenerated` | > 0 |
| SMOKE TEST `backend` | `llama_cpp` |
| REAL NATIVE badge | visible |
| Repeated smoke tests | clean output each time (fresh context per inference) |

---

## Expected Failure States

| Condition | What the UI shows |
|-----------|------------------|
| llama.cpp not linked | `isLinked: false`, SMOKE TEST disabled, `reasonUnavailable` set |
| Model path empty | LOAD ERROR — "Enter a model file path first." |
| File not found | LOAD ERROR — file not found message |
| Wrong extension (not .gguf) | LOAD ERROR — invalid format message |
| File unreadable | LOAD ERROR — file not readable message |
| File empty (0 bytes) | LOAD ERROR — file empty message |
| Context init failure | SMOKE ERROR — context init failed |
| Inference already running | SMOKE ERROR — inference busy |
| Decode failure | SMOKE ERROR — decode failure message |
| Invalid logits (null) | SMOKE ERROR — invalid logits message |
| Vocab unavailable | LOAD ERROR — vocab unavailable |
| Empty vocabulary | LOAD ERROR — empty vocabulary |

---

## Xcode Compile Failure Checklist

### "No such module 'llama'"
**Cause:** Swift Package added to wrong target (main app instead of NativeLLMRuntime).
**Fix:** In Xcode, select the NativeLLMRuntime target → Frameworks & Libraries. If `llama` is missing, repeat Step 3 and explicitly select **NativeLLMRuntime** as the target.

---

### "use of undeclared identifier 'llama_model_load_from_file'"
**Cause:** Your pinned llama.cpp version uses legacy API names (pre-b4000).
**Fix:** In NativeLLMRuntime target → Build Settings → Other Swift Flags, add:
```
-DLLAMA_CPP_LEGACY_API
```

---

### "use of undeclared identifier 'llama_init_from_model'"
**Cause:** Same as above — legacy API names.
**Fix:** Same — add `-DLLAMA_CPP_LEGACY_API`.

---

### "use of undeclared identifier 'llama_model_get_vocab'"
**Cause:** Very old version (pre-vocab-pointer split).
**Fix:** Add `-DLLAMA_CPP_LEGACY_API`.

---

### "use of undeclared identifier 'llama_backend_init'"
**Cause:** Your llama.cpp version (b4700+) removed `llama_backend_init()`.
**Fix:** In Other Swift Flags, add:
```
-DLLAMA_CPP_NO_BACKEND_INIT
```

---

### "use of undeclared identifier 'llama_kv_cache_clear'"
**Cause:** This symbol is no longer called. Phase 2B.8 replaced KV cache reset with fresh-context-per-inference. If you see this error, your source has stale code from Phase 2B.7.
**Fix:** Remove any call to `llama_kv_cache_clear` from `LlamaCppCApiAdapter.swift`. It is not needed — a fresh `llama_context` is created in each `generate()` call.

---

### "Undefined symbols for architecture arm64: llama_model_load_from_file"
**Cause:** Package added but not linked. Xcode resolved the package but did not add it to Link Binary With Libraries.
**Fix:** Clean build (⌘⇧K) and rebuild. If it persists, verify `llama` appears in **Link Binary With Libraries** for the NativeLLMRuntime target.

---

### Swift Package not attached to NativeLLMRuntime target
**Cause:** Package was attached to the main app target, not the NativeLLMRuntime module target.
**Fix:** Remove the package from the wrong target. Re-add it with target = **NativeLLMRuntime**.

---

### prebuild --clean wiped manual package wiring
**Cause:** `npx expo prebuild --clean` regenerates the entire `ios/` directory, erasing manually added Swift Packages.
**Fix:** This is expected. After every prebuild, re-add the Swift Package (Step 3). A production fix (config plugin or vendored xcframework) is planned for a later phase.

---

### "Cannot find type 'llama_model' in scope"
**Cause:** C++ interop header not bridging.
**Fix:** In NativeLLMRuntime target → Build Settings:
```
Other C++ Flags → -std=c++17
```

---

### ARM64 simulator architecture mismatch
**Cause:** Running on Intel Mac simulator.
**Fix:** In NativeLLMRuntime Build Settings:
```
Excluded Architectures [iphonesimulator] → x86_64
```

---

## Memory Pressure Reference

| Device RAM | Safe model size |
|------------|----------------|
| 4 GB | 1B Q4_K_M (~900 MB) |
| 6 GB | 3B Q4_K_M (~1.8 GB) |
| 8 GB+ | 7B Q4_K_M (~4 GB) |

For Phase 2B.9 validation, always start with a 1B Q4_K_M model.
