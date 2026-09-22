import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.zentora.messenger',
  appName: 'Zentora',
  webDir: 'dist',
  android: {
    allowMixedContent: true,
  },
};

export default config;
