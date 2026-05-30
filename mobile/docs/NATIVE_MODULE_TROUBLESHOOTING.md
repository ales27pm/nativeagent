# Native Module Troubleshooting

Diagnostic guide for `native-device-runtime` and the NativeAgent native bridge.

---

## Symptom index

- [Module unavailable / bridgeAvailable: false](#module-unavailable)
- [Running in Expo Go or sandbox](#expo-go-limitation)
- [Prebuild cache issues](#prebuild-cache-issues)
- [iOS Pod autolinking issues](#ios-pod-autolinking-issues)
- [Android Gradle autolinking issues](#android-gradle-autolinking-issues)
- [New Architecture gotchas](#new-architecture-gotchas)
- [When to run prebuild --clean](#when-to-run-prebuild---clean)

---

## Module unavailable

**Diagnostics screen shows `bridgeAvailable: false`.**

### Cause A — app is running in Expo Go or Vibecode sandbox

See [Expo Go limitation](#expo-go-limitation) below.

### Cause B — prebuild was never run

```bash
npx expo prebuild --clean
npx expo run:ios   # or run:android
```

### Cause C — `package.json` is missing the `file:` dependency

```bash
grep native-device-runtime package.json
```

Must contain:
```json
"native-device-runtime": "file:./modules/native-device-runtime"
```

If missing, add it and re-run:
```bash
bun install
npx expo prebuild --clean
```

### Cause D — `node_modules` symlink is broken

```bash
ls -la node_modules/native-device-runtime
```

If not a symlink → `modules/native-device-runtime`, re-run `bun install`.

### Cause E — module config not found by autolinker

Check `modules/native-device-runtime/expo-module.config.json` exists and contains:
```json
{
  "platforms": ["ios", "android"],
  "ios": { "modules": ["NativeDeviceRuntimeModule"] },
  "android": { "modules": ["expo.modules.nativedeviceruntime.NativeDeviceRuntimeModule"] }
}
```

Any typo in the class name will silently skip autolinking.

---

## Expo Go limitation

**You cannot use `native-device-runtime` in Expo Go or any managed sandbox preview.** This is an architectural constraint, not a bug.

Expo Go is a pre-built binary that cannot load custom native code. The module uses `requireOptionalNativeModule`, which returns `null` gracefully — the app continues running and shows the OFFLINE state in the Diagnostics screen.

**This is expected behavior in Expo Go.**

To get the native bridge active:
1. Follow `docs/LOCAL_NATIVE_BUILD_CHECKLIST.md` to create a development build
2. Run the app from that build, not from Expo Go
3. The Diagnostics screen will show `bridgeAvailable: true`

There is no workaround that keeps Expo Go as the runner.

---

## Prebuild cache issues

Expo prebuild generates `ios/` and `android/` from scratch. Stale artifacts from a previous run can cause subtle failures.

### Signs of a stale prebuild

- Module shows as linked in Podfile.lock but `bridgeAvailable` is still `false`
- Gradle build fails referencing an old project path
- Xcode build fails with "file not found" for a Swift file you just added

### Fix

Always use `--clean` when in doubt:
```bash
npx expo prebuild --clean
```

`--clean` deletes `ios/` and `android/` before regenerating. Your custom files in `modules/` are never touched.

### Additional Xcode cache

If iOS still fails after a clean prebuild:
```bash
rm -rf ~/Library/Developer/Xcode/DerivedData
npx expo run:ios
```

### Metro bundler cache

If JS changes aren't reflected after a native rebuild:
```bash
npx expo start --clear
```

---

## iOS Pod autolinking issues

### Pods not installed

```
error: No podspec found for 'NativeDeviceRuntime'
```

Run from the `ios/` directory:
```bash
cd ios && pod install
```

Or trigger via Expo CLI:
```bash
npx expo run:ios
```

### Wrong podspec path

Expo autolinker generates the `Podfile` entry pointing to:
```
../node_modules/native-device-runtime
```

Which resolves via symlink to `../modules/native-device-runtime`. If the symlink is missing, CocoaPods cannot find the podspec. Fix: `bun install`.

### Pod version conflict

If CocoaPods reports a version conflict with `ExpoModulesCore`:
```bash
cd ios && pod repo update && pod install
```

### Verify linkage

After `pod install`:
```bash
grep -A3 "NativeDeviceRuntime" ios/Podfile.lock
```

Expected:
```
- NativeDeviceRuntime (1.0.0):
  - ExpoModulesCore
```

If absent, the module was not linked — check `expo-module.config.json` and `package.json`.

---

## Android Gradle autolinking issues

### Module not found during Gradle sync

```
FAILURE: Build failed with an exception.
* What went wrong:
Could not resolve project :native-device-runtime.
```

This means autolinking did not add the project to `android/settings.gradle`. Fix:
```bash
npx expo prebuild --clean
npx expo run:android
```

### Verify linkage

```bash
grep "native-device-runtime" android/settings.gradle
```

Expected:
```groovy
include ':native-device-runtime'
project(':native-device-runtime').projectDir = new File(rootProject.projectDir, '../node_modules/native-device-runtime/android')
```

### Kotlin compilation errors

If Swift-like Kotlin errors appear after editing `NativeDeviceRuntimeModule.kt`:
```bash
npx expo run:android --no-build-cache
```

### Thermal state on older Android

The `PowerManager.getCurrentThermalStatus()` API requires Android API 29 (Android 10). On older devices, `thermalState` returns `"unknown"` — this is correct behavior, not a bug.

---

## New Architecture gotchas

NativeAgent requires New Architecture (`newArchEnabled: true`). These issues are specific to that configuration.

### TurboModule proxy not detected

The Diagnostics screen checks `global.__turboModuleProxy` to detect New Architecture. If `newArchLikely` shows `unknown` in a dev build, New Architecture may be disabled.

Verify in `app.json`:
```json
{
  "expo": {
    "plugins": [
      ["expo-build-properties", {
        "ios": { "newArchEnabled": true },
        "android": { "newArchEnabled": true }
      }]
    ]
  }
}
```

### Hermes not enabled

`hermesEnabled: false` in a dev build means the Hermes engine is not configured.

Check `app.json`:
```json
{
  "expo": {
    "jsEngine": "hermes"
  }
}
```

### JSI / Fabric crash on launch

If the app crashes immediately on a New Architecture dev build, this usually means a native module has a JSI bridge mismatch. Check Xcode / Logcat for the crashing module name, then:
1. Ensure that module's `expo-module.config.json` does not declare both old and new arch registrations
2. Run `npx expo prebuild --clean && npx expo run:ios`

---

## When to run prebuild --clean

| Change made | `bun install` | `prebuild` | `prebuild --clean` |
|-------------|:---:|:---:|:---:|
| JS/TS source file | — | — | — |
| `modules/*/src/*.ts` (JS layer) | — | — | — |
| `modules/*/ios/*.swift` | — | — | — |
| `modules/*/android/*.kt` | — | — | — |
| `modules/*/expo-module.config.json` | — | ✓ | ✓ preferred |
| `modules/*/ios/*.podspec` | — | ✓ | ✓ preferred |
| `modules/*/android/build.gradle` | — | ✓ | ✓ preferred |
| Added a new module to `package.json` | ✓ | ✓ | ✓ preferred |
| Removed a module from `package.json` | ✓ | — | ✓ required |
| Changed `app.json` (plugins, name, etc.) | — | ✓ | ✓ preferred |
| First time running on this machine | ✓ | ✓ | ✓ |

**Rule of thumb:** when in doubt, run `--clean`. It takes a few extra minutes but eliminates an entire class of stale-state bugs.
