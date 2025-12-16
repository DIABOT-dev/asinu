import { DrawerContentComponentProps, DrawerContentScrollView, DrawerItemList } from '@react-navigation/drawer';
import { Image, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '@/ui/theme';

export type DrawerLayoutProps = DrawerContentComponentProps & {
  workspaceName?: string;
  tagline?: string;
};

export const DrawerLayout = ({ workspaceName = 'Workspace', tagline = 'Your collections', ...rest }: DrawerLayoutProps) => {
  return (
    <DrawerContentScrollView {...rest} contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Image
          source={{ uri: 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?auto=format&fit=crop&w=200&q=80' }}
          style={styles.avatar}
        />
        <View>
          <Text style={styles.workspace}>{workspaceName}</Text>
          <Text style={styles.tagline}>{tagline}</Text>
        </View>
      </View>
      <View style={styles.menuWrapper}>
        <DrawerItemList {...rest} />
      </View>
    </DrawerContentScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: spacing.xl,
    backgroundColor: colors.background,
    flex: 1
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.xl
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 20
  },
  workspace: {
    fontSize: 18,
    color: colors.textPrimary,
    fontWeight: '700'
  },
  tagline: {
    color: colors.textSecondary
  },
  menuWrapper: {
    flex: 1,
    borderRadius: 32,
    backgroundColor: colors.surface,
    padding: spacing.md
  }
});
