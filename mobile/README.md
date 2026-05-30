# NativeAgent

> Expo + React Native New Architecture + Native Runtime

NativeAgent is a technical foundation for an on-device AI assistant. **Phase 1** establishes the real native runtime bridge. **Phase 1.5** hardens the bridge with health reporting and shape validation. **Phase 2A** adds the LLM runtime contract and lifecycle foundation. **Phase 2B** integrates a real iOS llama.cpp inference backend. **Phase 2B.5** adds link validation tooling. **Phase 2B.6** hardens the llama.cpp C API layer. **Phase 2B.7** hardens Swift C pointer safety, adds inference serialization, and fixes capability flags. **Phase 2B.8** removes the `llama_kv_cache_clear` compile risk by using fresh-context-per-inference.

This project is **not** an Expo Go app. It uses local Expo Modules written in **Swift** (iOS) and **Kotlin** (Android), which require a development build.

---

## Stack

- Expo SDK 54 — `expo`
- React Native 0.81 with the **New Architecture** enabled (`newArchEnabled: true`)
- **Hermes** JavaScript engine
- TypeScript strict mode
- Expo Router (file-based routing in `src/app/`)
- Expo Dev Client (`expo-dev-client`)
- Expo Modules API (Swift + Kotlin)
- NativeWind for styling

---

## What Phase 1 ships

1. A real local Expo module: **`native-device-runtime`**
2. iOS implementation in **Swift** using `ProcessInfo`, `UIDevice`, and `Bundle`
3. Android implementation in **Kotlin** using `ActivityManager`, `PowerManager`, and `Build`
4. A typed TypeScript API with `isNativeRuntimeAvailable()` and `getRuntimeSnapshot()`
5. A home screen that calls the native module and renders the runtime snapshot
6. A diagnostics screen with bridge status, environment, and architecture detection
7. Robust loading / error / success UI states with retry

## What Phase 1.5 ships

1. `getBridgeHealth()` — synchronous detection of bridge/runtime state
2. `validateSnapshot()` / `assertValidSnapshot()` — shape validation for `NativeRuntimeSnapshot`
3. Improved diagnostics screen: bridge health layer, NEXT STEP command block, shape validation section
4. `docs/LOCAL_NATIVE_BUILD_CHECKLIST.md` — step-by-step build guide
5. `docs/NATIVE_MODULE_TROUBLESHOOTING.md` — troubleshooting reference

## What Phase 2A ships

1. A second local Expo module: **`native-llm-runtime`**
2. Full TypeScript type contract: `LLMRuntimeHealth`, `InstalledLLMModel`, `LoadModelRequest`, `LoadModelResult`, `UnloadModelResult`
3. iOS Swift skeleton: real model file scanning, file validation, honest unavailable returns
4. Android Kotlin skeleton: same contract, real model file scanning
5. `getLLMRuntimeHealth()` — returns honest platform health with `backend: 'none'` and a clear `reasonUnavailable` message
6. `listInstalledModels()` — scans the app's Documents directory for `.gguf`, `.bin`, `.mlmodelc`, `.mlpackage` files
7. `loadModel()` — validates file existence, returns `loaded: false` with typed message (no backend linked)
8. `unloadModel()` — clears internal state
9. `runInference()` — intentionally unavailable in Phase 2A; throws `LLMInferenceNotImplementedError`
10. `useLLMRuntimeHealth` hook
11. LLM diagnostics screen at `/llm-diagnostics`
12. `docs/NATIVE_LLM_RUNTIME_CONTRACT.md`

## What Phase 2B ships

