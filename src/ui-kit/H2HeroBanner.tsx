import { useMemo } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';
import { Avatar } from '../components/Avatar';
import { useScaledTypography } from '../hooks/useScaledTypography';
import { colors, radius, spacing } from '../styles';
import { useThemeColors } from '../hooks/useThemeColors';

type Props = {
  name: string;
  relationship?: string;
  summary?: string;
  action?: React.ReactNode;
  supporters?: string[];
};

export const H2HeroBanner = ({ name, relationship, summary, action, supporters = [] }: Props) => {
  const scaledTypography = useScaledTypography();
  const { isDark } = useThemeColors();
  const styles = useMemo(() => StyleSheet.create({
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
      borderWidth: 1
    },
    name: {
      color: colors.surface,
      fontWeight: '800'
    },
    meta: {
      color: colors.surface,
      opacity: 0.85
    },
    summary: {
      color: colors.surface,
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
      fontWeight: '700'
    }
  }), [isDark]);

  return (
    <LinearGradient
      colors={[colors.primary + 'E0', colors.primary + 'F0']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.container}
    >
      <View style={styles.headerRow}>
        <Avatar name={name} containerStyle={styles.avatar} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { fontSize: scaledTypography.size.xl }]}>{name}</Text>
          {relationship ? <Text style={[styles.meta, { fontSize: scaledTypography.size.sm }]}>{relationship}</Text> : null}
        </View>
        {action}
      </View>
      {summary ? <Text style={[styles.summary, { fontSize: scaledTypography.size.md }]}>{summary}</Text> : null}
      {supporters.length ? (
        <View style={styles.supporters}>
          {supporters.map((member) => (
            <View key={member} style={styles.supportTag}>
              <Text style={[styles.supportText, { fontSize: scaledTypography.size.sm }]}>{member}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </LinearGradient>
  );
};
