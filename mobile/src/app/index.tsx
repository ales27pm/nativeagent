import { Link } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorPanel } from '@/components/ErrorPanel';
import { RuntimeCard } from '@/components/RuntimeCard';
import { useRuntimeSnapshot } from '@/features/runtime/useRuntimeSnapshot';
import { colors } from '@/theme/colors';
import { radii, spacing } from '@/theme/spacing';
import { fontFamilies, fontSizes, fontWeights } from '@/theme/typography';

export default function HomeScreen(): React.JSX.Element {
  const { status, snapshot, error, nativeAvailable, refresh } = useRuntimeSnapshot();

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerBlock}>
          <Text style={styles.eyebrow}>v0.1.0 · phase one</Text>
          <Text style={styles.title}>NativeAgent</Text>
          <Text style={styles.subtitle}>
            Expo + React Native New Architecture + Native Runtime
          </Text>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusPill,
                nativeAvailable ? styles.pillOk : styles.pillOff,
              ]}
            >
              <View
                style={[
                  styles.statusDot,
                  nativeAvailable ? styles.dotOk : styles.dotOff,
                ]}
              />
              <Text style={styles.statusPillText}>
                {nativeAvailable ? 'NATIVE BRIDGE ONLINE' : 'NATIVE BRIDGE OFFLINE'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <RuntimeCard status={status} snapshot={snapshot} />
        </View>

        {error ? (
          <View style={styles.section}>
            <ErrorPanel error={error} onRetry={refresh} />
          </View>
        ) : null}

        <View style={styles.actions}>
          <Pressable
            onPress={refresh}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Refresh runtime snapshot"
          >
            <Text style={styles.primaryButtonText}>refresh runtime</Text>
          </Pressable>

          <Link href="/diagnostics" asChild>
            <Pressable
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Open diagnostics"
            >
              <Text style={styles.secondaryButtonText}>open diagnostics →</Text>
            </Pressable>
          </Link>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Local Expo module: native-device-runtime
          </Text>
          <Text style={styles.footerHint}>
            Requires a development build. Expo Go cannot load custom native code.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing['4xl'],
    gap: spacing['2xl'],
  },
  headerBlock: {
    gap: spacing.sm,
  },
  eyebrow: {
    fontFamily: fontFamilies.mono,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: fontSizes['3xl'],
    fontWeight: fontWeights.bold,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: fontFamilies.mono,
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  statusRow: {
    flexDirection: 'row',
    marginTop: spacing.md,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pillOk: {
    backgroundColor: colors.accentDim,
    borderColor: colors.accent,
  },
  pillOff: {
    backgroundColor: colors.surface,
    borderColor: colors.borderStrong,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotOk: { backgroundColor: colors.accent },
  dotOff: { backgroundColor: colors.textMuted },
  statusPillText: {
    fontFamily: fontFamilies.mono,
    fontSize: fontSizes.xs,
    color: colors.textPrimary,
    letterSpacing: 1,
  },
  section: {
    gap: spacing.md,
  },
  actions: {
    gap: spacing.md,
  },
  primaryButton: {
    backgroundColor: colors.textPrimary,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.md,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontFamily: fontFamilies.mono,
    fontSize: fontSizes.base,
    color: colors.background,
    fontWeight: fontWeights.semibold,
  },
  secondaryButton: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.md,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontFamily: fontFamilies.mono,
    fontSize: fontSizes.base,
    color: colors.textPrimary,
  },
  pressed: {
    opacity: 0.7,
  },
  footer: {
    paddingTop: spacing.lg,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.xs,
  },
  footerText: {
    fontFamily: fontFamilies.mono,
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
  },
  footerHint: {
    fontFamily: fontFamilies.mono,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    lineHeight: 16,
  },
});
