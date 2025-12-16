import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '@/ui/theme';

export type ResourceCardProps = {
  title: string;
  category: string;
  media?: string;
  likes?: number;
  comments?: number;
  onPress?: () => void;
};

export const ResourceCard = ({ title, category, media, likes, comments, onPress }: ResourceCardProps) => {
  const Container = onPress ? Pressable : View;

  return (
    <Container style={styles.card} onPress={onPress}>
      {media ? <Image source={{ uri: media }} style={styles.media} /> : <View style={[styles.media, styles.mediaPlaceholder]} />}
      <Text style={styles.category}>{category}</Text>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.metaRow}>
        <Text style={styles.meta}>{likes ?? 0} likes</Text>
        <Text style={styles.meta}>{comments ?? 0} comments</Text>
      </View>
    </Container>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: 24,
    gap: spacing.sm
  },
  media: {
    width: '100%',
    height: 120,
    borderRadius: 20,
    backgroundColor: colors.surfaceMuted
  },
  mediaPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center'
  },
  category: {
    fontSize: 12,
    color: colors.textSecondary,
    textTransform: 'uppercase'
  },
  title: {
    fontSize: 16,
    color: colors.textPrimary,
    fontWeight: '600'
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  meta: {
    fontSize: 12,
    color: colors.textSecondary
  }
});
