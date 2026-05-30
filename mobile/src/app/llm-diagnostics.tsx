import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useLLMRuntimeHealth } from '@/features/llm/useLLMRuntimeHealth';
import { colors } from '@/theme/colors';
import { radii, spacing } from '@/theme/spacing';
import { fonts, sizes, tracking } from '@/theme/typography';

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return String(bytes);
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log10(bytes) / 3));
  return `${(bytes / Math.pow(1000, i)).toFixed(2)} ${units[i]}`;
}

export default function LLMDiagnosticsScreen(): React.JSX.Element {
  const { health, installedModels, nativeAvailable, error, refresh, status } =
    useLLMRuntimeHealth();

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      testID="llm-diagnostics-screen"
    >
      {/* Phase notice */}
      <View style={styles.phaseNotice}>
        <Text style={styles.phaseTag}>PHASE 2A</Text>
        <Text style={styles.phaseText}>
          {'Contract + lifecycle layer only. No inference backend is linked.\n' +
            'Phase 2B will integrate llama.cpp or MLX Swift (iOS) and\n' +
            'llama.cpp Android or ExecuTorch (Android).'}
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
              label="available"
              value={String(health.available)}
              highlight={health.available}
              danger={!health.available}
            />
            <DataRow label="platform" value={health.platform} />
            <DataRow
              label="backend"
              value={health.backend}
              highlight={health.backend !== 'none'}
              danger={health.backend === 'none'}
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
          <Text style={styles.empty}>
            {status === 'loading' ? 'loading…' : 'no health data'}
          </Text>
        )}
      </Block>

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
              <Text style={styles.modelPath} numberOfLines={1} ellipsizeMode="middle">
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
          value="not implemented"
          danger
        />
        <DataRow
          label="phase"
          value="2B — backend integration pending"
          last
        />
      </Block>

      {/* Backend options */}
      <Block label="NEXT BACKEND OPTIONS">
        <DataRow label="iOS option A" value="llama.cpp (gguf, GGML)" />
        <DataRow label="iOS option B" value="MLX Swift (Apple Silicon)" />
        <DataRow label="Android option A" value="llama.cpp Android" />
        <DataRow label="Android option B" value="ExecuTorch (Meta)" />
        <DataRow label="Android option C" value="MediaPipe LLM Inference" last />
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

function MetaChip({ label }: { label: string }): React.JSX.Element {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipText}>{label}</Text>
    </View>
  );
}

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
  modelMeta: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
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
