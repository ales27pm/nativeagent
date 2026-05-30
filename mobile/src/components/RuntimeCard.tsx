import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { NativeRuntimeSnapshot, RuntimeStatus } from '@/features/runtime/runtimeTypes';
import { colors } from '@/theme/colors';
import { radii, spacing } from '@/theme/spacing';
import { fontFamilies, fontSizes, fontWeights } from '@/theme/typography';

type RuntimeCardProps = {
  status: RuntimeStatus;
  snapshot: NativeRuntimeSnapshot | null;
};

export function RuntimeCard({ status, snapshot }: RuntimeCardProps): React.JSX.Element {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View
            style={[
              styles.dot,
              status === 'success'
                ? styles.dotOk
                : status === 'loading'
                  ? styles.dotPending
                  : styles.dotError,
            ]}
          />
          <Text style={styles.title}>runtime.snapshot</Text>
        </View>
        <Text style={styles.statusText}>{status.toUpperCase()}</Text>
      </View>

      <View style={styles.body}>
        {status === 'loading' ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.muted}>Reading native runtime…</Text>
          </View>
        ) : snapshot ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.jsonScroll}
          >
            <Text style={styles.json} selectable>
              {formatJson(snapshot)}
            </Text>
          </ScrollView>
        ) : (
          <Text style={styles.muted}>No snapshot.</Text>
        )}
      </View>
    </View>
  );
}

function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceElevated,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotOk: { backgroundColor: colors.accent },
  dotPending: { backgroundColor: colors.info },
  dotError: { backgroundColor: colors.danger },
  title: {
    fontFamily: fontFamilies.mono,
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
  },
  statusText: {
    fontFamily: fontFamilies.mono,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    letterSpacing: 1,
  },
  body: {
    padding: spacing.lg,
    minHeight: 120,
  },
  jsonScroll: {
    paddingRight: spacing.lg,
  },
  json: {
    fontFamily: fontFamilies.mono,
    fontSize: fontSizes.sm,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  muted: {
    fontFamily: fontFamilies.mono,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
  },
});
