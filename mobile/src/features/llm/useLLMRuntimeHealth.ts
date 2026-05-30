import { useCallback, useEffect, useState } from 'react';

import {
  getLLMRuntimeHealth,
  isLLMRuntimeAvailable,
  listInstalledModels,
} from 'native-llm-runtime';
import type { InstalledLLMModel, LLMRuntimeHealth } from 'native-llm-runtime';

export type LLMRuntimeStatus = 'idle' | 'loading' | 'success' | 'error';

export type UseLLMRuntimeHealthResult = {
  status: LLMRuntimeStatus;
  health: LLMRuntimeHealth | null;
  installedModels: InstalledLLMModel[];
  nativeAvailable: boolean;
  error: string | null;
  refresh: () => Promise<void>;
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

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { status, health, installedModels, nativeAvailable, error, refresh };
}
