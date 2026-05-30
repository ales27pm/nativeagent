export type {
  NativePlatform,
  NativeRuntimeSnapshot,
  ThermalState,
} from 'native-device-runtime';

export type RuntimeStatus = 'idle' | 'loading' | 'success' | 'error';

export type RuntimeError = {
  name: string;
  message: string;
};
