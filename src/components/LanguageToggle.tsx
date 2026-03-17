import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ScaledText as Text } from './ScaledText';
import { AppLanguage, useLanguageStore } from '../stores/language.store';
import { useScaledTypography } from '../hooks/useScaledTypography';
import { colors, radius, spacing } from '../styles';

const FLAG: Record<AppLanguage, string> = {
  vi: '\u{1F1FB}\u{1F1F3}',
  en: '\u{1F1EC}\u{1F1E7}',
};

export function LanguageToggle() {
  const { language, setLanguage } = useLanguageStore();
  const scaledTypography = useScaledTypography();
  const styles = useMemo(() => createStyles(scaledTypography), [scaledTypography]);

  return (
    <View style={styles.container}>
      {(['vi', 'en'] as AppLanguage[]).map((lang) => (
        <Pressable
          key={lang}
          onPress={() => setLanguage(lang)}
          style={[styles.btn, language === lang && styles.btnActive]}
        >
          <Text style={styles.flag}>{FLAG[lang]}</Text>
          <Text style={[styles.text, language === lang && styles.textActive]}>
            {lang.toUpperCase()}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function createStyles(typography: ReturnType<typeof useScaledTypography>) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
      height: 36,
    },
    btn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      paddingHorizontal: spacing.md,
      height: '100%',
    },
    flag: {
      fontSize: typography.size.sm,
    },
    btnActive: {
      backgroundColor: colors.primary,
    },
    text: {
      fontSize: typography.size.xs,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    textActive: {
      color: '#fff',
    },
  });
}
