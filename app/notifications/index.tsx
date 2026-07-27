import { Stack } from 'expo-router';
import { NotificationsPage } from '../../src/components/NotificationsPage';

export default function NotificationsScreen() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <NotificationsPage />
    </>
  );
}
