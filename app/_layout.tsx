import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryProvider } from '../src/providers/QueryProvider';
import { SessionProvider } from '../src/providers/SessionProvider';
import { Pressable, Text } from 'react-native';
import { colors, spacing, typography } from '../src/styles';
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
          >
            <Stack.Screen
              name="legal/content"
              options={({ navigation }) => ({
                presentation: 'modal',
                headerShown: true,
                title: 'Điều khoản',
                headerTitleStyle: {
                  color: colors.textPrimary,
                  fontSize: typography.size.md,
                  fontWeight: '700'
                },
                headerStyle: { backgroundColor: colors.surface },
                headerShadowVisible: false,
                headerLeft: () => (
                  <Pressable
                    onPress={() => navigation.goBack()}
                    style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}
                  >
                    <Text style={{ color: colors.primary, fontSize: typography.size.md, fontWeight: '700' }}>
                      Đóng
                    </Text>
                  </Pressable>
                )
              })}
            />
          </Stack>
        </SafeAreaProvider>
      </SessionProvider>
    </QueryProvider>
  );
}