1. **`LLMBackend` protocol** — Swift abstraction for swappable inference backends
2. **`LlamaCppBackend.swift`** — concrete llama.cpp backend, all real code guarded by `#if canImport(llama)`
3. **`LlamaCppModelSession.swift`** — owns `llama_model*` + `llama_context*`, greedy sampling loop
4. **`LlamaCppError.swift`** — typed error enum for every llama.cpp failure mode
5. **Rewritten `NativeLLMRuntimeModule.swift`** — routes all calls through the backend protocol
6. **Real `loadModel` validation**: file exists → readable → `.gguf` extension → size > 0 bytes
7. **Real `loadModel` execution** (iOS + llama.cpp linked): `llama_model_load_from_file` + context init
8. **Real `runInference`** (iOS + llama.cpp linked): greedy token-sampling loop via llama.cpp C API
9. New TypeScript types: `RunInferenceRequest`, `RunInferenceResult`, `LLMRuntimeErrorCode`
10. New TypeScript error classes: `BackendUnavailableError`, `ModelNotLoadedError`, `ModelLoadFailedError`, `LLMInferenceNotImplementedError`
11. Updated `LLMRuntimeHealth` type with `supportedFormats` field
12. Updated LLM diagnostics screen: shows backend linked status, supported formats, inference readiness, linking instructions
13. `docs/IOS_LLAMA_CPP_BACKEND.md` — step-by-step llama.cpp linking guide

## What Phase 2B.5 ships

1. **`isLinked: boolean`** added to `LLMRuntimeHealth`
2. **`durationMs: number`** added to `RunInferenceResult`
3. **Updated LLM Diagnostics screen**: `isLinked` row, "llama.cpp linked yes/no" and "GGUF ready yes/no" rows in backend status
4. **DEV TOOLS block on LLM Diagnostics**: model path input, Load Model, Unload Model, Run Smoke Test buttons
5. **Smoke test**: prompt `"Q: What is 2+2? A:"` — only enabled when `backend === 'llama_cpp'` AND `isLinked === true` AND model loaded; never fakes success
6. **`useLLMRuntimeHealth` hook** extended with `loadModel`, `unloadModel`, `runInference` actions
7. **Android `NativeLLMRuntimeModule.kt`** updated to include `isLinked: false` and `supportedFormats: []`
8. **`docs/IOS_LLAMA_CPP_LINK_VALIDATION.md`** — prebuild → Xcode Package add → rebuild → model copy → smoke test
9. **`docs/IOS_LLAMA_CPP_BACKEND.md`** updated with link validation section, compile errors, memory pressure warning

## What Phase 2B.6 ships

1. **`LlamaCppCApiAdapter.swift`** — new file isolating all llama.cpp C API calls behind stable Swift helper methods; handles API version drift via `-DLLAMA_CPP_LEGACY_API` compile flag
2. **`LlamaCppModelSession.swift`** updated — now calls adapter methods only, never raw C API symbols
3. **`supportsStreaming`** fixed to `false` (was incorrectly tied to `isLinked`)
4. **`supportsCancellation`** confirmed `false`
5. **`supportedFormats`** now `['gguf']` when llama.cpp linked, `[]` when not linked
6. **`llama_backend_init()`** called once via adapter static initializer (skippable with `-DLLAMA_CPP_NO_BACKEND_INIT`)
7. **Android messages** updated — no stale Phase 2B references
8. **App config** hardened — name, slug, scheme, bundleIdentifier, package set explicitly
9. **`docs/LLAMA_CPP_API_COMPATIBILITY.md`** — new: API version matrix, flag reference, drift fix guide
10. **All docs updated** to reflect current project state

## What Phase 2B.7 ships

1. **`supportsQuantizedModels`** fixed to `isLinked` (was incorrectly `true` when not linked)
2. **`LlamaCppCApiAdapter`** hardened — `tokenize` and `tokenToPiece` use `withUnsafeMutableBufferPointer`; both throw typed `LlamaCppError` instead of silently returning error codes
3. **New `LlamaCppError` cases** — `vocabUnavailable`, `emptyVocabulary`, `detokenizationFailed`, `invalidLogits`, `inferenceBusy`
4. **`LlamaCppModelSession`** hardened — vocab size and EOS token validated and cached at init time; fails immediately on corrupt/empty vocab
5. **Inference serialization** — `NSLock` guard in `generate()` throws `inferenceBusy` if a call is already in flight
6. **LLM Diagnostics** — phase tag updated to "PHASE 2B.7 — iOS COMPILE HARDENING"; Android rows no longer reference Phase 2C
7. **Docs** — Android inference is described as a "dedicated future phase", not Phase 2C
8. **Manual linking risk** documented — `prebuild --clean` wipes manual Xcode Package wiring; users must re-add the Swift Package after each prebuild

