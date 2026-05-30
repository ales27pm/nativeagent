export type {
  NativePlatform,
  NativeRuntimeSnapshot,
  ThermalState,
} from '../../../modules/native-device-runtime/src/NativeDeviceRuntime.types';

export type RuntimeStatus = 'idle' | 'loading' | 'success' | 'error';

export type RuntimeError = {
  name: string;
  message: string;
};
