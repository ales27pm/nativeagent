import { useCallback, useEffect, useState } from 'react';

import {
  getLLMRuntimeHealth,
  isLLMRuntimeAvailable,
  listInstalledModels,
  loadModel,
  unloadModel,
  runInference,
} from 'native-llm-runtime';
import type {
  InstalledLLMModel,
  LLMRuntimeHealth,
  LoadModelRequest,
  LoadModelResult,
  UnloadModelResult,
  RunInferenceRequest,
  RunInferenceResult,
} from 'native-llm-runtime';

export type LLMRuntimeStatus = 'idle' | 'loading' | 'success' | 'error';

export type UseLLMRuntimeHealthResult = {
  status: LLMRuntimeStatus;
  health: LLMRuntimeHealth | null;
  installedModels: InstalledLLMModel[];
  nativeAvailable: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  loadModel: (request: LoadModelRequest) => Promise<LoadModelResult>;
  unloadModel: (modelId: string) => Promise<UnloadModelResult>;
  runInference: (request: RunInferenceRequest) => Promise<RunInferenceResult>;
};

export function useLLMRuntimeHealth(): UseLLMRuntimeHealthResult {
  const [status, setStatus] = useState<LLMRuntimeStatus>('idle');
  const [health, setHealth] = useState<LLMRuntimeHealth | null>(null);
  const [installedModels, setInstalledModels] = useState<InstalledLLMModel[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [nativeAvailable, setNativeAvailable] = useState<boolean>(false);

  const refresh = useCallback(async (): Promise<void> => {
    const available = isLLMRuntimeAvailable();
    setNativeAvailable(available);
    setStatus('loading');
    setError(null);

    try {
      const h = await getLLMRuntimeHealth();
      setHealth(h);

      if (available) {
        try {
          const models = await listInstalledModels();
          setInstalledModels(models);
        } catch {
          setInstalledModels([]);
        }
      }

      setStatus('success');
    } catch (err) {
      const e = err as { message?: string };
      setError(e.message ?? 'Unknown error from LLM runtime');
      setStatus('error');
    }
  }, []);

  const doLoadModel = useCallback(async (request: LoadModelRequest): Promise<LoadModelResult> => {
    const result = await loadModel(request);
    await refresh();
    return result;
  }, [refresh]);

  const doUnloadModel = useCallback(async (modelId: string): Promise<UnloadModelResult> => {
    const result = await unloadModel(modelId);
    await refresh();
    return result;
  }, [refresh]);

  const doRunInference = useCallback(async (request: RunInferenceRequest): Promise<RunInferenceResult> => {
    return runInference(request);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    status,
    health,
    installedModels,
    nativeAvailable,
    error,
    refresh,
    loadModel: doLoadModel,
    unloadModel: doUnloadModel,
    runInference: doRunInference,
  };
}
