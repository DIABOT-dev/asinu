// Expo config tuned for production builds without runtime image resizing
const APP_ENV = process.env.APP_ENV ?? "development";

const config = {
  name: "Asinu",
  slug: "asinu-lite",
  scheme: "asinu-lite",
  version: "1.0.0",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  jsEngine: "hermes",
  newArchEnabled: false,

  // Dev-only icon/splash; production pulls platform-native assets
  icon: "./assets/icon.png",
  splash: {
    image: "./assets/splash.png",
    resizeMode: "contain",
    backgroundColor: "#000000",
  },

  ios: {
    bundleIdentifier: "com.asinu.lite",
    supportsTablet: true,
    icon: "./assets/ios/AppIcon.appiconset/AppIcon-1024x1024.png",
  },

  android: {
    package: "com.asinu.lite",
    adaptiveIcon: {
      foregroundImage: "./assets/android/adaptive-foreground.png",
      backgroundImage: "./assets/android/adaptive-background.png",
    },
    icon: "./assets/android/mipmap",
  },

  plugins: [
    "expo-router",
  ],

  experiments: {
    typedRoutes: true,
    reactNativeNewArchitecture: false,
  },

  extra: {
    eas: {
      projectId: "bd2749a5-5dda-41fa-b306-648331738cde",
    },
    appEnv: APP_ENV,
  },

  updates: {
    fallbackToCacheTimeout: 0,
  },

  assetBundlePatterns: ["**/*"],
};

module.exports = config;
