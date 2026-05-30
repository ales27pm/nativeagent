import type { NativeRuntimeSnapshot } from './runtimeTypes';

const VALID_PLATFORMS = new Set(['ios', 'android']);
const VALID_THERMAL_STATES = new Set([
  'nominal',
  'fair',
  'serious',
  'critical',
  'unknown',
]);

export type ValidationResult =
  | { valid: true; errors: [] }
  | { valid: false; errors: string[] };

export function validateSnapshot(raw: unknown): ValidationResult {
  if (raw === null || typeof raw !== 'object') {
    return { valid: false, errors: ['snapshot is not an object'] };
  }

  const s = raw as Record<string, unknown>;
  const errors: string[] = [];

  if (!VALID_PLATFORMS.has(s['platform'] as string)) {
    errors.push(
      `platform must be 'ios' | 'android', got: ${String(s['platform'])}`,
    );
  }
  if (typeof s['osVersion'] !== 'string' || s['osVersion'].length === 0) {
    errors.push('osVersion must be a non-empty string');
  }
  if (typeof s['deviceModel'] !== 'string' || s['deviceModel'].length === 0) {
    errors.push('deviceModel must be a non-empty string');
  }
  if (typeof s['processorCount'] !== 'number' || s['processorCount'] < 1) {
    errors.push('processorCount must be a positive number');
  }
  if (
    typeof s['activeProcessorCount'] !== 'number' ||
    s['activeProcessorCount'] < 1
  ) {
    errors.push('activeProcessorCount must be a positive number');
  }
  if (
    typeof s['physicalMemoryBytes'] !== 'number' ||
    s['physicalMemoryBytes'] < 0
  ) {
    errors.push('physicalMemoryBytes must be a non-negative number');
  }
  if (typeof s['lowPowerModeEnabled'] !== 'boolean') {
    errors.push('lowPowerModeEnabled must be boolean');
  }
  if (!VALID_THERMAL_STATES.has(s['thermalState'] as string)) {
    errors.push(
      `thermalState must be 'nominal'|'fair'|'serious'|'critical'|'unknown', got: ${String(s['thermalState'])}`,
    );
  }
  if (s['appVersion'] !== null && typeof s['appVersion'] !== 'string') {
    errors.push('appVersion must be string or null');
  }
  if (s['buildNumber'] !== null && typeof s['buildNumber'] !== 'string') {
    errors.push('buildNumber must be string or null');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }
  return { valid: true, errors: [] };
}

export function assertValidSnapshot(raw: unknown): NativeRuntimeSnapshot {
  const result = validateSnapshot(raw);
  if (!result.valid) {
    throw new Error(
      `NativeRuntimeSnapshot failed shape validation:\n  ${result.errors.join('\n  ')}`,
    );
  }
  return raw as NativeRuntimeSnapshot;
}
