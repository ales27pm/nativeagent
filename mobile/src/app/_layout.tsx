import { ShareTechMono_400Regular } from '@expo-google-fonts/share-tech-mono';
import { VT323_400Regular } from '@expo-google-fonts/vt323';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { colors } from '@/theme/colors';
import { fonts, sizes, tracking } from '@/theme/typography';

SplashScreen.preventAutoHideAsync().catch(() => {});

export const unstable_settings = { initialRouteName: 'index' };

function RootLayoutNav(): React.JSX.Element {
  const onLayout = useCallback(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }} onLayout={onLayout}>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.amber,
          headerTitleStyle: {
            color: colors.amber,
            fontFamily: fonts.mono,
            fontSize: sizes.sm,
          },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="diagnostics" options={{ title: 'DIAGNOSTICS' }} />
        <Stack.Screen name="llm-diagnostics" options={{ title: 'LLM RUNTIME' }} />
      </Stack>
    </View>
  );
}

export default function RootLayout(): React.JSX.Element | null {
  const [fontsLoaded] = useFonts({
    VT323: VT323_400Regular,
    ShareTechMono: ShareTechMono_400Regular,
  });

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardProvider>
        <StatusBar style="light" />
        <RootLayoutNav />
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
