# NativeAgent

> Expo + React Native New Architecture + Native Runtime

NativeAgent is a technical foundation for an on-device AI assistant. **Phase 1** does not ship an LLM. It establishes the real native runtime bridge that future on-device AI features will depend on.

This project is **not** an Expo Go app. It uses a local Expo Module written in **Swift** (iOS) and **Kotlin** (Android), which requires a development build.

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
│   │   └── diagnostics.tsx        # Diagnostics
│   ├── components/
│   │   ├── RuntimeCard.tsx
│   │   └── ErrorPanel.tsx
│   ├── features/
│   │   └── runtime/
│   │       ├── runtimeTypes.ts
│   │       └── useRuntimeSnapshot.ts
│   └── theme/
│       ├── colors.ts
│       ├── spacing.ts
│       └── typography.ts
└── modules/
    └── native-device-runtime/
        ├── expo-module.config.json
        ├── package.json
        ├── src/
        │   ├── index.ts                          # TS API + types
        │   └── NativeDeviceRuntime.types.ts
        ├── ios/
        │   ├── NativeDeviceRuntime.podspec
        │   └── NativeDeviceRuntimeModule.swift
        └── android/
            ├── build.gradle
            └── src/main/
                ├── AndroidManifest.xml
                └── java/expo/modules/nativedeviceruntime/
                    └── NativeDeviceRuntimeModule.kt
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

- **NativeLLMRuntime** — on-device LLM inference (e.g., MLX on iOS, MediaPipe / ExecuTorch on Android)
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
