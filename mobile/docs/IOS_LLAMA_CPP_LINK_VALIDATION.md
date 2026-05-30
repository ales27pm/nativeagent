# iOS llama.cpp — Link Validation Guide (Phase 2B.5 / 2B.6)

Step-by-step validation that the llama.cpp Swift Package is correctly linked, a GGUF model loads, and greedy inference returns real output.

---

## Prerequisites

- macOS with Xcode 15+
- CocoaPods installed (`gem install cocoapods`)
- An iOS Simulator (ARM64 recommended) or physical iPhone

---

## Step 1 — Prebuild

```bash
cd mobile
npx expo prebuild --clean
```

This generates `ios/nativeagent.xcworkspace` with `NativeLLMRuntime` as a CocoaPod target.

**Expected:** `ios/` directory appears with `nativeagent.xcworkspace` file.

---

## Step 2 — Open Xcode workspace

```bash
open ios/nativeagent.xcworkspace
```

Open the **`.xcworkspace`** (not `.xcodeproj`). Opening `.xcodeproj` directly skips CocoaPods linking.

---

## Step 3 — Add the llama.cpp Swift Package

In Xcode:

1. **File → Add Package Dependencies…**
2. Paste URL: `https://github.com/ggml-org/llama.cpp`
3. Version rule: **Up to Next Major Version** (from latest stable tag)
4. Product: **llama**
5. Target: **NativeLLMRuntime** ← critical — NOT the main app target
6. Click **Add Package**

**Verification:** In the Xcode Project Navigator, expand **NativeLLMRuntime → Frameworks**, you should see `llama` listed.

---

## Step 4 — Rebuild

```bash
npx expo run:ios
```

Or build and run directly from Xcode (⌘R).

**Expected compile output:** No errors. The `#if canImport(llama)` guard in `LlamaCppBackend.swift`, `LlamaCppModelSession.swift`, and `LlamaCppCApiAdapter.swift` activates, compiling the real inference code path.

---

## Step 5 — Verify backend status in-app

Open the **LLM Diagnostics** screen. Check the BACKEND STATUS block:

```
llama.cpp linked  →  yes ✓          (green)
GGUF ready        →  linked, no model loaded
```

And in RUNTIME HEALTH:

```
isLinked          →  true       (green)
backend           →  llama_cpp  (green)
available         →  true       (green)
supportsStreaming  →  false      (expected — Phase 2C)
```

If `isLinked` still shows `false` after rebuilding, see Common Compile Errors below.

---

## Step 6 — Prepare a test GGUF model

### Recommended models for testing

| Model | Size | RAM usage | Download |
|-------|------|-----------|----------|
| Llama-3.2-1B-Instruct.Q4_K_M.gguf | ~700 MB | ~900 MB | HuggingFace |
| Phi-3.5-mini-instruct.Q4_K_M.gguf | ~2.2 GB | ~2.8 GB | HuggingFace |

**Use the 1B model for initial validation.**

### Simulator: copy via xcrun

```bash
# 1. Get the simulator's data container path
xcrun simctl get_app_container booted app.ales27pm.nativeagent data
# → prints: /Users/you/Library/Developer/CoreSimulator/Devices/<uuid>/data/Containers/Data/Application/<app-uuid>

# 2. Copy the model
cp /path/to/model.gguf <data-path>/Documents/
```

### Physical device: Xcode Device Manager

1. **Window → Devices and Simulators → your device**
2. Select your app under **Installed Apps**
3. Click the gear icon → **Download Container…** → open in Finder
4. Drag `model.gguf` into the **Documents** folder
5. Click gear again → **Replace Container**

---

## Step 7 — Run the smoke test

In the **DEV TOOLS — MODEL MANAGEMENT** block on the LLM Diagnostics screen:

1. Paste the model's full path into the **MODEL PATH** input
2. Tap **LOAD MODEL** → result should show:
   ```
   LOAD SUCCESS
   File validated and model loaded via llama.cpp.
   ```
3. Tap **SMOKE TEST** — enabled only when `isLinked = true` and a model is loaded.

   Smoke prompt: `"Q: What is 2+2? A:"`

4. Expected result panel:
   ```
   SMOKE PASS
   " 4"
   4 tokens · 312ms · llama_cpp
   ```

   Any non-empty response from `llama_cpp` backend with `tokensGenerated > 0` is passing.

---

## Success criteria

| Check | Expected |
|-------|----------|
| `isLinked` | `true` |
| `backend` | `llama_cpp` |
| `available` | `true` |
| `supportsStreaming` | `false` (Phase 2C) |
| `loadedModelId` | filename of loaded model |
| Smoke result `backend` | `llama_cpp` |
| Smoke result `text` | non-empty string |
| Smoke result `tokensGenerated` | > 0 |

---

## Common compile errors

### "No such module 'llama'"

The Swift Package was not added to the **NativeLLMRuntime** target. Check:
- Xcode Project Navigator → NativeLLMRuntime target → Frameworks & Libraries
- If `llama` is missing, repeat Step 3 and select the **NativeLLMRuntime** target explicitly

### "use of undeclared identifier 'llama_model_load_from_file'"

Your pinned llama.cpp version uses legacy API names. In NativeLLMRuntime target Build Settings:
```
Other Swift Flags → -DLLAMA_CPP_LEGACY_API
```
See `docs/LLAMA_CPP_API_COMPATIBILITY.md` for details.

### "use of undeclared identifier 'llama_backend_init'"

Your version removed this call. Add to Other Swift Flags:
```
-DLLAMA_CPP_NO_BACKEND_INIT
```

### "Cannot find type 'llama_model' in scope"

C++ interop header isn't bridging. In NativeLLMRuntime target Build Settings:
```
Other C++ Flags → -std=c++17
```

### "Undefined symbol: llama_model_load_from_file"

Clean build (⌘⇧K) and rebuild. If it persists, verify `llama` appears in **Link Binary With Libraries** for the NativeLLMRuntime target.

### ARM64 simulator architecture mismatch

```
Build Settings → NativeLLMRuntime → Excluded Architectures [iphonesimulator] → x86_64
```

### "killed 9" / app crashes during inference

Memory pressure — switch to the 1B Q4_K_M model.

---

## What happens without llama.cpp linked

- `isLinked` → `false`
- `backend` → `none`
- `available` → `false`
- `loadModel()` → validates the file exists and is a valid `.gguf`, returns `loaded: false` with message
- `runInference()` → throws `BackendUnavailableError`
- **No fake output is ever returned**

The diagnostics screen shows "Add Swift Package" instructions and the SMOKE TEST button stays disabled.

---

## Phase 2B.5 / 2B.6 is complete when

1. `isLinked: true` in LLM Diagnostics
2. LOAD MODEL succeeds with a real `.gguf` file
3. SMOKE TEST returns a non-empty text from `llama_cpp` backend
4. `supportsStreaming: false` (confirmed — streaming is Phase 2C)
5. TypeScript exits 0 (`npx tsc --noEmit` in `mobile/`)
