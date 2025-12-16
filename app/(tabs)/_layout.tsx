import { Tabs } from 'expo-router';
import { colors } from '../../src/styles';
import { Ionicons } from '@expo/vector-icons';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border
        }
      }}
    >
      <Tabs.Screen
        name="home/index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Ionicons name="home" color={color} size={size} />
        }}
      />
      <Tabs.Screen
        name="missions/index"
        options={{
          title: 'Missions',
          tabBarIcon: ({ color, size }) => <Ionicons name="checkbox" color={color} size={size} />
        }}
      />
      <Tabs.Screen
        name="tree/index"
        options={{
          title: 'Tree',
          tabBarIcon: ({ color, size }) => <Ionicons name="leaf" color={color} size={size} />
        }}
      />
      <Tabs.Screen
        name="profile/index"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <Ionicons name="person" color={color} size={size} />
        }}
      />
    </Tabs>
  );
}
