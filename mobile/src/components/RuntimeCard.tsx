import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, TextStyle } from 'react-native';

import type { NativeRuntimeSnapshot, RuntimeStatus } from '@/features/runtime/runtimeTypes';
import { colors } from '@/theme/colors';
import { radii, spacing } from '@/theme/spacing';
import { fonts, sizes, tracking } from '@/theme/typography';

type RuntimeCardProps = {
  status: RuntimeStatus;
  snapshot: NativeRuntimeSnapshot | null;
};

export function RuntimeCard({ status, snapshot }: RuntimeCardProps): React.JSX.Element {
  const dotColor =
    status === 'success'
      ? colors.success
      : status === 'loading'
        ? colors.amber
        : colors.danger;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.dot, { backgroundColor: dotColor }]} />
          <Text style={styles.headerTitle}>RUNTIME.SNAPSHOT</Text>
        </View>
        <Text style={styles.headerStatus}>{status.toUpperCase()}</Text>
      </View>

      <View style={styles.body}>
        {status === 'loading' ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.amber} size="small" />
            <Text style={styles.muted}>reading native runtime...</Text>
          </View>
        ) : snapshot !== null ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.jsonWrap}
          >
            <View>
              {JSON.stringify(snapshot, null, 2)
                .split('\n')
                .map((line, i) => (
                  <JsonLine key={i} line={line} />
                ))}
            </View>
          </ScrollView>
        ) : (
          <Text style={styles.muted}>no snapshot</Text>
        )}
      </View>
    </View>
  );
}

function JsonLine({ line }: { line: string }): React.JSX.Element {
  const m = /^(\s*)("[\w]+")(\s*:\s*)(.+?)([,]?)$/.exec(line);
  if (!m) {
    return <Text style={s.punc}>{line}</Text>;
  }
  const [, indent, key, colon, val, comma] = m;

  let valStyle: StyleProp<TextStyle> = s.str;
  if (val === 'null') valStyle = s.nil;
  else if (val === 'true' || val === 'false') valStyle = s.bool;
  else if (/^-?\d/.test(val)) valStyle = s.num;

  return (
    <Text>
      <Text style={s.punc}>{indent}</Text>
      <Text style={s.key}>{key}</Text>
      <Text style={s.colon}>{colon}</Text>
      <Text style={valStyle}>{val}</Text>
      {comma !== '' ? <Text style={s.punc}>{comma}</Text> : null}
    </Text>
  );
}

const s = StyleSheet.create({
  punc: { fontFamily: fonts.mono, fontSize: sizes.sm, color: colors.textMuted, lineHeight: 20 },
  key: { fontFamily: fonts.mono, fontSize: sizes.sm, color: colors.textSub, lineHeight: 20 },
  colon: { fontFamily: fonts.mono, fontSize: sizes.sm, color: colors.amberDim, lineHeight: 20 },
  str: { fontFamily: fonts.mono, fontSize: sizes.sm, color: colors.text, lineHeight: 20 },
  num: { fontFamily: fonts.mono, fontSize: sizes.sm, color: colors.amberBright, lineHeight: 20 },
  bool: { fontFamily: fonts.mono, fontSize: sizes.sm, color: colors.success, lineHeight: 20 },
  nil: { fontFamily: fonts.mono, fontSize: sizes.sm, color: colors.textMuted, lineHeight: 20 },
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.sm,
    overflow: 'hidden',
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceUp,
    borderBottomColor: colors.borderGlow,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  headerTitle: {
    fontFamily: fonts.mono,
    fontSize: sizes.sm,
    color: colors.textMuted,
    letterSpacing: tracking.wider,
  },
  headerStatus: {
    fontFamily: fonts.mono,
    fontSize: sizes.xs,
    color: colors.amberDim,
    letterSpacing: tracking.widest,
  },
  body: {
    padding: spacing.lg,
    minHeight: 120,
  },
  jsonWrap: { paddingBottom: spacing.xs },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xl,
  },
  muted: {
    fontFamily: fonts.mono,
    fontSize: sizes.sm,
    color: colors.textMuted,
  },
});
