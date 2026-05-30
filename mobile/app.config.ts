import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'NativeAgent',
  slug: 'nativeagent',
  scheme: 'nativeagent',
  icon: './assets/images/icon.png',
  splash: {
    image: './assets/images/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#0a0e1a',
  },
  ios: {
    ...config.ios,
    supportsTablet: true,
    bundleIdentifier: 'app.ales27pm.nativeagent',
  },
  android: {
    ...config.android,
    package: 'app.ales27pm.nativeagent',
    adaptiveIcon: {
      foregroundImage: './assets/images/adaptive-icon.png',
      backgroundColor: '#0a0e1a',
    },
  },
});
