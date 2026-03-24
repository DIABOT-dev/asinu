import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { Avatar } from '../components/Avatar';
import { Card } from '../components/Card';
import { useScaledTypography } from '../hooks/useScaledTypography';
import { colors, spacing } from '../styles';
import { useThemeColors } from '../hooks/useThemeColors';

type Props = {
  name: string;
  email?: string;
  phone?: string;
  caretakerFor?: string;
};

export const F1ProfileSummary = ({ name, email, phone, caretakerFor }: Props) => {
  const { t } = useTranslation('profile');
  const scaledTypography = useScaledTypography();
  const { isDark } = useThemeColors();
  const styles = useMemo(() => StyleSheet.create({
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
      fontWeight: '700',
      color: colors.textPrimary
    },
    meta: {
      color: colors.textSecondary
    }
  }), [isDark]);

  return (
    <Card>
      <View style={styles.row}>
        <Avatar name={name} />
        <View style={styles.info}>
          <Text style={[styles.name, { fontSize: scaledTypography.size.lg }]}>{name}</Text>
          {email ? <Text style={[styles.meta, { fontSize: scaledTypography.size.sm }]}>{email}</Text> : null}
          {phone ? <Text style={[styles.meta, { fontSize: scaledTypography.size.sm }]}>{phone}</Text> : null}
          {caretakerFor ? <Text style={[styles.meta, { fontSize: scaledTypography.size.sm }]}>{t('careFor', { name: caretakerFor })}</Text> : null}
        </View>
      </View>
    </Card>
  );
};
