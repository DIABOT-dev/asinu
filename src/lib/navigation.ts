import { router, Href } from 'expo-router';

export const navigation = {
  goToLogin() {
    router.replace('/login' as Href);
  },
  goToHome() {
    router.replace('/(tabs)/home' as Href);
  },
  goToLogs(type?: 'glucose' | 'blood-pressure' | 'medication' | 'weight' | 'water' | 'meal' | 'insulin') {
    if (!type) {
      router.navigate('/logs' as Href);
      return;
    }
    const path = `/logs/${type === 'blood-pressure' ? 'blood-pressure' : type}` as Href;
    router.navigate(path);
  }
};
