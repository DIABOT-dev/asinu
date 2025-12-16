import { LinearGradient } from 'expo-linear-gradient';
import { View, Text, StyleSheet } from 'react-native';
import { Avatar } from '../components/Avatar';
import { colors, spacing, radius, typography } from '../styles';

type Props = {
  name: string;
  relationship?: string;
  summary?: string;
  action?: React.ReactNode;
  supporters?: string[];
};

export const H2HeroBanner = ({ name, relationship, summary, action, supporters = [] }: Props) => {
  return (
    <LinearGradient
      colors={[colors.warning, colors.primary]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.container}
    >
      <View style={styles.headerRow}>
        <Avatar name={name} containerStyle={styles.avatar} />
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{name}</Text>
          {relationship ? <Text style={styles.meta}>{relationship}</Text> : null}
        </View>
        {action}
      </View>
      {summary ? <Text style={styles.summary}>{summary}</Text> : null}
      {supporters.length ? (
        <View style={styles.supporters}>
          {supporters.map((member) => (
            <View key={member} style={styles.supportTag}>
              <Text style={styles.supportText}>{member}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: spacing.xl,
    borderRadius: radius.xl,
    gap: spacing.md
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md
  },
  avatar: {
    borderColor: colors.surface,
    borderWidth: 2
  },
  name: {
    color: colors.surface,
    fontSize: typography.size.xl,
    fontWeight: '800'
  },
  meta: {
    color: colors.surface,
    opacity: 0.85,
    fontSize: typography.size.sm
  },
  summary: {
    color: colors.surface,
    fontSize: typography.size.md,
    lineHeight: 22
  },
  supporters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm
  },
  supportTag: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.2)'
  },
  supportText: {
    color: colors.surface,
    fontWeight: '700',
    fontSize: typography.size.sm
  }
});
