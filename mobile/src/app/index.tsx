import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Link } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorPanel } from '@/components/ErrorPanel';
import { RuntimeCard } from '@/components/RuntimeCard';
import { useRuntimeSnapshot } from '@/features/runtime/useRuntimeSnapshot';
import { colors } from '@/theme/colors';
import { radii, spacing } from '@/theme/spacing';
import { fonts, sizes, tracking } from '@/theme/typography';

const LINE1 = 'NATIVE';
const LINE2 = 'AGENT';
const CHAR_MS = 55;
const CURSOR_DELAY = (LINE1.length + LINE2.length) * CHAR_MS + 120;

function RevealChar({ char, delay }: { char: string; delay: number }): React.JSX.Element {
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 80 }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.Text style={[styles.heroChar, animStyle]}>
      {char}
    </Animated.Text>
  );
}

function BlinkCursor({ startDelay }: { startDelay: number }): React.JSX.Element | null {
  const [show, setShow] = useState<boolean>(false);
  const [vis, setVis] = useState<boolean>(true);

  useEffect(() => {
    const t = setTimeout(() => setShow(true), startDelay);
    return () => clearTimeout(t);
  }, [startDelay]);

  useEffect(() => {
    if (!show) return;
    const id = setInterval(() => setVis(v => !v), 530);
    return () => clearInterval(id);
  }, [show]);

  if (!show) return null;
  return <Text style={styles.heroChar}>{vis ? '\u2588' : '\u00A0'}</Text>;
}

function PulseDot({ active }: { active: boolean }): React.JSX.Element {
  const scale = useSharedValue(1);
  const opa = useSharedValue(active ? 1 : 0.5);

  useEffect(() => {
    if (!active) return;
    scale.value = withRepeat(
      withSequence(withTiming(1.5, { duration: 800 }), withTiming(1, { duration: 800 })),
      -1,
    );
    opa.value = withRepeat(
      withSequence(withTiming(0.35, { duration: 800 }), withTiming(1, { duration: 800 })),
      -1,
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opa.value,
  }));

  return (
    <Animated.View
      style={[
        styles.dot,
        { backgroundColor: active ? colors.success : colors.textMuted },
        animStyle,
      ]}
    />
  );
}

function FadeIn({ children, delay }: { children: React.ReactNode; delay: number }): React.JSX.Element {
  const opacity = useSharedValue(0);
  const ty = useSharedValue(10);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 380 }));
    ty.value = withDelay(delay, withSpring(0, { damping: 20, stiffness: 180 }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: ty.value }],
  }));

  return <Animated.View style={animStyle}>{children}</Animated.View>;
}

