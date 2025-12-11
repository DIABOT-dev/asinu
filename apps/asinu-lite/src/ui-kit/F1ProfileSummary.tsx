import { View, Text, StyleSheet } from 'react-native';
import { Avatar } from '../components/Avatar';
import { Card } from '../components/Card';
import { colors, spacing, typography } from '../styles';

type Props = {
  name: string;
  email?: string;
  phone?: string;
  caretakerFor?: string;
};

export const F1ProfileSummary = ({ name, email, phone, caretakerFor }: Props) => {
  return (
    <Card>
      <View style={styles.row}>
        <Avatar name={name} />
        <View style={styles.info}>
          <Text style={styles.name}>{name}</Text>
          {email ? <Text style={styles.meta}>{email}</Text> : null}
          {phone ? <Text style={styles.meta}>{phone}</Text> : null}
          {caretakerFor ? <Text style={styles.meta}>Chăm sóc: {caretakerFor}</Text> : null}
        </View>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md
  },
  info: {
    flex: 1,
    gap: spacing.xs
  },
  name: {
    fontSize: typography.size.lg,
    fontWeight: '700',
    color: colors.textPrimary
  },
  meta: {
    color: colors.textSecondary,
    fontSize: typography.size.sm
  }
});
