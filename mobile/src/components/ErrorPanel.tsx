import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { RuntimeError } from '@/features/runtime/runtimeTypes';
import { colors } from '@/theme/colors';
import { radii, spacing } from '@/theme/spacing';
import { fonts, sizes, tracking } from '@/theme/typography';

type ErrorPanelProps = {
  error: RuntimeError;
  onRetry?: () => void;
};

export function ErrorPanel({ error, onRetry }: ErrorPanelProps): React.JSX.Element {
  return (
    <View style={styles.container}>
      <View style={styles.tagRow}>
        <View style={styles.tag}>
          <Text style={styles.tagText}>BRIDGE.ERROR</Text>
        </View>
      </View>
      <Text style={styles.name}>{error.name}</Text>
      <Text style={styles.message} selectable>
        {error.message}
      </Text>
      {onRetry !== undefined ? (
        <Pressable
          onPress={onRetry}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          accessibilityRole="button"
          accessibilityLabel="Retry native runtime"
          testID="error-retry-button"
        >
          <Text style={styles.buttonText}>retry()</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 2,
    borderLeftColor: colors.amber,
    borderRadius: radii.sm,
    padding: spacing.lg,
    gap: spacing.md,
  },
  tagRow: { flexDirection: 'row' },
  tag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    backgroundColor: colors.amberFaint,
    borderRadius: 2,
  },
  tagText: {
    fontFamily: fonts.mono,
    fontSize: sizes.xs,
    color: colors.amber,
    letterSpacing: tracking.widest,
  },
  name: {
    fontFamily: fonts.mono,
    fontSize: sizes.sm,
    color: colors.textSub,
    letterSpacing: tracking.wide,
  },
  message: {
    fontFamily: fonts.mono,
    fontSize: sizes.sm,
    color: colors.text,
    lineHeight: 20,
  },
  button: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderGlow,
    backgroundColor: colors.surfaceUp,
  },
  buttonPressed: { backgroundColor: colors.border },
  buttonText: {
    fontFamily: fonts.mono,
    fontSize: sizes.sm,
    color: colors.amber,
    letterSpacing: tracking.wide,
  },
});
