import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? 'NativeAgent',
  slug: config.slug ?? 'nativeagent',
  icon: './assets/images/icon.png',
  splash: {
    image: './assets/images/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#0a0e1a',
  },
  ios: {
    ...config.ios,
    supportsTablet: true,
  },
  android: {
    ...config.android,
    adaptiveIcon: {
      foregroundImage: './assets/images/adaptive-icon.png',
      backgroundColor: '#0a0e1a',
    },
  },
});
