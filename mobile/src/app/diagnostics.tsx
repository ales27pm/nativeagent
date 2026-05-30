import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Platform, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ErrorPanel } from '@/components/ErrorPanel';
import { PressableScale } from '@/components/PressableScale';
import { getBridgeHealth } from '@/lib/bridgeHealth';
import { validateSnapshot } from '@/features/runtime/snapshotValidator';
import { useRuntimeSnapshot } from '@/features/runtime/useRuntimeSnapshot';
import { colors } from '@/theme/colors';
import { radii, spacing } from '@/theme/spacing';
import { fonts, sizes, tracking } from '@/theme/typography';

type DetectableArch = 'new' | 'unknown';

function detectNewArchitecture(): DetectableArch {
  const g = global as unknown as {
    __turboModuleProxy?: unknown;
    nativeFabricUIManager?: unknown;
  };
  if (g.__turboModuleProxy != null || g.nativeFabricUIManager != null) return 'new';
  return 'unknown';
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return String(bytes);
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log10(bytes) / 3));
  return `${(bytes / Math.pow(1000, i)).toFixed(2)} ${units[i]}`;
}

export default function DiagnosticsScreen(): React.JSX.Element {
  const router = useRouter();
  const { snapshot, status, error, refresh } = useRuntimeSnapshot();
  const health = getBridgeHealth();
  const arch = detectNewArchitecture();
  const validation = snapshot !== null ? validateSnapshot(snapshot) : null;

  const handleNav = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/llm-diagnostics');
  }, [router]);

  const handleRefresh = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    void refresh();
  }, [refresh]);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      testID="diagnostics-screen"
      refreshControl={
        <RefreshControl
          refreshing={status === 'loading'}
          onRefresh={handleRefresh}
          tintColor={colors.amber}
          colors={[colors.amber]}
        />
      }
    >
      {/* Bridge Health */}
      <Block label="BRIDGE HEALTH">
        <DataRow
          label="bridgeAvailable"
          value={String(health.bridgeAvailable)}
          highlight={health.bridgeAvailable}
        />
        <DataRow
          label="nativeSnapshotAvailable"
          value={String(health.nativeSnapshotAvailable)}
          highlight={health.nativeSnapshotAvailable}
        />
        <DataRow
          label="runningInDevBuild"
          value={String(health.runningInDevBuild)}
          highlight={health.runningInDevBuild}
        />
        <DataRow
          label="runningInExpoGoLike"
          value={String(health.runningInExpoGoLikeHost)}
          danger={health.runningInExpoGoLikeHost}
        />
        <DataRow
          label="hermesEnabled"
          value={String(health.hermesEnabled)}
          highlight={health.hermesEnabled}
        />
        <DataRow
          label="newArchLikely"
          value={arch}
          highlight={arch === 'new'}
          last
        />
      </Block>

      {/* Next action when bridge is offline */}
      {health.nextAction !== null ? (
        <Block label="NEXT STEP TO ACTIVATE BRIDGE">
          {health.failureReason !== null ? (
            <View style={styles.reasonRow}>
              <Text style={styles.reasonText}>{health.failureReason}</Text>
            </View>
          ) : null}
          <CommandBlock text={health.nextAction} />
        </Block>
      ) : null}

      {/* Environment */}
      <Block label="ENVIRONMENT">
        <DataRow label="platform" value={Platform.OS} />
        <DataRow label="platformVersion" value={String(Platform.Version)} />
        <DataRow
          label="executionEnvironment"
          value={health.runningInDevBuild ? 'bare (dev build)' : 'hosted / storeClient'}
        />
        <DataRow label="hermes" value={String(health.hermesEnabled)} highlight={health.hermesEnabled} />
        <DataRow label="newArchitecture" value={arch} highlight={arch === 'new'} last />
      </Block>

      {/* Runtime snapshot */}
      <Block label="RUNTIME.SNAPSHOT">
        {snapshot !== null ? (
          <>
            <DataRow label="platform" value={snapshot.platform} />
            <DataRow label="osVersion" value={snapshot.osVersion} />
            <DataRow label="deviceModel" value={snapshot.deviceModel} />
            <DataRow label="processorCount" value={String(snapshot.processorCount)} />
            <DataRow
              label="activeProcessorCount"
              value={String(snapshot.activeProcessorCount)}
            />
            <DataRow
              label="physicalMemory"
              value={formatBytes(snapshot.physicalMemoryBytes)}
            />
            <DataRow
              label="lowPowerMode"
              value={String(snapshot.lowPowerModeEnabled)}
              danger={snapshot.lowPowerModeEnabled}
            />
            <DataRow label="thermalState" value={snapshot.thermalState} />
            <DataRow label="appVersion" value={snapshot.appVersion ?? 'null'} />
            <DataRow label="buildNumber" value={snapshot.buildNumber ?? 'null'} last />
          </>
        ) : (
          <Text style={styles.empty}>no snapshot — native bridge offline</Text>
        )}
      </Block>

      {/* Shape validation */}
      <Block label="SHAPE VALIDATION">
        {validation !== null ? (
          <>
            <DataRow
              label="valid"
              value={String(validation.valid)}
              highlight={validation.valid}
            />
            {!validation.valid ? (
              validation.errors.map((e, i) => (
                <DataRow key={i} label={`error[${i}]`} value={e} danger last={i === validation.errors.length - 1} />
              ))
            ) : (
              <DataRow
                label="errors"
                value="none — all fields match contract"
                highlight
                last
              />
            )}
          </>
        ) : (
          <Text style={styles.empty}>no snapshot to validate</Text>
        )}
      </Block>

      {error !== null ? <ErrorPanel error={error} onRetry={refresh} /> : null}

      {/* Navigate to LLM diagnostics */}
      <PressableScale
        onPress={handleNav}
        style={styles.navButton}
        testID="nav-llm-diagnostics"
      >
        <Text style={styles.navButtonLabel}>LLM RUNTIME</Text>
        <Text style={styles.navButtonArrow}>{'▶'}</Text>
      </PressableScale>
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

function CommandBlock({ text }: { text: string }): React.JSX.Element {
  return (
    <View style={styles.commandBlock}>
      {text.split('\n').map((line, i) => (
        <Text key={i} style={styles.commandLine} selectable>
          {line}
        </Text>
      ))}
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
  reasonRow: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  reasonText: {
    fontFamily: fonts.mono,
    fontSize: sizes.sm,
    color: colors.textSub,
    lineHeight: 18,
  },
  commandBlock: {
    backgroundColor: colors.surfaceUp,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: 2,
  },
  commandLine: {
    fontFamily: fonts.mono,
    fontSize: sizes.sm,
    color: colors.amberBright,
    lineHeight: 20,
  },
  empty: {
    fontFamily: fonts.mono,
    fontSize: sizes.sm,
    color: colors.textMuted,
    padding: spacing.lg,
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    minHeight: 44,
  },
  navButtonLabel: {
    fontFamily: fonts.mono,
    fontSize: sizes.sm,
    color: colors.amber,
    letterSpacing: tracking.wider,
  },
  navButtonArrow: {
    fontFamily: fonts.mono,
    fontSize: sizes.xs,
    color: colors.amberDim,
  },
});
