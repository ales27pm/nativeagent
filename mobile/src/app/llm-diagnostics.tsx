import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { PressableScale } from '@/components/PressableScale';
import { SkeletonBlock } from '@/components/SkeletonBlock';
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
  | { phase: 'smoke-result'; result: RunInferenceResult; timestamp: string }
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
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const path = modelPath.trim();
    if (path.length === 0) {
      setDevState({ phase: 'error', op: 'load', message: 'Enter a model file path first.' });
      return;
    }
    const modelId = path.split('/').pop() ?? path;
    setDevState({ phase: 'loading', op: 'load' });
    try {
      const result = await loadModel({ modelId, localPath: path });
      void Haptics.notificationAsync(
        result.loaded
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Warning,
      );
      setDevState({
        phase: 'result',
        op: 'load',
        message: result.message,
        ok: result.loaded,
      });
    } catch (err) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const e = err as { message?: string };
      setDevState({ phase: 'error', op: 'load', message: e.message ?? 'Load failed.' });
    }
  }

  async function handleUnload(): Promise<void> {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const loadedId = health?.loadedModelId;
    if (loadedId === null || loadedId === undefined) {
      setDevState({ phase: 'error', op: 'unload', message: 'No model is currently loaded.' });
      return;
    }
    setDevState({ phase: 'loading', op: 'unload' });
    try {
      const result = await unloadModel(loadedId);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setDevState({
        phase: 'result',
        op: 'unload',
        message: result.message,
        ok: result.unloaded,
      });
    } catch (err) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const e = err as { message?: string };
      setDevState({ phase: 'error', op: 'unload', message: e.message ?? 'Unload failed.' });
    }
  }

  async function handleSmokeTest(): Promise<void> {
    if (!canInfer) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      const reason = !backendLinked
        ? 'llama.cpp not linked — add Swift Package and rebuild.'
        : health?.loadedModelId === null
          ? 'No model loaded. Load a model first.'
          : 'Backend not ready.';
      setDevState({ phase: 'error', op: 'smoke', message: reason });
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const modelId = health?.loadedModelId ?? '';
    setDevState({ phase: 'loading', op: 'smoke' });
    try {
      const result = await runInference({ modelId, prompt: SMOKE_PROMPT, maxTokens: 32 });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setDevState({ phase: 'smoke-result', result, timestamp: new Date().toISOString() });
    } catch (err) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const e = err as { message?: string };
      setDevState({ phase: 'error', op: 'smoke', message: e.message ?? 'Inference failed.' });
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.kav}
    >
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      testID="llm-diagnostics-screen"
      refreshControl={
        <RefreshControl
          refreshing={status === 'loading'}
          onRefresh={() => void refresh()}
          tintColor={colors.amber}
          colors={[colors.amber]}
        />
      }
    >
      {/* Phase notice */}
      <View style={styles.phaseNotice} testID="llm-phase-notice">
        <Text style={styles.phaseTag}>PHASE 2B.9 — LOCAL XCODE SMOKE TEST</Text>
        <Text style={styles.phaseText}>
          {isIOS
            ? 'Prebuild → open Xcode → add ggml-org/llama.cpp Swift Package to NativeLLMRuntime → rebuild → load .gguf → run smoke test.\n' +
              'Android inference backend is planned for a dedicated future phase.'
            : 'Android inference backend is planned for a dedicated future phase.\n' +
              'iOS llama.cpp backend requires a dev build with the Swift Package linked.'}
        </Text>
      </View>

      {/* Runtime health */}
      <Block label="LLM RUNTIME HEALTH">
        {status === 'loading' && health === null ? (
          <View style={styles.skeletonPad}>
            <SkeletonBlock height={14} width="70%" />
            <SkeletonBlock height={14} width="55%" />
            <SkeletonBlock height={14} width="80%" />
            <SkeletonBlock height={14} width="45%" />
          </View>
        ) : null}
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
          value="none — planned later"
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
                <View style={styles.smokeHeader}>
                  <Text style={[styles.devResultTag, styles.tagOk]}>SMOKE PASS</Text>
                  {devState.result.backend === 'llama_cpp' && isLinked && devState.result.text ? (
                    <Text style={[styles.smokeNativeBadge]} testID="llm-smoke-native-badge">
                      ✓ REAL NATIVE
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.smokeOutput} testID="llm-smoke-output">
                  {`"${devState.result.text.trim()}"`}
                </Text>
                <View style={styles.smokeFields}>
                  <SmokeRow label="backend" value={devState.result.backend} />
                  <SmokeRow label="modelId" value={devState.result.modelId} />
                  <SmokeRow label="tokensSeen" value={String(devState.result.tokensSeen)} />
                  <SmokeRow label="tokensGenerated" value={String(devState.result.tokensGenerated)} />
                  <SmokeRow label="durationMs" value={`${devState.result.durationMs}ms`} />
                  <SmokeRow label="timestamp" value={devState.timestamp} last />
                </View>
                <PressableScale
                  onPress={() => {
                    void Clipboard.setStringAsync(
                      JSON.stringify(
                        {
                          backend: devState.result.backend,
                          modelId: devState.result.modelId,
                          tokensSeen: devState.result.tokensSeen,
                          tokensGenerated: devState.result.tokensGenerated,
                          durationMs: devState.result.durationMs,
                          text: devState.result.text.trim(),
                          timestamp: devState.timestamp,
                        },
                        null,
                        2,
                      ),
                    );
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={styles.copyBtn}
                  testID="llm-smoke-copy"
                >
                  <Text style={styles.copyBtnText}>COPY RESULT</Text>
                </PressableScale>
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
          value="Phase 2C — iOS only (greedy only now)"
        />
        <DataRow
          label="cancellation"
          value="Phase 2C — iOS only"
          last
        />
      </Block>

      {/* Backend roadmap */}
      <Block label="BACKEND ROADMAP">
        <DataRow label="iOS (current)" value="llama.cpp (GGUF)" highlight={isIOS} />
        <DataRow label="iOS (next)" value="MLX Swift (Apple Silicon)" />
        <DataRow label="Android (next)" value="dedicated Android backend phase" />
        <DataRow label="Android options" value="llama.cpp JNI / ExecuTorch / MediaPipe" last />
      </Block>

      {error !== null ? (
        <View style={styles.errorPanel} testID="llm-error-panel">
          <Text style={styles.errorTag}>ERROR</Text>
          <Text style={styles.errorText}>{error}</Text>
          <PressableScale
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              void refresh();
            }}
            style={styles.retryButton}
            testID="llm-retry-button"
          >
            <Text style={styles.retryText}>RETRY</Text>
          </PressableScale>
        </View>
      ) : null}
    </ScrollView>
    </KeyboardAvoidingView>
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
    <PressableScale
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
    </PressableScale>
  );
}

