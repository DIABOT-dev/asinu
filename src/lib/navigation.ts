import { router, Href } from 'expo-router';

export const navigation = {
  goToLogin() {
    router.replace('/login' as Href);
  },
  goToHome() {
    router.replace('/(tabs)/home' as Href);
  },
  goToSettings() {
    router.push('/settings' as Href);
  },
  goToLogs(type?: 'glucose' | 'blood-pressure' | 'medication' | 'weight' | 'water' | 'meal' | 'insulin') {
    if (!type) {
      router.push('/logs' as Href);
      return;
    }
    const path = `/logs/${type === 'blood-pressure' ? 'blood-pressure' : type}` as Href;
    router.push(path);
  }
};
