export type NativePlatform = 'ios' | 'android';

export type ThermalState =
  | 'nominal'
  | 'fair'
  | 'serious'
  | 'critical'
  | 'unknown';

export type NativeRuntimeSnapshot = {
  platform: NativePlatform;
  osVersion: string;
  deviceModel: string;
  processorCount: number;
  activeProcessorCount: number;
  physicalMemoryBytes: number;
  lowPowerModeEnabled: boolean;
  thermalState: ThermalState;
  appVersion: string | null;
  buildNumber: string | null;
};

export interface NativeDeviceRuntimeModule {
  isNativeRuntimeAvailable(): boolean;
  getRuntimeSnapshot(): Promise<NativeRuntimeSnapshot>;
}
