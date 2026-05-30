import React from 'react';
import { Pressable, type PressableProps } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

type PressableScaleProps = PressableProps & {
  children: React.ReactNode;
};

export function PressableScale({
  children,
  onPressIn,
  onPressOut,
  ...rest
}: PressableScaleProps): React.JSX.Element {
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animStyle}>
      <Pressable
        {...rest}
        onPressIn={(e) => {
          scale.value = withSpring(0.96, { mass: 0.3, damping: 15, stiffness: 300 });
          onPressIn?.(e);
        }}
        onPressOut={(e) => {
          scale.value = withSpring(1, { mass: 0.3, damping: 15, stiffness: 300 });
          onPressOut?.(e);
        }}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}
