import React, { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useLLMRuntimeHealth } from '@/features/llm/useLLMRuntimeHealth';
import { colors } from '@/theme/colors';
import { radii, spacing } from '@/theme/spacing';
import { fonts, sizes, tracking } from '@/theme/typography';
import type { RunInferenceResult } from 'native-llm-runtime';

const SMOKE_PROMPT = 'Q: What is 2+2? A:';

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return String(bytes);
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log10(bytes) / 3));
  return `${(bytes / Math.pow(1000, i)).toFixed(2)} ${units[i]}`;
}

type DevToolState =
  | { phase: 'idle' }
  | { phase: 'loading'; op: 'load' | 'unload' | 'smoke' }
  | { phase: 'result'; op: 'load' | 'unload'; message: string; ok: boolean }
  | { phase: 'smoke-result'; result: RunInferenceResult }
  | { phase: 'error'; op: 'load' | 'unload' | 'smoke'; message: string };

export default function LLMDiagnosticsScreen(): React.JSX.Element {
  const {
    health,
    installedModels,
    nativeAvailable,
    error,
    refresh,
    status,
    loadModel,
    unloadModel,
    runInference,
  } = useLLMRuntimeHealth();

  const [modelPath, setModelPath] = useState<string>('');
  const [devState, setDevState] = useState<DevToolState>({ phase: 'idle' });

  const isLinked = health?.isLinked ?? false;
  const backendLinked = isLinked && health?.backend !== 'none';
  const isIOS = Platform.OS === 'ios';
  const canInfer =
    backendLinked &&
    health?.backend === 'llama_cpp' &&
    isLinked &&
    health?.loadedModelId !== null;

  // ── Dev tool actions ──────────────────────────────────────────────────────

  async function handleLoad(): Promise<void> {
    const path = modelPath.trim();
    if (path.length === 0) {
      setDevState({ phase: 'error', op: 'load', message: 'Enter a model file path first.' });
      return;
    }
    const modelId = path.split('/').pop() ?? path;
    setDevState({ phase: 'loading', op: 'load' });
    try {
      const result = await loadModel({ modelId, localPath: path });
      setDevState({
        phase: 'result',
        op: 'load',
        message: result.message,
        ok: result.loaded,
      });
    } catch (err) {
      const e = err as { message?: string };
      setDevState({ phase: 'error', op: 'load', message: e.message ?? 'Load failed.' });
    }
  }

  async function handleUnload(): Promise<void> {
    const loadedId = health?.loadedModelId;
    if (loadedId === null || loadedId === undefined) {
      setDevState({ phase: 'error', op: 'unload', message: 'No model is currently loaded.' });
      return;
    }
    setDevState({ phase: 'loading', op: 'unload' });
    try {
      const result = await unloadModel(loadedId);
      setDevState({
        phase: 'result',
        op: 'unload',
        message: result.message,
        ok: result.unloaded,
      });
    } catch (err) {
      const e = err as { message?: string };
      setDevState({ phase: 'error', op: 'unload', message: e.message ?? 'Unload failed.' });
    }
  }

  async function handleSmokeTest(): Promise<void> {
    if (!canInfer) {
      const reason = !backendLinked
        ? 'llama.cpp not linked — add Swift Package and rebuild.'
        : health?.loadedModelId === null
          ? 'No model loaded. Load a model first.'
          : 'Backend not ready.';
      setDevState({ phase: 'error', op: 'smoke', message: reason });
      return;
    }
    const modelId = health?.loadedModelId ?? '';
    setDevState({ phase: 'loading', op: 'smoke' });
    try {
      const result = await runInference({ modelId, prompt: SMOKE_PROMPT, maxTokens: 32 });
      setDevState({ phase: 'smoke-result', result });
    } catch (err) {
      const e = err as { message?: string };
      setDevState({ phase: 'error', op: 'smoke', message: e.message ?? 'Inference failed.' });
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      testID="llm-diagnostics-screen"
    >
      {/* Phase notice */}
      <View style={styles.phaseNotice} testID="llm-phase-notice">
        <Text style={styles.phaseTag}>PHASE 2B.5 — iOS LINK VALIDATION</Text>
        <Text style={styles.phaseText}>
          {isIOS
            ? 'Add the llama Swift Package → rebuild → load a .gguf model → run smoke test.\n' +
              'Android: inference backend not integrated (Phase 2C).'
            : 'Android: inference backend not integrated in Phase 2B.\n' +
              'iOS llama.cpp backend will be available in a dev build.'}
        </Text>
      </View>

      {/* Runtime health */}
      <Block label="LLM RUNTIME HEALTH">
        <DataRow
          label="nativeAvailable"
          value={String(nativeAvailable)}
          highlight={nativeAvailable}
          danger={!nativeAvailable}
        />
        {health !== null ? (
          <>
            <DataRow
              label="isLinked"
              value={String(health.isLinked)}
              highlight={health.isLinked}
              danger={!health.isLinked}
            />
            <DataRow
              label="available"
              value={String(health.available)}
              highlight={health.available}
              danger={!health.available}
            />
            <DataRow label="platform" value={health.platform} />
            <DataRow
              label="backend"
              value={health.backend}
              highlight={backendLinked}
              danger={!backendLinked}
            />
            <DataRow
              label="supportsStreaming"
              value={String(health.supportsStreaming)}
              highlight={health.supportsStreaming}
            />
            <DataRow
              label="supportsCancellation"
              value={String(health.supportsCancellation)}
              highlight={health.supportsCancellation}
            />
            <DataRow
              label="supportsQuantized"
              value={String(health.supportsQuantizedModels)}
              highlight={health.supportsQuantizedModels}
            />
            <DataRow
              label="supportedFormats"
              value={
                health.supportedFormats.length > 0
                  ? health.supportedFormats.join(', ')
                  : 'none'
              }
              highlight={health.supportedFormats.length > 0}
            />
            <DataRow
              label="loadedModelId"
              value={health.loadedModelId ?? 'null'}
              highlight={health.loadedModelId !== null}
              last={health.reasonUnavailable === null}
            />
            {health.reasonUnavailable !== null ? (
              <DataRow
                label="reasonUnavailable"
                value={health.reasonUnavailable}
                danger
                last
              />
            ) : null}
          </>
        ) : (
          <Text style={styles.empty} testID="llm-health-loading">
            {status === 'loading' ? 'loading…' : 'no health data'}
          </Text>
        )}
      </Block>

      {/* Backend status */}
      <Block label="BACKEND STATUS">
        <DataRow
          label="llama.cpp linked"
          value={
            isIOS
              ? isLinked
                ? 'yes ✓'
                : 'no — add Swift Package'
              : 'n/a (android)'
          }
          highlight={isIOS ? isLinked : false}
          danger={isIOS ? !isLinked : false}
        />
        <DataRow
          label="GGUF ready"
          value={
            isIOS
              ? isLinked
                ? health?.loadedModelId !== null
                  ? 'yes — model loaded'
                  : 'linked, no model loaded'
                : 'no — link llama.cpp first'
              : 'n/a (android)'
          }
          highlight={isIOS ? (isLinked && health?.loadedModelId !== null) : false}
          danger={isIOS ? !isLinked : false}
        />
        <DataRow
          label="Android backend"
          value="none — Phase 2C"
          danger={Platform.OS === 'android'}
          last
        />
      </Block>

      {/* Linking instructions when backend is not linked on iOS */}
      {isIOS && !isLinked ? (
        <Block label="TO ACTIVATE llama.cpp ON iOS">
          <View style={styles.codeBlock}>
            <Text style={styles.codeLine} selectable>{'# 1. Prebuild:'}</Text>
            <Text style={styles.codeLine} selectable>{'npx expo prebuild --clean'}</Text>
            <Text style={styles.codeLine} selectable>{'# 2. Open Xcode:'}</Text>
            <Text style={styles.codeLine} selectable>
              {'open ios/<Project>.xcworkspace'}
            </Text>
            <Text style={styles.codeLine} selectable>
              {'# 3. File → Add Package Dependencies…'}
            </Text>
            <Text style={styles.codeLine} selectable>
              {'#    https://github.com/ggml-org/llama.cpp'}
            </Text>
            <Text style={styles.codeLine} selectable>
              {'#    Product: llama → target: NativeLLMRuntime'}
            </Text>
            <Text style={styles.codeLine} selectable>{'# 4. Rebuild:'}</Text>
            <Text style={styles.codeLine} selectable>{'npx expo run:ios'}</Text>
            <Text style={styles.codeLine} selectable>
              {'# 5. Copy a .gguf model to Documents/'}
            </Text>
          </View>
        </Block>
      ) : null}

      {/* Dev tools — manual model path + load/unload/smoke */}
      {nativeAvailable ? (
        <Block label="DEV TOOLS — MODEL MANAGEMENT">
          <View style={styles.devToolsBody}>
            <Text style={styles.devLabel}>MODEL PATH</Text>
            <TextInput
              style={styles.pathInput}
              value={modelPath}
              onChangeText={setModelPath}
              placeholder="/var/mobile/…/Documents/model.gguf"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              testID="llm-model-path-input"
            />
            <View style={styles.buttonRow}>
              <DevButton
                label="LOAD MODEL"
                onPress={() => void handleLoad()}
                disabled={devState.phase === 'loading'}
                testID="llm-load-button"
              />
              <DevButton
                label="UNLOAD"
                onPress={() => void handleUnload()}
                disabled={devState.phase === 'loading' || health?.loadedModelId === null}
                testID="llm-unload-button"
              />
              <DevButton
                label="SMOKE TEST"
                onPress={() => void handleSmokeTest()}
                disabled={devState.phase === 'loading' || !canInfer}
                highlight={canInfer}
                testID="llm-smoke-button"
              />
            </View>

            {/* Dev tool result panel */}
            {devState.phase === 'loading' ? (
              <View style={styles.devResult} testID="llm-dev-loading">
                <ActivityIndicator size="small" color={colors.amberBright} />
                <Text style={styles.devResultText}>
                  {devState.op === 'smoke' ? 'running inference…' : `${devState.op}ing model…`}
                </Text>
              </View>
            ) : devState.phase === 'result' ? (
              <View
                style={[styles.devResult, devState.ok ? styles.devResultOk : styles.devResultWarn]}
                testID="llm-dev-result"
              >
                <Text style={[styles.devResultTag, devState.ok ? styles.tagOk : styles.tagWarn]}>
                  {devState.op.toUpperCase()} {devState.ok ? 'SUCCESS' : 'INFO'}
                </Text>
                <Text style={styles.devResultText}>{devState.message}</Text>
              </View>
            ) : devState.phase === 'smoke-result' ? (
              <View style={[styles.devResult, styles.devResultOk]} testID="llm-smoke-result">
                <Text style={[styles.devResultTag, styles.tagOk]}>SMOKE PASS</Text>
                <Text style={styles.devResultText}>
                  {`"${devState.result.text.trim()}"`}
                </Text>
                <Text style={styles.devResultMeta}>
                  {`${devState.result.tokensGenerated} tokens · ${devState.result.durationMs}ms · ${devState.result.backend}`}
                </Text>
              </View>
            ) : devState.phase === 'error' ? (
              <View style={[styles.devResult, styles.devResultErr]} testID="llm-dev-error">
                <Text style={[styles.devResultTag, styles.tagErr]}>
                  {devState.op.toUpperCase()} ERROR
                </Text>
                <Text style={styles.devResultText}>{devState.message}</Text>
              </View>
            ) : null}

            <Text style={styles.devHint}>
              {'Smoke prompt: "'}
              <Text style={styles.devHintCode}>{SMOKE_PROMPT}</Text>
              {'" — only calls runInference when llama.cpp is linked + model loaded.'}
            </Text>
          </View>
        </Block>
      ) : null}

      {/* Installed models */}
      <Block label="INSTALLED MODELS">
        {!nativeAvailable ? (
          <Text style={styles.empty}>
            native bridge offline — model scan unavailable
          </Text>
        ) : installedModels.length === 0 ? (
          <Text style={styles.empty}>
            no models found in app documents directory
          </Text>
        ) : (
          installedModels.map((model, i) => (
            <View key={model.id} style={styles.modelCard}>
              <Text style={styles.modelName}>{model.name}</Text>
              <View style={styles.modelMeta}>
                <MetaChip label={model.format} />
                <MetaChip label={formatBytes(model.sizeBytes)} />
              </View>
              <Text
                style={styles.modelPath}
                numberOfLines={1}
                ellipsizeMode="middle"
                selectable
              >
                {model.localPath}
              </Text>
              {i < installedModels.length - 1 ? (
                <View style={styles.modelDivider} />
              ) : null}
            </View>
          ))
        )}
        {nativeAvailable ? (
          <DataRow
            label="count"
            value={String(installedModels.length)}
            highlight={installedModels.length > 0}
            last
          />
        ) : null}
      </Block>

      {/* Inference status */}
      <Block label="INFERENCE STATUS">
        <DataRow
          label="runInference"
          value={
            canInfer
              ? 'ready — llama.cpp + model loaded'
              : backendLinked
                ? 'load a model first'
                : 'backend not linked'
          }
          highlight={canInfer}
          danger={!backendLinked}
        />
        <DataRow
          label="streaming"
          value="Phase 2C (greedy only in 2B)"
        />
        <DataRow
          label="cancellation"
          value="Phase 2C"
          last
        />
      </Block>

      {/* Backend roadmap */}
      <Block label="BACKEND ROADMAP">
        <DataRow label="iOS (current)" value="llama.cpp (GGUF)" highlight={isIOS} />
        <DataRow label="iOS (next)" value="MLX Swift (Apple Silicon)" />
        <DataRow label="Android (next)" value="llama.cpp JNI — Phase 2C" />
        <DataRow label="Android (alt)" value="ExecuTorch / MediaPipe" last />
      </Block>

      {error !== null ? (
        <View style={styles.errorPanel} testID="llm-error-panel">
          <Text style={styles.errorTag}>ERROR</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable
            onPress={() => void refresh()}
            style={styles.retryButton}
            testID="llm-retry-button"
          >
            <Text style={styles.retryText}>RETRY</Text>
          </Pressable>
        </View>
      ) : null}
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Block({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <View style={styles.block}>
      <Text style={styles.blockLabel}>{label}</Text>
      <View style={styles.blockBody}>{children}</View>
    </View>
  );
}

function DataRow({
  label,
  value,
  highlight = false,
  danger = false,
  last = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  danger?: boolean;
  last?: boolean;
}): React.JSX.Element {
  const valueColor = highlight
    ? colors.success
    : danger
      ? colors.danger
      : colors.textSub;

  return (
    <View style={[styles.row, last ? styles.rowLast : null]}>
      <Text style={styles.rowLabel} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.rowRight}>
        <Text style={styles.rowArrow}>{'▸'}</Text>
        <Text
          style={[styles.rowValue, { color: valueColor }]}
          numberOfLines={2}
          ellipsizeMode="tail"
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

function DevButton({
  label,
  onPress,
  disabled = false,
  highlight = false,
  testID,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  highlight?: boolean;
  testID?: string;
}): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.devBtn,
        highlight ? styles.devBtnHighlight : null,
        disabled ? styles.devBtnDisabled : null,
      ]}
      testID={testID}
    >
      <Text
        style={[
          styles.devBtnText,
          highlight ? styles.devBtnTextHighlight : null,
          disabled ? styles.devBtnTextDisabled : null,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function MetaChip({ label }: { label: string }): React.JSX.Element {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipText}>{label}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.bg },
  content: {
    padding: spacing.xl,
    paddingBottom: spacing['4xl'],
    gap: spacing['2xl'],
  },
  phaseNotice: {
    backgroundColor: colors.amberFaint,
    borderColor: colors.borderGlow,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.sm,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  phaseTag: {
    fontFamily: fonts.mono,
    fontSize: sizes.xs,
    color: colors.amberBright,
    letterSpacing: tracking.widest,
  },
  phaseText: {
    fontFamily: fonts.mono,
    fontSize: sizes.sm,
    color: colors.textSub,
    lineHeight: 18,
  },
  block: { gap: spacing.sm },
  blockLabel: {
    fontFamily: fonts.mono,
    fontSize: sizes.xs,
    color: colors.textMuted,
    letterSpacing: tracking.widest,
  },
  blockBody: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.sm,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.xl,
  },
  rowLast: { borderBottomWidth: 0 },
  rowLabel: {
    fontFamily: fonts.mono,
    fontSize: sizes.sm,
    color: colors.textMuted,
    flexShrink: 0,
    paddingTop: 1,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    flexShrink: 1,
  },
  rowArrow: {
    fontFamily: fonts.mono,
    fontSize: sizes.xs,
    color: colors.amberDim,
    paddingTop: 2,
  },
  rowValue: {
    fontFamily: fonts.mono,
    fontSize: sizes.sm,
    textAlign: 'right',
    flexShrink: 1,
    lineHeight: 18,
  },
  empty: {
    fontFamily: fonts.mono,
    fontSize: sizes.sm,
    color: colors.textMuted,
    padding: spacing.lg,
  },
  codeBlock: {
    backgroundColor: colors.surfaceUp,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: 2,
  },
  codeLine: {
    fontFamily: fonts.mono,
    fontSize: sizes.sm,
    color: colors.amberBright,
    lineHeight: 20,
  },
  // Dev tools
  devToolsBody: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  devLabel: {
    fontFamily: fonts.mono,
    fontSize: sizes.xs,
    color: colors.textMuted,
    letterSpacing: tracking.wider,
  },
  pathInput: {
    fontFamily: fonts.mono,
    fontSize: sizes.sm,
    color: colors.text,
    backgroundColor: colors.surfaceUp,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  devBtn: {
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  devBtnHighlight: {
    borderColor: colors.amberBright,
    backgroundColor: colors.amberFaint,
  },
  devBtnDisabled: {
    opacity: 0.35,
  },
  devBtnText: {
    fontFamily: fonts.mono,
    fontSize: sizes.xs,
    color: colors.textSub,
    letterSpacing: tracking.wider,
  },
  devBtnTextHighlight: {
    color: colors.amberBright,
  },
  devBtnTextDisabled: {
    color: colors.textMuted,
  },
  devResult: {
    borderRadius: radii.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
    flexDirection: 'column',
  },
  devResultOk: {
    borderColor: colors.success,
    backgroundColor: colors.successDim,
  },
  devResultWarn: {
    borderColor: colors.amberBright,
    backgroundColor: colors.amberFaint,
  },
  devResultErr: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerDim,
  },
  devResultTag: {
    fontFamily: fonts.mono,
    fontSize: sizes.xs,
    letterSpacing: tracking.widest,
  },
  tagOk: { color: colors.success },
  tagWarn: { color: colors.amberBright },
  tagErr: { color: colors.danger },
  devResultText: {
    fontFamily: fonts.mono,
    fontSize: sizes.sm,
    color: colors.textSub,
    lineHeight: 18,
  },
  devResultMeta: {
    fontFamily: fonts.mono,
    fontSize: sizes.xs,
    color: colors.textMuted,
  },
  devHint: {
    fontFamily: fonts.mono,
    fontSize: sizes.xs,
    color: colors.textMuted,
    lineHeight: 16,
  },
  devHintCode: {
    color: colors.amberDim,
  },
  // Model list
  modelCard: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  modelName: {
    fontFamily: fonts.mono,
    fontSize: sizes.sm,
    color: colors.text,
  },
  modelMeta: { flexDirection: 'row', gap: spacing.xs },
  chip: {
    backgroundColor: colors.surfaceUp,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  chipText: {
    fontFamily: fonts.mono,
    fontSize: sizes.xs,
    color: colors.amberBright,
  },
  modelPath: {
    fontFamily: fonts.mono,
    fontSize: sizes.xs,
    color: colors.textMuted,
  },
  modelDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginTop: spacing.sm,
  },
  // Error panel
  errorPanel: {
    backgroundColor: colors.dangerDim,
    borderColor: colors.danger,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.sm,
    padding: spacing.lg,
    gap: spacing.md,
  },
  errorTag: {
    fontFamily: fonts.mono,
    fontSize: sizes.xs,
    color: colors.danger,
    letterSpacing: tracking.widest,
  },
  errorText: {
    fontFamily: fonts.mono,
    fontSize: sizes.sm,
    color: colors.textSub,
    lineHeight: 18,
  },
  retryButton: {
    alignSelf: 'flex-start',
    borderColor: colors.danger,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  retryText: {
    fontFamily: fonts.mono,
    fontSize: sizes.xs,
    color: colors.danger,
    letterSpacing: tracking.wider,
  },
});
