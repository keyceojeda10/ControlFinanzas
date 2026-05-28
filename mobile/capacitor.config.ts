import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.controlfinanzas.app',
  appName: 'Control Finanzas',
  webDir: 'www',
  server: {
    url: 'https://app.control-finanzas.com',
    cleartext: false,
    androidScheme: 'https',
  },
  plugins: {
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#060609',
    },
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#060609',
      showSpinner: false,
    },
  },
  android: {
    allowMixedContent: false,
    webContentsDebuggingEnabled: false,
  },
};

export default config;
