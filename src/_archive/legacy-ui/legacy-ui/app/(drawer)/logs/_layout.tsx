import { Stack } from 'expo-router';

export default function LogsLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Logs' }} />
      <Stack.Screen name="[id]" options={{ title: 'Log detail' }} />
    </Stack>
  );
}
