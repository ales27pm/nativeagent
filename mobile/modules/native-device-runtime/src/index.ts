import { requireOptionalNativeModule } from 'expo-modules-core';

import type {
  NativeDeviceRuntimeModule,
  NativeRuntimeSnapshot,
  ThermalState,
} from './NativeDeviceRuntime.types';

export type {
  NativeDeviceRuntimeModule,
  NativeRuntimeSnapshot,
  ThermalState,
  NativePlatform,
} from './NativeDeviceRuntime.types';

const NATIVE_MODULE_NAME = 'NativeDeviceRuntime';

const nativeModule =
  requireOptionalNativeModule<NativeDeviceRuntimeModule>(NATIVE_MODULE_NAME);

export class NativeDeviceRuntimeUnavailableError extends Error {
  constructor() {
    super(
      `NativeDeviceRuntime native module is not linked. ` +
        `This module requires a development build. ` +
        `Run: npx expo prebuild --clean && npx expo run:ios (or run:android).`,
    );
    this.name = 'NativeDeviceRuntimeUnavailableError';
  }
}

export function isNativeRuntimeAvailable(): boolean {
  if (nativeModule === null) {
    return false;
  }
  try {
    return nativeModule.isNativeRuntimeAvailable();
  } catch {
    return false;
  }
}

export async function getRuntimeSnapshot(): Promise<NativeRuntimeSnapshot> {
  if (nativeModule === null) {
    throw new NativeDeviceRuntimeUnavailableError();
  }
  return nativeModule.getRuntimeSnapshot();
}

const NativeDeviceRuntime = {
  isNativeRuntimeAvailable,
  getRuntimeSnapshot,
};

export default NativeDeviceRuntime;