function SmokeRow({
  label,
  value,
  last = false,
}: {
  label: string;
  value: string;
  last?: boolean;
}): React.JSX.Element {
  return (
    <View style={[styles.smokeRow, last ? styles.smokeRowLast : null]}>
      <Text style={styles.smokeRowLabel}>{label}</Text>
      <Text style={styles.smokeRowValue} numberOfLines={1} ellipsizeMode="middle">
        {value}
      </Text>
    </View>
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
  kav: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1, backgroundColor: colors.bg },
  skeletonPad: { padding: spacing.lg, gap: spacing.md },
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
    paddingVertical: spacing.md,
    minHeight: 44,
    justifyContent: 'center',
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
  // Smoke result expanded
  smokeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  smokeNativeBadge: {
    fontFamily: fonts.mono,
    fontSize: sizes.xs,
    color: colors.success,
    letterSpacing: tracking.wider,
  },
  smokeOutput: {
    fontFamily: fonts.mono,
    fontSize: sizes.sm,
    color: colors.text,
    lineHeight: 20,
  },
  smokeFields: {
    borderTopColor: colors.successDim,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    gap: 1,
  },
  smokeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
    borderBottomColor: colors.successDim,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  smokeRowLast: { borderBottomWidth: 0 },
  smokeRowLabel: {
    fontFamily: fonts.mono,
    fontSize: sizes.xs,
    color: colors.textMuted,
  },
  smokeRowValue: {
    fontFamily: fonts.mono,
    fontSize: sizes.xs,
    color: colors.textSub,
    flexShrink: 1,
    textAlign: 'right',
    marginLeft: spacing.sm,
  },
  copyBtn: {
    alignSelf: 'flex-start',
    borderColor: colors.success,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
  },
  copyBtnText: {
    fontFamily: fonts.mono,
    fontSize: sizes.xs,
    color: colors.success,
    letterSpacing: tracking.wider,
  },
});
