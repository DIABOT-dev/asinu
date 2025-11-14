import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.diabot.asinu',
  appName: 'Asinu',
  webDir: 'dist',
  server: {
    url: process.env.ASINU_WEB_URL || 'https://app.asinu.top',
    cleartext: false
  }
};

export default config;
