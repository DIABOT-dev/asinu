import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useScaledFontSize } from '../hooks/useScaledTypography';

const MASCOT_URL = 'https://github.com/DIABOT-dev/resource/blob/main/asinu-mascot.png?raw=true';

type AsinuMascotProps = {
  onPress?: () => void;
  size?: number;
};

export default function AsinuMascot({ onPress, size = 140 }: AsinuMascotProps) {
  const { t } = useTranslation('chat');
  const [imageError, setImageError] = useState(false);
  const scaledFontSize = useScaledFontSize(16);
  const dynamicStyles = useMemo(() => ({
    bubbleText: { fontSize: scaledFontSize }
  }), [scaledFontSize]);

  const handlePress = () => {
    onPress?.();
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.card} activeOpacity={0.9} onPress={handlePress}>
        {imageError ? (
          <View style={[styles.fallbackCircle, { width: size * 0.85, height: size * 0.85, borderRadius: (size * 0.85) / 2 }]}>
            <Ionicons name="chatbubble-ellipses" size={size * 0.5} color="#6366f1" />
          </View>
        ) : (
          <Image
            source={{ uri: MASCOT_URL }}
            style={[styles.image, { width: size, height: size }]}
            resizeMode="contain"
            onError={() => setImageError(true)}
          />
        )}
        <View style={styles.bubble}>
          <Text style={[styles.bubbleText, dynamicStyles.bubbleText]}>{t('mascotGreeting')}</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  card: {
    alignItems: 'center',
    gap: 12
  },
  image: {},
  fallbackCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E5F1FF',
    borderWidth: 2,
    borderColor: '#C5DFFF'
  },
  bubble: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E1E8F0',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3
  },
  bubbleText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937'
  }
});