### ⚠️ Manual Swift Package linking risk

Adding the llama.cpp Swift Package in Xcode is manual. Running `npx expo prebuild --clean` wipes the generated `ios/` directory, including all manually added Package targets. After every prebuild:

1. Re-open `ios/NativeAgent.xcworkspace` in Xcode
2. Re-add `https://github.com/ggml-org/llama.cpp` (product: **llama**, target: **NativeLLMRuntime**)
3. Rebuild

A production-grade solution (config plugin, xcframework vendoring, or source vendoring) is planned for a later phase.

### How to validate Phase 2B.7 (iOS)

1. `npx expo prebuild --clean && open ios/NativeAgent.xcworkspace`
2. In Xcode: **File → Add Package Dependencies → https://github.com/ggml-org/llama.cpp**, product **llama**, target **NativeLLMRuntime**
3. `npx expo run:ios`
4. Open LLM Diagnostics → verify `isLinked: true`, `backend: llama_cpp`, `supportsStreaming: false`, `supportsQuantizedModels: true`
5. Copy a small `.gguf` model into the simulator Documents folder
6. Paste path in MODEL PATH input → **LOAD MODEL** → **SMOKE TEST**
7. Smoke result panel shows real generated text + token count + `durationMs`

Full guide: `docs/IOS_LLAMA_CPP_LINK_VALIDATION.md`  
API drift reference: `docs/LLAMA_CPP_API_COMPATIBILITY.md`

## What Phase 2B.8 ships

1. **Removed `llama_kv_cache_clear`** — the symbol's availability varies across llama.cpp Swift Package releases; calling it risks a compile error against an unknown package version
2. **Fresh context per inference** — `LlamaCppModelSession` now creates a fresh `llama_context` at the start of each `generate()` call and frees it in `defer`; the `llama_model` stays alive for the session lifetime
3. **No stale KV state** — fresh context guarantees clean state for each prompt without any KV-clear API dependency
4. **Android `LLMInferenceNotImplementedError`** message updated — no longer references Phase 2C
5. **`index.ts` JSDoc** updated — Android comment no longer says Phase 2C

**Tradeoff:** Fresh context creation adds per-call overhead (model weights stay in RAM; only the attention/KV buffers are reallocated). Acceptable for Phase 2B validation. Phase 2C may re-introduce context reuse when a stable memory-reset strategy is confirmed.

### How to validate Phase 2B.8 (iOS)

1. `npx expo prebuild --clean && open ios/NativeAgent.xcworkspace`
2. In Xcode: **File → Add Package Dependencies → https://github.com/ggml-org/llama.cpp**, product **llama**, target **NativeLLMRuntime**
3. `npx expo run:ios`
4. Open LLM Diagnostics → verify `isLinked: true`, `backend: llama_cpp`
5. Copy a `.gguf` model, paste path → **LOAD MODEL** → **SMOKE TEST**
6. Run SMOKE TEST a second time — output should be clean, not continuation of prior run (fresh context)
7. TypeScript exits 0

---

### Current backend status

| Platform | Backend | Status |
|----------|---------|--------|
| iOS (dev build + llama.cpp Package linked) | `llama_cpp` | Real inference available |
| iOS (dev build, no llama.cpp Package) | `none` | File validation works; inference throws `BackendUnavailableError` |
| iOS (Expo Go / sandbox) | `none` | All native calls throw `NativeLLMRuntimeUnavailableError` |
| Android | `none` | File validation works; inference throws `LLMInferenceNotImplementedError` |

### How to test with a real GGUF file (iOS)

