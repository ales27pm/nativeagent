# Local Native Build Checklist

Step-by-step guide to build NativeAgent with the native bridge active.

---

## Required Tools

| Tool | Minimum Version | Check |
|------|----------------|-------|
| Node.js | 18 LTS | `node -v` |
| Bun | 1.0+ | `bun -v` |
| Xcode | 15+ (macOS only) | `xcodebuild -version` |
| Xcode Command Line Tools | matching Xcode | `xcode-select -p` |
| CocoaPods | 1.14+ | `pod --version` |
| Ruby | 3.0+ | `ruby -v` |
| Android Studio | Hedgehog+ | — |
| Android SDK | API 34 | via Android Studio SDK Manager |
| JDK | 17 | `java -version` |
| Expo CLI | latest | `npx expo --version` |

---

## Step 1 — Install dependencies

```bash
cd mobile
bun install
```

**Expected:** `native-device-runtime` appears in output (linked from `./modules/native-device-runtime`).

Verify the symlink exists:
```bash
ls -la node_modules/native-device-runtime
# → symlink to ../modules/native-device-runtime
```

---

## Step 2 — Prebuild (generates native projects)

```bash
npx expo prebuild --clean
```

**What this does:**
- Reads `app.json` and `package.json`
- Writes `ios/` and `android/` directories from scratch
- Runs Expo autolinker — discovers `native-device-runtime` via `package.json` and `expo-module.config.json`
- Generates CocoaPods `Podfile` and Android `settings.gradle`

**Expected output (iOS):**
```
✔ Linking native module NativeDeviceRuntimeModule
Pods installation complete!
```

**Expected output (Android):**
```
✔ Linking native module expo.modules.nativedeviceruntime.NativeDeviceRuntimeModule
```

### Verify iOS — Podfile.lock

```bash
grep -A2 "NativeDeviceRuntime" ios/Podfile.lock
```

Expected:
```
- NativeDeviceRuntime (1.0.0):
  - ExpoModulesCore
```

### Verify Android — settings.gradle

```bash
grep "native-device-runtime" android/settings.gradle
```

Expected:
```
include ':native-device-runtime'
project(':native-device-runtime').projectDir = ...
```

---

## Step 3A — Run on iOS Simulator

```bash
npx expo run:ios
```

Or target a specific simulator:
```bash
npx expo run:ios --device "iPhone 15 Pro"
```

**Expected success output:**
```
info Building (proj=NativeAgent, config=Debug, sdk=iphonesimulator)
BUILD SUCCEEDED
info Booting simulator...
info Installing app...
```

---

## Step 3B — Run on Android Emulator

```bash
npx expo run:android
```

**Expected success output:**
```
BUILD SUCCESSFUL in Xs
info Starting Metro Bundler
info Installing app...
```

---

## Step 4 — Verify native bridge is active

Open the app and navigate to the **Diagnostics** screen.

### Expected JSON output on iOS

```json
{
  "platform": "ios",
  "osVersion": "17.5",
  "deviceModel": "iPhone16,2",
  "processorCount": 6,
  "activeProcessorCount": 6,
  "physicalMemoryBytes": 8589934592,
  "lowPowerModeEnabled": false,
  "thermalState": "nominal",
  "appVersion": "1.0.0",
  "buildNumber": "1"
}
```

### Expected JSON output on Android

```json
{
  "platform": "android",
  "osVersion": "14",
  "deviceModel": "Pixel 8",
  "processorCount": 8,
  "activeProcessorCount": 8,
  "physicalMemoryBytes": 8589934592,
  "lowPowerModeEnabled": false,
  "thermalState": "nominal",
  "appVersion": "1.0.0",
  "buildNumber": "1"
}
```

**Bridge Health panel should show:**
```
bridgeAvailable        → true   (green)
nativeSnapshotAvailable → true  (green)
runningInDevBuild      → true   (green)
hermesEnabled          → true   (green)
```

---

## Common Failures

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Cannot find native module 'NativeDeviceRuntime'` | Prebuild not run or symlink missing | `bun install && npx expo prebuild --clean` |
| `bridgeAvailable: false` in dev build | `expo-modules-core` not initialized | Rebuild: `npx expo run:ios --no-build-cache` |
| `Pod 'NativeDeviceRuntime' not found` | Module not in `package.json` `file:` reference | Verify `package.json` has `"native-device-runtime": "file:./modules/native-device-runtime"` |
| `FAILURE: Build failed — Could not resolve :native-device-runtime` | Android autolinker miss | Re-run `npx expo prebuild --clean` |
| `error: Build input file cannot be found` (iOS) | Stale derived data | `rm -rf ~/Library/Developer/Xcode/DerivedData && npx expo run:ios` |
| Module loads but returns wrong shape | Native code not recompiled after Kotlin/Swift change | `npx expo run:ios --no-build-cache` |
| `hermesEnabled: false` | Hermes disabled in app.json | Ensure `"jsEngine": "hermes"` in app.json |
| `newArchLikely: unknown` in Expo Go | Expo Go / sandbox — New Arch flags not exposed | Use a dev build (see Step 3) |

---

## Quick Re-run (after code changes)

For **JS-only changes** — Metro hot reload handles it automatically.

For **native code changes** (Swift, Kotlin, podspec, build.gradle):
```bash
npx expo run:ios     # or run:android
# no --clean needed unless you changed expo-module.config.json or package.json
```

For **module structure changes** (added/removed modules, changed package.json):
```bash
npx expo prebuild --clean
npx expo run:ios     # or run:android
```
