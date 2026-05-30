import Constants from 'expo-constants';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ErrorPanel } from '@/components/ErrorPanel';
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

function isHermes(): boolean {
  return typeof (globalThis as { HermesInternal?: unknown }).HermesInternal !== 'undefined';
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return String(bytes);
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log10(bytes) / 3));
  return `${(bytes / Math.pow(1000, i)).toFixed(2)} ${units[i]}`;
}

export default function DiagnosticsScreen(): React.JSX.Element {
  const { status, snapshot, error, nativeAvailable, refresh } = useRuntimeSnapshot();
  const arch = detectNewArchitecture();
  const hermesOn = isHermes();

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      testID="diagnostics-screen"
    >
      <Block label="BRIDGE">
        <DataRow
          label="nativeModuleAvailable"
          value={String(nativeAvailable)}
          highlight={nativeAvailable}
        />
        <DataRow label="status" value={status} last />
      </Block>

      <Block label="ENVIRONMENT">
        <DataRow label="platform" value={Platform.OS} />
        <DataRow label="platformVersion" value={String(Platform.Version)} />
        <DataRow label="executionEnvironment" value={Constants.executionEnvironment} />
        <DataRow label="appOwnership" value={Constants.appOwnership ?? 'standalone'} />
        <DataRow label="hermes" value={String(hermesOn)} highlight={hermesOn} />
        <DataRow label="newArchitecture" value={arch} highlight={arch === 'new'} last />
      </Block>

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
            />
            <DataRow label="thermalState" value={snapshot.thermalState} />
            <DataRow label="appVersion" value={snapshot.appVersion ?? 'null'} />
            <DataRow label="buildNumber" value={snapshot.buildNumber ?? 'null'} last />
          </>
        ) : (
          <Text style={styles.empty}>no snapshot available</Text>
        )}
      </Block>

      {error !== null ? <ErrorPanel error={error} onRetry={refresh} /> : null}
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
  last = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  last?: boolean;
}): React.JSX.Element {
  return (
    <View style={[styles.row, last ? styles.rowLast : null]}>
      <Text style={styles.rowLabel} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.rowRight}>
        <Text style={styles.rowArrow}>{'▸'}</Text>
        <Text
          style={[styles.rowValue, highlight ? styles.rowValueHL : null]}
          numberOfLines={1}
          ellipsizeMode="middle"
        >
          {value}
        </Text>
      </View>
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
    alignItems: 'center',
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
    flexShrink: 1,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexShrink: 1,
  },
  rowArrow: {
    fontFamily: fonts.mono,
    fontSize: sizes.xs,
    color: colors.amberDim,
  },
  rowValue: {
    fontFamily: fonts.mono,
    fontSize: sizes.sm,
    color: colors.textSub,
    textAlign: 'right',
    flexShrink: 1,
  },
  rowValueHL: { color: colors.success },
  empty: {
    fontFamily: fonts.mono,
    fontSize: sizes.sm,
    color: colors.textMuted,
    padding: spacing.lg,
  },
});
