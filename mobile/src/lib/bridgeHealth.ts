import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { isNativeRuntimeAvailable } from 'native-device-runtime';

export type BridgeHealthReport = {
  bridgeAvailable: boolean;
  nativeSnapshotAvailable: boolean;
  runningInDevBuild: boolean;
  runningInExpoGoLikeHost: boolean;
  hermesEnabled: boolean;
  newArchitectureLikelyEnabled: boolean;
  platform: string;
  failureReason: string | null;
  nextAction: string | null;
};

function detectHermes(): boolean {
  return (
    typeof (globalThis as { HermesInternal?: unknown }).HermesInternal !== 'undefined'
  );
}

function detectNewArch(): boolean {
  const g = global as unknown as {
    __turboModuleProxy?: unknown;
    nativeFabricUIManager?: unknown;
  };
  return g.__turboModuleProxy != null || g.nativeFabricUIManager != null;
}

function detectExpoGoLikeHost(): boolean {
  const execEnv = Constants.executionEnvironment;
  const ownership = Constants.appOwnership;
  return (
    execEnv === 'storeClient' ||
    ownership === 'expo' ||
    ownership === 'guest'
  );
}

export function getBridgeHealth(): BridgeHealthReport {
  const bridgeAvailable = isNativeRuntimeAvailable();
  const expoGoLike = detectExpoGoLikeHost();
  const devBuild = Constants.executionEnvironment === 'bare';

  let failureReason: string | null = null;
  let nextAction: string | null = null;

  if (!bridgeAvailable) {
    if (expoGoLike) {
      failureReason =
        'Running in Expo Go or a sandboxed preview. Custom native modules require a development build.';
    } else {
      failureReason =
        'Native module is not linked. The app was likely built without running expo prebuild.';
    }
    nextAction =
      'npx expo prebuild --clean\nnpx expo run:ios\n# or: npx expo run:android';
  }

  return {
    bridgeAvailable,
    nativeSnapshotAvailable: bridgeAvailable,
    runningInDevBuild: devBuild,
    runningInExpoGoLikeHost: expoGoLike,
    hermesEnabled: detectHermes(),
    newArchitectureLikelyEnabled: detectNewArch(),
    platform: Platform.OS,
    failureReason,
    nextAction,
  };
}
