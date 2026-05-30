import React, { useEffect } from 'react';
import type { ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
} from 'react-native-reanimated';

import { colors } from '@/theme/colors';
import { radii } from '@/theme/spacing';

type SkeletonBlockProps = {
  width?: number | string;
  height?: number;
  style?: ViewStyle;
  borderRadius?: number;
};

export function SkeletonBlock({
  width = '100%',
  height = 16,
  style,
  borderRadius = radii.sm,
}: SkeletonBlockProps): React.JSX.Element {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 700 }),
        withTiming(0.3, { duration: 700 }),
      ),
      -1,
      false,
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          width: width as number,
          height,
          backgroundColor: colors.surfaceUp,
          borderRadius,
        },
        animStyle,
        style,
      ]}
    />
  );
}
