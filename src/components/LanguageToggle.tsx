import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { ScaledText as Text } from './ScaledText';
import { AppLanguage, useLanguageStore } from '../stores/language.store';
import { useScaledTypography } from '../hooks/useScaledTypography';
import { colors, radius, spacing } from '../styles';
import { useThemeColors } from '../hooks/useThemeColors';

export function LanguageToggle() {
  const { language, setLanguage } = useLanguageStore();
  const scaledTypography = useScaledTypography();
  const { isDark } = useThemeColors();
  const styles = useMemo(() => createStyles(scaledTypography), [scaledTypography, isDark]);

  return (
    <View style={styles.container}>
      {(['vi', 'en'] as AppLanguage[]).map((lang) => (
        <Pressable
          key={lang}
          onPress={() => setLanguage(lang)}
          style={[styles.btn, language === lang && styles.btnActive]}
        >
          <FlagIcon language={lang} />
          <Text style={[styles.text, language === lang && styles.textActive]}>
            {lang.toUpperCase()}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function FlagIcon({ language }: { language: AppLanguage }) {
  if (language === 'vi') {
    return (
      <Svg width={18} height={12} viewBox="0 0 18 12" style={stylesStatic.flag}>
        <Rect width="18" height="12" rx="1.5" fill="#DA251D" />
        <Path
          d="M9 2.1l.75 2.3h2.42l-1.96 1.42.75 2.3L9 6.7 7.04 8.12l.75-2.3L5.83 4.4h2.42L9 2.1z"
          fill="#FFCD00"
        />
      </Svg>
    );
  }

  return (
    <Svg width={18} height={12} viewBox="0 0 18 12" style={stylesStatic.flag}>
      <Rect width="18" height="12" rx="1.5" fill="#012169" />
      <Path d="M0 0l18 12M18 0L0 12" stroke="#fff" strokeWidth="2.4" />
      <Path d="M0 0l18 12M18 0L0 12" stroke="#C8102E" strokeWidth="1.2" />
      <Path d="M9 0v12M0 6h18" stroke="#fff" strokeWidth="4" />
      <Path d="M9 0v12M0 6h18" stroke="#C8102E" strokeWidth="2.4" />
    </Svg>
  );
}

function createStyles(typography: ReturnType<typeof useScaledTypography>) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      backgroundColor: '#FFFFFF',
      borderRadius: 20,
      borderWidth: 1,
      borderColor: '#E2EEF5',
      overflow: 'hidden',
      height: 38,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.03,
      shadowRadius: 4,
      elevation: 1,
    },
    btn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      paddingHorizontal: 12,
      height: '100%',
      borderRadius: 18,
    },
    btnActive: {
      backgroundColor: '#20BCB4',
    },
    text: {
      fontSize: 12.5,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    textActive: {
      color: '#FFFFFF',
    },
  });
}

const stylesStatic = StyleSheet.create({
  flag: {
    borderRadius: 1.5,
  },
});