1. Run `npx expo prebuild --clean && npx expo run:ios`
2. In Xcode: **File → Add Package Dependencies → `https://github.com/ggml-org/llama.cpp`**, product **llama**, target **NativeLLMRuntime**
3. Rebuild: `npx expo run:ios`
4. Download a small GGUF model (e.g. `Llama-3.2-1B-Instruct.Q4_K_M.gguf`) and copy to the simulator's Documents folder
5. Open the LLM Diagnostics screen — `backend: llama_cpp`, `available: true`
6. Call `loadModel({ modelId, localPath })` — returns `loaded: true`
7. Call `runInference({ modelId, prompt })` — returns real generated text

Full step-by-step: `docs/IOS_LLAMA_CPP_BACKEND.md`

### Why fake inference is forbidden

Returning fake generated text — even as a placeholder — would:
- Let tests pass against output that doesn't come from a real model
- Create developer confusion about what is actually working
- Violate user trust if ever shown in a real session

`runInference` throws errors with clear messages until a real backend is linked, a model is loaded, and the greedy sampling loop produces actual tokens.

---

## Why Expo Go will not work

Expo Go is a generic host app published to the App Store and Play Store. It can only run JavaScript and the native modules already bundled into the Expo Go binary. **It cannot load custom native code.**

`native-device-runtime` is custom Swift and Kotlin compiled into the app binary. To execute it, the app must be built locally with `expo prebuild` + `expo run:ios` / `expo run:android` (or with EAS Build using a `developmentClient` profile).

When the JS layer cannot find the registered native module, `isNativeRuntimeAvailable()` returns `false` and `getRuntimeSnapshot()` rejects with `NativeDeviceRuntimeUnavailableError`. The UI surfaces this state instead of crashing.

---

## Install

```bash
npm install
# or
bun install
```

## Prebuild (generates `ios/` and `android/` projects)

```bash
npx expo prebuild --clean
```

This is what links the local `modules/native-device-runtime` module into the native projects.

## Run on iOS (development build)

```bash
npx expo run:ios
```

Requirements: macOS, Xcode 15+, CocoaPods, an iOS Simulator or device.

## Run on Android (development build)

```bash
npx expo run:android
```

Requirements: Android Studio with SDK 34, an emulator or physical device.

---

## Project structure

```
mobile/
├── src/
│   ├── app/                       # Expo Router routes
│   │   ├── _layout.tsx
│   │   ├── index.tsx              # Home: NativeAgent
│   │   ├── diagnostics.tsx        # Device runtime diagnostics
│   │   └── llm-diagnostics.tsx    # LLM runtime diagnostics (Phase 2A)
│   ├── components/
│   │   ├── RuntimeCard.tsx
│   │   └── ErrorPanel.tsx
│   ├── features/
│   │   ├── runtime/
│   │   │   ├── runtimeTypes.ts
│   │   │   ├── snapshotValidator.ts
│   │   │   └── useRuntimeSnapshot.ts
│   │   └── llm/
│   │       └── useLLMRuntimeHealth.ts
│   ├── lib/
│   │   └── bridgeHealth.ts
│   └── theme/
│       ├── colors.ts
│       ├── spacing.ts
│       └── typography.ts
├── modules/
│   ├── native-device-runtime/     # Phase 1: device/runtime snapshot
│   │   ├── expo-module.config.json
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   └── NativeDeviceRuntime.types.ts
│   │   ├── ios/
│   │   │   ├── NativeDeviceRuntime.podspec
│   │   │   └── NativeDeviceRuntimeModule.swift
│   │   └── android/
│   │       ├── build.gradle
│   │       └── src/main/
│   │           ├── AndroidManifest.xml
│   │           └── java/expo/modules/nativedeviceruntime/
│   │               └── NativeDeviceRuntimeModule.kt
│   └── native-llm-runtime/        # Phase 2A: LLM lifecycle contract
│       ├── expo-module.config.json
│       ├── package.json
│       ├── src/
│       │   ├── index.ts
│       │   └── NativeLLMRuntime.types.ts
│       ├── ios/
│       │   ├── NativeLLMRuntime.podspec
│       │   └── NativeLLMRuntimeModule.swift
│       └── android/
│           ├── build.gradle
│           └── src/main/
│               ├── AndroidManifest.xml
│               └── java/expo/modules/nativellmruntime/
│                   └── NativeLLMRuntimeModule.kt
└── docs/
    ├── LOCAL_NATIVE_BUILD_CHECKLIST.md
    ├── NATIVE_MODULE_TROUBLESHOOTING.md
    ├── NATIVE_LLM_RUNTIME_CONTRACT.md
    ├── IOS_LLAMA_CPP_BACKEND.md
    ├── IOS_LLAMA_CPP_LINK_VALIDATION.md
    └── LLAMA_CPP_API_COMPATIBILITY.md
```

