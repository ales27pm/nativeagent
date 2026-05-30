import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { RuntimeError } from '@/features/runtime/runtimeTypes';
import { colors } from '@/theme/colors';
import { radii, spacing } from '@/theme/spacing';
import { fontFamilies, fontSizes, fontWeights } from '@/theme/typography';

type ErrorPanelProps = {
  error: RuntimeError;
  onRetry?: () => void;
};

export function ErrorPanel({ error, onRetry }: ErrorPanelProps): React.JSX.Element {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.tag}>NATIVE BRIDGE</Text>
        <Text style={styles.name}>{error.name}</Text>
      </View>
      <Text style={styles.message} selectable>
        {error.message}
      </Text>
      {onRetry ? (
        <Pressable
          onPress={onRetry}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          accessibilityRole="button"
          accessibilityLabel="Retry native runtime"
        >
          <Text style={styles.buttonText}>retry()</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderColor: colors.borderStrong,
    borderWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 3,
    borderLeftColor: colors.warning,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.lg,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  tag: {
    fontFamily: fontFamilies.mono,
    fontSize: fontSizes.xs,
    color: colors.warning,
    letterSpacing: 1,
  },
  name: {
    fontFamily: fontFamilies.mono,
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
  },
  message: {
    fontFamily: fontFamilies.mono,
    fontSize: fontSizes.sm,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  button: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceElevated,
  },
  buttonPressed: {
    backgroundColor: colors.border,
  },
  buttonText: {
    fontFamily: fontFamilies.mono,
    fontSize: fontSizes.sm,
    color: colors.accent,
    fontWeight: fontWeights.semibold,
  },
});
