import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Drawer } from 'expo-router/drawer';
import { DrawerLayout } from '@/ui/layouts/DrawerLayout';
import { colors } from '@/ui/theme';

export default function DrawerShell() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Drawer
        initialRouteName="(tabs)"
        screenOptions={{
          headerShown: false,
          drawerType: 'slide',
          sceneContainerStyle: { backgroundColor: colors.background }
        }}
        drawerContent={(props) => <DrawerLayout {...props} workspaceName="Asinu UI Kit" tagline="Demo screens" />}
      >
        <Drawer.Screen name="(tabs)" options={{ drawerLabel: 'Dashboard' }} />
        <Drawer.Screen name="logs" options={{ drawerLabel: 'Logs' }} />
        <Drawer.Screen name="chat" options={{ drawerLabel: 'AI Chat' }} />
      </Drawer>
    </GestureHandlerRootView>
  );
}