export default function HomeScreen(): React.JSX.Element {
  const { status, snapshot, error, nativeAvailable, refresh } = useRuntimeSnapshot();

  const handleRefresh = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    void refresh();
  }, [refresh]);

  return (
    <SafeAreaView edges={['top']} style={styles.safe} testID="home-screen">
      <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
        <LinearGradient
          colors={['rgba(245,158,11,0.05)', colors.bg, 'rgba(245,158,11,0.03)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        testID="home-scroll"
      >
        <FadeIn delay={0}>
          <View style={styles.sysBar}>
            <Text style={styles.sysText}>SYS.RUNTIME  ›  DEVICE.QUERY</Text>
            <Text style={styles.sysText}>v0.1.0</Text>
          </View>
          <View style={styles.hairline} />
        </FadeIn>

        <View style={styles.heroBlock}>
          <View style={styles.heroRow}>
            {Array.from(LINE1).map((char, i) => (
              <RevealChar key={`l1-${i}`} char={char} delay={i * CHAR_MS} />
            ))}
          </View>
          <View style={styles.heroRow}>
            {Array.from(LINE2).map((char, i) => (
              <RevealChar
                key={`l2-${i}`}
                char={char}
                delay={LINE1.length * CHAR_MS + i * CHAR_MS}
              />
            ))}
            <BlinkCursor startDelay={CURSOR_DELAY} />
          </View>
        </View>

        <FadeIn delay={750}>
          <Text style={styles.subtitle}>EXPO  ×  NEW ARCH  ×  NATIVE RUNTIME</Text>
          <View style={[styles.hairline, { marginTop: spacing.md }]} />
        </FadeIn>

        <FadeIn delay={950}>
          <View style={styles.group}>
            <Text style={styles.label}>BRIDGE STATUS</Text>
            <View style={[styles.pill, nativeAvailable ? styles.pillOn : styles.pillOff]}>
              <PulseDot active={nativeAvailable} />
              <Text style={[styles.pillText, { color: nativeAvailable ? colors.success : colors.textSub }]}>
                {nativeAvailable
                  ? 'ONLINE  ·  NATIVE MODULE READY'
                  : 'OFFLINE  ·  DEV BUILD REQUIRED'}
              </Text>
            </View>
          </View>
        </FadeIn>

        <FadeIn delay={1150}>
          <RuntimeCard status={status} snapshot={snapshot} />
        </FadeIn>

        {error !== null ? (
          <FadeIn delay={1250}>
            <ErrorPanel error={error} onRetry={handleRefresh} />
          </FadeIn>
        ) : null}

        <FadeIn delay={1350}>
          <View style={styles.actions}>
            <Pressable
              onPress={handleRefresh}
              style={({ pressed }) => [styles.btnPrimary, pressed && styles.pressed]}
              accessibilityRole="button"
              testID="refresh-button"
            >
              <Text style={styles.btnPrimaryText}>▶  REFRESH RUNTIME</Text>
            </Pressable>
            <Link href="/diagnostics" asChild>
              <Pressable
                style={({ pressed }) => [styles.btnOutline, pressed && styles.pressed]}
                accessibilityRole="button"
                testID="diagnostics-button"
              >
                <Text style={styles.btnOutlineText}>DIAGNOSTICS  →</Text>
              </Pressable>
            </Link>
          </View>
        </FadeIn>

        <FadeIn delay={1500}>
          <View style={styles.footer}>
            <Text style={styles.footerLine}>native-device-runtime  ·  swift + kotlin</Text>
            <Text style={styles.footerHint}>expo go cannot load custom native modules</Text>
          </View>
        </FadeIn>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing['4xl'],
    gap: spacing['2xl'],
  },
  sysBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: spacing.sm,
  },
  sysText: {
    fontFamily: fonts.mono,
    fontSize: sizes.xs,
    color: colors.textMuted,
    letterSpacing: tracking.wider,
  },
  hairline: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderGlow,
    opacity: 0.6,
  },
  heroBlock: {
    gap: 0,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  heroRow: { flexDirection: 'row' },
  heroChar: {
    fontFamily: fonts.display,
    fontSize: sizes.hero,
    color: colors.amber,
    letterSpacing: tracking.hero,
    lineHeight: sizes.hero * 1.1,
  },
  subtitle: {
    fontFamily: fonts.mono,
    fontSize: sizes.xs,
    color: colors.textMuted,
    letterSpacing: tracking.wider,
  },
  group: { gap: spacing.sm },
  label: {
    fontFamily: fonts.mono,
    fontSize: sizes.xs,
    color: colors.textMuted,
    letterSpacing: tracking.widest,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.sm,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pillOn: {
    backgroundColor: 'rgba(74,222,128,0.06)',
    borderColor: 'rgba(74,222,128,0.3)',
  },
  pillOff: { backgroundColor: colors.surface, borderColor: colors.border },
  dot: { width: 7, height: 7, borderRadius: 4 },
  pillText: {
    fontFamily: fonts.mono,
    fontSize: sizes.sm,
    letterSpacing: tracking.wide,
  },
  actions: { gap: spacing.md },
  btnPrimary: {
    backgroundColor: colors.amber,
    paddingVertical: spacing.lg,
    borderRadius: radii.sm,
    alignItems: 'center',
  },
  btnPrimaryText: {
    fontFamily: fonts.mono,
    fontSize: sizes.base,
    color: colors.bg,
    letterSpacing: tracking.wider,
  },
  btnOutline: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderGlow,
    paddingVertical: spacing.lg,
    borderRadius: radii.sm,
    alignItems: 'center',
  },
  btnOutlineText: {
    fontFamily: fonts.mono,
    fontSize: sizes.base,
    color: colors.amber,
    letterSpacing: tracking.wider,
  },
  pressed: { opacity: 0.6 },
  footer: {
    paddingTop: spacing.lg,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.xs,
  },
  footerLine: {
    fontFamily: fonts.mono,
    fontSize: sizes.xs,
    color: colors.textMuted,
    letterSpacing: tracking.wide,
  },
  footerHint: {
    fontFamily: fonts.mono,
    fontSize: sizes.xs,
    color: colors.amberDim,
    letterSpacing: tracking.wide,
  },
});
