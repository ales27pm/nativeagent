# iOS llama.cpp — Link Validation Guide (Phase 2B.5)

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

This generates `ios/<ProjectName>.xcworkspace` with `NativeLLMRuntime` as a CocoaPod target.

**Expected:** `ios/` directory appears with `.xcworkspace` file.

---

## Step 2 — Open Xcode workspace

```bash
open ios/<ProjectName>.xcworkspace
```

Open the **`.xcworkspace`** (not `.xcodeproj`). Opening `.xcodeproj` directly skips CocoaPods linking and will produce build failures.

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

**Expected compile output:** No errors. The `#if canImport(llama)` guard in `LlamaCppBackend.swift` and `LlamaCppModelSession.swift` activates, compiling the real inference code.

---

## Step 5 — Verify backend status in-app

Open the **LLM Diagnostics** screen. Check the BACKEND STATUS block:

```
llama.cpp linked  →  yes ✓          (green)
GGUF ready        →  linked, no model loaded
```

And in RUNTIME HEALTH:

```
isLinked   →  true     (green)
backend    →  llama_cpp  (green)
available  →  true     (green)
```

If `isLinked` still shows `false` after rebuilding, see Common Compile Errors below.

---

## Step 6 — Prepare a test GGUF model

### Recommended models for Phase 2B testing

| Model | Size | RAM usage | Download |
|-------|------|-----------|----------|
| Llama-3.2-1B-Instruct.Q4_K_M.gguf | ~700 MB | ~900 MB | HuggingFace |
| Phi-3.5-mini-instruct.Q4_K_M.gguf | ~2.2 GB | ~2.8 GB | HuggingFace |

**Use the 1B model for initial validation.** A 3B+ model on a device with < 6 GB RAM may cause the OS to kill the app mid-inference (memory pressure). Start small.

### Simulator: copy via xcrun

```bash
# 1. Get the simulator's data container path
xcrun simctl get_app_container booted <bundle-id> data
# → prints: /Users/you/Library/Developer/CoreSimulator/Devices/<uuid>/data/Containers/Data/Application/<app-uuid>

# 2. Copy the model
cp /path/to/model.gguf <data-path>/Documents/
```

Replace `<bundle-id>` with your app's bundle ID (found in `app.json` under `ios.bundleIdentifier`).

### Physical device: Xcode Device Manager

1. **Window → Devices and Simulators → your device**
2. Select your app under **Installed Apps**
3. Click the gear icon → **Download Container…** → open in Finder
4. Drag `model.gguf` into the **Documents** folder
5. Click gear again → **Replace Container**

---

## Step 7 — Run the smoke test

In the **DEV TOOLS — MODEL MANAGEMENT** block on the LLM Diagnostics screen:

1. Paste the model's full path into the **MODEL PATH** input, e.g.:
   ```
   /var/mobile/Containers/Data/Application/<uuid>/Documents/llama-3.2-1b.Q4_K_M.gguf
   ```
   (The simulator path starts with `/Users/…`; a device path starts with `/var/mobile/…`)

2. Tap **LOAD MODEL** → result should show:
   ```
   LOAD SUCCESS
   File validated and model loaded via llama.cpp.
   ```

3. Tap **SMOKE TEST** — the button is enabled only when `isLinked = true` and a model is loaded.

   The smoke prompt is:
   ```
   Q: What is 2+2? A:
   ```

4. Expected result panel:
   ```
   SMOKE PASS
   " 4"
   4 tokens · 312ms · llama_cpp
   ```

   The exact text and duration will vary. Any non-empty response from `llama_cpp` backend with `tokensGenerated > 0` is a passing smoke test.

---

## Success criteria

| Check | Expected |
|-------|----------|
| `isLinked` | `true` |
| `backend` | `llama_cpp` |
| `available` | `true` |
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

### "Cannot find type 'llama_model' in scope"

The C++ interop header isn't bridging. Try:
```
Build Settings → NativeLLMRuntime → Other C++ Flags → -std=c++17
```

### "Undefined symbol: llama_load_model_from_file"

The linker can't find llama.cpp. Clean build folder (⌘⇧K) and rebuild. If persists, check that `llama` is in **Link Binary With Libraries** (not just Frameworks) for the NativeLLMRuntime target.

### ARM64 simulator architecture mismatch

If your Mac is Intel-based and you see arch errors in the simulator:
```
Build Settings → NativeLLMRuntime → Excluded Architectures [iphonesimulator] → x86_64
```

### "killed 9" / app crashes during inference

Memory pressure — the model is too large for device RAM. Switch to the 1B Q4_K_M model.

### `llama_load_model_from_file` renamed

llama.cpp evolves its API. If you pin to a post-mid-2025 release and see a compile error on `llama_load_model_from_file`, check for `llama_model_load_from_file` as the new name. The same applies to `llama_new_context_with_model` → `llama_init_from_model` and `llama_free_model` → `llama_model_free`.

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

## Phase 2B.5 is complete when

1. `isLinked: true` in LLM Diagnostics
2. LOAD MODEL succeeds with a real `.gguf` file
3. SMOKE TEST returns a non-empty text from `llama_cpp` backend
4. TypeScript exits 0 (`npx tsc --noEmit` in `mobile/`)
