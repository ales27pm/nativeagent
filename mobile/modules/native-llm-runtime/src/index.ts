import { Platform } from 'react-native';

import { requireOptionalNativeModule } from 'expo-modules-core';

import type {
  InstalledLLMModel,
  LLMRuntimeBackend,
  LLMRuntimeHealth,
  LoadModelRequest,
  LoadModelResult,
  NativeLLMRuntimeModule,
  UnloadModelResult,
} from './NativeLLMRuntime.types';

export type {
  InstalledLLMModel,
  LLMRuntimeBackend,
  LLMRuntimeHealth,
  LoadModelRequest,
  LoadModelResult,
  UnloadModelResult,
} from './NativeLLMRuntime.types';

const NATIVE_MODULE_NAME = 'NativeLLMRuntime';

const nativeModule =
  requireOptionalNativeModule<NativeLLMRuntimeModule>(NATIVE_MODULE_NAME);

export class NativeLLMRuntimeUnavailableError extends Error {
  constructor() {
    super(
      `NativeLLMRuntime native module is not linked. ` +
        `This module requires a development build. ` +
        `Run: npx expo prebuild --clean && npx expo run:ios (or run:android).`,
    );
    this.name = 'NativeLLMRuntimeUnavailableError';
  }
}

// Phase 2B placeholder — always throws, never fakes output
export class LLMInferenceNotImplementedError extends Error {
  constructor() {
    super(
      `runInference is not implemented in Phase 2A. ` +
        `Actual inference activates in Phase 2B when llama.cpp or MLX Swift is integrated.`,
    );
    this.name = 'LLMInferenceNotImplementedError';
  }
}

export function isLLMRuntimeAvailable(): boolean {
  return nativeModule !== null;
}

export async function getLLMRuntimeHealth(): Promise<LLMRuntimeHealth> {
  if (nativeModule === null) {
    const platform = Platform.OS as 'ios' | 'android';
    return {
      available: false,
      platform,
      backend: 'none',
      supportsStreaming: false,
      supportsCancellation: false,
      supportsQuantizedModels: false,
      loadedModelId: null,
      reasonUnavailable:
        'Native module not linked. Create a development build:\n' +
        '  npx expo prebuild --clean\n' +
        '  npx expo run:ios\n' +
        '  # or: npx expo run:android',
    };
  }
  return nativeModule.getLLMRuntimeHealth();
}

export async function listInstalledModels(): Promise<InstalledLLMModel[]> {
  if (nativeModule === null) {
    throw new NativeLLMRuntimeUnavailableError();
  }
  return nativeModule.listInstalledModels();
}

export async function loadModel(
  request: LoadModelRequest,
): Promise<LoadModelResult> {
  if (nativeModule === null) {
    throw new NativeLLMRuntimeUnavailableError();
  }
  return nativeModule.loadModel(request);
}

export async function unloadModel(modelId: string): Promise<UnloadModelResult> {
  if (nativeModule === null) {
    throw new NativeLLMRuntimeUnavailableError();
  }
  return nativeModule.unloadModel(modelId);
}

// Phase 2B placeholder — throws a typed error, does not fake any output
export async function runInference(_prompt: string): Promise<never> {
  throw new LLMInferenceNotImplementedError();
}

const NativeLLMRuntime = {
  isLLMRuntimeAvailable,
  getLLMRuntimeHealth,
  listInstalledModels,
  loadModel,
  unloadModel,
  runInference,
};

export default NativeLLMRuntime;
