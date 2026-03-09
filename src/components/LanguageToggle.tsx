import { Pressable, StyleSheet, View } from 'react-native';
import { ScaledText as Text } from './ScaledText';
import { AppLanguage, useLanguageStore } from '../stores/language.store';
import { colors, radius, spacing } from '../styles';

const FLAG: Record<AppLanguage, string> = {
  vi: '🇻🇳',
  en: '🇬🇧',
};

export function LanguageToggle() {
  const { language, setLanguage } = useLanguageStore();

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

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  flag: {
    fontSize: 14,
  },
  btnActive: {
    backgroundColor: colors.primary,
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  textActive: {
    color: '#fff',
  },
});
