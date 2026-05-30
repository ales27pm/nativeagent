import Constants from 'expo-constants';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ErrorPanel } from '@/components/ErrorPanel';
import { useRuntimeSnapshot } from '@/features/runtime/useRuntimeSnapshot';
import { colors } from '@/theme/colors';
import { radii, spacing } from '@/theme/spacing';
import { fontFamilies, fontSizes, fontWeights } from '@/theme/typography';

type DetectableArch = 'new' | 'unknown';

function detectNewArchitecture(): DetectableArch {
  const globalAny = global as unknown as {
    __turboModuleProxy?: unknown;
    nativeFabricUIManager?: unknown;
  };
  if (globalAny.__turboModuleProxy != null || globalAny.nativeFabricUIManager != null) {
    return 'new';
  }
  return 'unknown';
}

export default function DiagnosticsScreen(): React.JSX.Element {
  const { status, snapshot, error, nativeAvailable, refresh } = useRuntimeSnapshot();
  const arch = detectNewArchitecture();
  const executionEnv = Constants.executionEnvironment;
  const appOwnership = Constants.appOwnership ?? 'standalone';

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Section title="bridge">
        <Row label="nativeModuleAvailable" value={String(nativeAvailable)} />
        <Row label="status" value={status} />
      </Section>

      <Section title="environment">
        <Row label="platform" value={Platform.OS} />
        <Row label="platformVersion" value={String(Platform.Version)} />
        <Row label="executionEnvironment" value={executionEnv} />
        <Row label="appOwnership" value={appOwnership} />
        <Row label="hermes" value={String(isHermes())} />
        <Row label="newArchitecture" value={arch} />
      </Section>

      <Section title="runtime.snapshot">
        {snapshot ? (
          <>
            <Row label="platform" value={snapshot.platform} />
            <Row label="osVersion" value={snapshot.osVersion} />
            <Row label="deviceModel" value={snapshot.deviceModel} />
            <Row
              label="processorCount"
              value={String(snapshot.processorCount)}
            />
            <Row
              label="activeProcessorCount"
              value={String(snapshot.activeProcessorCount)}
            />
            <Row
              label="physicalMemoryBytes"
              value={formatBytes(snapshot.physicalMemoryBytes)}
            />
            <Row
              label="lowPowerModeEnabled"
              value={String(snapshot.lowPowerModeEnabled)}
            />
            <Row label="thermalState" value={snapshot.thermalState} />
            <Row label="appVersion" value={snapshot.appVersion ?? 'null'} />
            <Row label="buildNumber" value={snapshot.buildNumber ?? 'null'} />
          </>
        ) : (
          <Text style={styles.muted}>No snapshot available.</Text>
        )}
      </Section>

      {error ? <ErrorPanel error={error} onRetry={refresh} /> : null}
    </ScrollView>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={1} ellipsizeMode="middle">
        {value}
      </Text>
    </View>
  );
}

function isHermes(): boolean {
  return typeof (globalThis as { HermesInternal?: unknown }).HermesInternal !== 'undefined';
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return `${bytes}`;
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log10(bytes) / 3));
  const scaled = bytes / Math.pow(1000, i);
  return `${scaled.toFixed(2)} ${units[i]} (${bytes})`;
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.xl,
    gap: spacing['2xl'],
    paddingBottom: spacing['4xl'],
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    fontFamily: fontFamilies.mono,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  sectionBody: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.md,
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
    gap: spacing.lg,
  },
  rowLabel: {
    fontFamily: fontFamilies.mono,
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    flexShrink: 0,
  },
  rowValue: {
    fontFamily: fontFamilies.mono,
    fontSize: fontSizes.sm,
    color: colors.textPrimary,
    flexShrink: 1,
    textAlign: 'right',
    fontWeight: fontWeights.medium,
  },
  muted: {
    fontFamily: fontFamilies.mono,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    padding: spacing.lg,
  },
});