---

## Native module contract

```ts
type NativeRuntimeSnapshot = {
  platform: 'ios' | 'android';
  osVersion: string;
  deviceModel: string;
  processorCount: number;
  activeProcessorCount: number;
  physicalMemoryBytes: number;
  lowPowerModeEnabled: boolean;
  thermalState: 'nominal' | 'fair' | 'serious' | 'critical' | 'unknown';
  appVersion: string | null;
  buildNumber: string | null;
};

interface NativeDeviceRuntimeModule {
  isNativeRuntimeAvailable(): boolean;
  getRuntimeSnapshot(): Promise<NativeRuntimeSnapshot>;
}
```

Import:

```ts
import NativeDeviceRuntime, {
  type NativeRuntimeSnapshot,
} from '../../modules/native-device-runtime/src';
```

---

## How to add the next native module

The next native module should follow the same shape as `native-device-runtime`. Steps:

1. Create the folder: `modules/<module-name>/`
2. Add `package.json` with `"name": "<module-name>"`
3. Add `expo-module.config.json`:
   ```json
   {
     "platforms": ["ios", "android"],
     "ios":     { "modules": ["<SwiftClassName>"] },
     "android": { "modules": ["expo.modules.<modulename>.<KotlinClassName>"] }
   }
   ```
4. Implement the iOS side in Swift under `ios/<SwiftClassName>.swift`, subclassing `Module` from `ExpoModulesCore`.
5. Implement the Android side in Kotlin under `android/src/main/java/expo/modules/<modulename>/<KotlinClassName>.kt`, subclassing `Module` from `expo.modules.kotlin.modules.Module`.
6. Ship a typed TS wrapper that uses `requireOptionalNativeModule<T>('<NameUsedInModuleDefinition>')` so the JS layer degrades gracefully when the native side is not linked.
7. Re-run `npx expo prebuild --clean` and `npx expo run:ios` / `npx expo run:android`.

The Expo autolinker scans `modules/` at the project root automatically when prebuilding, so no manual linking is required.

---

## Planned native modules (do not implement yet)

The runtime bridge in Phase 1 exists to anchor the following future modules:

- **NativeLLMRuntime** ✓ Phase 2B.8 complete — iOS llama.cpp real inference, compile-stable; streaming Phase 2C (iOS only)
- **NativeEmbeddingRuntime** — fast vector embedding generation on-device
- **NativeTokenizerRuntime** — sentence-piece / BPE tokenization native pass-through
- **NativeAudioRuntime** — low-latency audio capture and VAD for voice agents
- **NativeFileIndexRuntime** — sandbox-safe file indexing for retrieval
- **NativeSecureToolRuntime** — Keychain / Keystore-backed tool execution gating

Each will follow the same pattern: typed JS contract, Swift impl, Kotlin impl, graceful unavailable state.

---

## Notes

- `app.json` has `"newArchEnabled": true`; the project is compatible with Fabric + TurboModules.
- `expo-dev-client` is already in `dependencies`, so dev builds include the Expo Dev Menu.
- All native responses are typed end to end. The JS layer never assumes the bridge is available.
- `requireOptionalNativeModule` is used (not `requireNativeModule`) so importing the module on a host without the native side linked does not throw at module load.
