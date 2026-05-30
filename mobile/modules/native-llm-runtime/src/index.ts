import { Platform } from 'react-native';

import { requireOptionalNativeModule } from 'expo-modules-core';

import type {
  InstalledLLMModel,
  LLMRuntimeBackend,
  LLMRuntimeHealth,
  LLMRuntimeErrorCode,
  LoadModelRequest,
  LoadModelResult,
  NativeLLMRuntimeModule,
  RunInferenceRequest,
  RunInferenceResult,
  UnloadModelResult,
} from './NativeLLMRuntime.types';

export type {
  InstalledLLMModel,
  LLMRuntimeBackend,
  LLMRuntimeErrorCode,
  LLMRuntimeHealth,
  LoadModelRequest,
  LoadModelResult,
  RunInferenceRequest,
  RunInferenceResult,
  UnloadModelResult,
} from './NativeLLMRuntime.types';

const NATIVE_MODULE_NAME = 'NativeLLMRuntime';

const nativeModule =
  requireOptionalNativeModule<NativeLLMRuntimeModule>(NATIVE_MODULE_NAME);

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------

export class NativeLLMRuntimeUnavailableError extends Error {
  readonly code: LLMRuntimeErrorCode = 'RUNTIME_UNAVAILABLE';
  constructor() {
    super(
      'NativeLLMRuntime native module is not linked. ' +
        'This module requires a development build. ' +
        'Run: npx expo prebuild --clean && npx expo run:ios (or run:android).',
    );
    this.name = 'NativeLLMRuntimeUnavailableError';
  }
}

export class BackendUnavailableError extends Error {
  readonly code: LLMRuntimeErrorCode = 'BACKEND_UNAVAILABLE';
  constructor(reason: string) {
    super(reason);
    this.name = 'BackendUnavailableError';
  }
}

export class ModelNotLoadedError extends Error {
  readonly code: LLMRuntimeErrorCode = 'MODEL_NOT_LOADED';
  constructor(modelId: string) {
    super(`No model loaded with ID: '${modelId}'. Call loadModel first.`);
    this.name = 'ModelNotLoadedError';
  }
}

export class ModelLoadFailedError extends Error {
  readonly code: LLMRuntimeErrorCode = 'MODEL_LOAD_FAILED';
  constructor(message: string) {
    super(message);
    this.name = 'ModelLoadFailedError';
  }
}

export class LLMInferenceNotImplementedError extends Error {
  readonly code: LLMRuntimeErrorCode = 'INFERENCE_NOT_IMPLEMENTED';
  constructor() {
    super(
      'runInference is not available on this platform or backend in the current phase. ' +
        'iOS + llama.cpp: link the Swift Package and reload. ' +
        'Android: inference backend is planned for a later dedicated phase.',
    );
    this.name = 'LLMInferenceNotImplementedError';
  }
}

// ---------------------------------------------------------------------------
// Offline health fallback (returned when native module is not linked)
// ---------------------------------------------------------------------------

function offlineHealth(): LLMRuntimeHealth {
  return {
    available: false,
    isLinked: false,
    platform: Platform.OS as 'ios' | 'android',
    backend: 'none',
    supportsStreaming: false,
    supportsCancellation: false,
    supportsQuantizedModels: false,
    supportedFormats: [],
    loadedModelId: null,
    reasonUnavailable:
      'Native module not linked. Create a development build:\n' +
      '  npx expo prebuild --clean\n' +
      '  npx expo run:ios\n' +
      '  # or: npx expo run:android',
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function isLLMRuntimeAvailable(): boolean {
  return nativeModule !== null;
}

export async function getLLMRuntimeHealth(): Promise<LLMRuntimeHealth> {
  if (nativeModule === null) return offlineHealth();
  return nativeModule.getLLMRuntimeHealth();
}

export async function listInstalledModels(): Promise<InstalledLLMModel[]> {
  if (nativeModule === null) throw new NativeLLMRuntimeUnavailableError();
  return nativeModule.listInstalledModels();
}

export async function loadModel(
  request: LoadModelRequest,
): Promise<LoadModelResult> {
  if (nativeModule === null) throw new NativeLLMRuntimeUnavailableError();
  return nativeModule.loadModel(request);
}

export async function unloadModel(modelId: string): Promise<UnloadModelResult> {
  if (nativeModule === null) throw new NativeLLMRuntimeUnavailableError();
  return nativeModule.unloadModel(modelId);
}

/**
 * Run inference on the currently loaded model.
 *
 * Phase 2B status:
 *   - iOS + llama.cpp linked:  routes to real llama.cpp inference via native module
 *   - iOS without llama.cpp:   throws BackendUnavailableError from native
 *   - Android (any):           throws LLMInferenceNotImplementedError (backend planned later)
 *   - Sandbox / Expo Go:       throws NativeLLMRuntimeUnavailableError
 *
 * No fake output is ever returned. Any string in RunInferenceResult.text
 * comes from a real llama.cpp token-sampling loop.
 */
export async function runInference(
  request: RunInferenceRequest,
): Promise<RunInferenceResult> {
  if (nativeModule === null) throw new NativeLLMRuntimeUnavailableError();

  if (typeof nativeModule.runInference !== 'function') {
    throw new LLMInferenceNotImplementedError();
  }

  return nativeModule.runInference(request);
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
