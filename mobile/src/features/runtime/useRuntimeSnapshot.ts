import { useCallback, useEffect, useState } from 'react';

import {
  getRuntimeSnapshot,
  isNativeRuntimeAvailable,
} from 'native-device-runtime';

import { assertValidSnapshot } from './snapshotValidator';
import type {
  NativeRuntimeSnapshot,
  RuntimeError,
  RuntimeStatus,
} from './runtimeTypes';

export type UseRuntimeSnapshotResult = {
  status: RuntimeStatus;
  snapshot: NativeRuntimeSnapshot | null;
  error: RuntimeError | null;
  nativeAvailable: boolean;
  refresh: () => Promise<void>;
};

export function useRuntimeSnapshot(): UseRuntimeSnapshotResult {
  const [status, setStatus] = useState<RuntimeStatus>('idle');
  const [snapshot, setSnapshot] = useState<NativeRuntimeSnapshot | null>(null);
  const [error, setError] = useState<RuntimeError | null>(null);
  const [nativeAvailable, setNativeAvailable] = useState<boolean>(false);

  const refresh = useCallback(async (): Promise<void> => {
    const available = isNativeRuntimeAvailable();
    setNativeAvailable(available);

    if (!available) {
      setStatus('error');
      setSnapshot(null);
      setError({
        name: 'NativeDeviceRuntimeUnavailableError',
        message:
          'Native module not linked. Create a development build:\n' +
          '  npx expo prebuild --clean\n' +
          '  npx expo run:ios\n' +
          '  # or: npx expo run:android',
      });
      return;
    }

    setStatus('loading');
    setError(null);

    try {
      const raw = await getRuntimeSnapshot();
      const validated = assertValidSnapshot(raw);
      setSnapshot(validated);
      setStatus('success');
    } catch (err) {
      const e = err as { name?: string; message?: string };
      setError({
        name: e.name ?? 'Error',
        message: e.message ?? 'Unknown error from native runtime',
      });
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { status, snapshot, error, nativeAvailable, refresh };
}
