import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryProvider } from '../src/providers/QueryProvider';
import { SessionProvider } from '../src/providers/SessionProvider';
import { colors } from '../src/styles';
import '../src/lib/initErrorHandler';

export default function RootLayout() {
  return (
    <QueryProvider>
      <SessionProvider>
        <SafeAreaProvider>
          <StatusBar style="dark" translucent backgroundColor="transparent" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.background }
            }}
          />
        </SafeAreaProvider>
      </SessionProvider>
    </QueryProvider>
  );
}
