import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { memo, useCallback, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { ScaledText as Text } from './ScaledText';
import { useAuthStore } from '../features/auth/auth.store';
import { useScaledTypography } from '../hooks/useScaledTypography';
import { useThemeColors } from '../hooks/useThemeColors';
import { colors, radius, spacing } from '../styles';

export const CHECKIN_GUIDE_STORAGE_KEY = 'checkin-guide:v2';

function getCheckinGuideStorageKey(userId?: string | null): string {
  return userId ? `${CHECKIN_GUIDE_STORAGE_KEY}:${userId}` : CHECKIN_GUIDE_STORAGE_KEY;
}

export async function hasSeenCheckinGuide(userId?: string | null): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(getCheckinGuideStorageKey(userId));
    return val === 'true';
  } catch {
    return false;
  }
}

export async function markCheckinGuideSeen(userId?: string | null): Promise<void> {
  try {
    await AsyncStorage.setItem(getCheckinGuideStorageKey(userId), 'true');
  } catch {}
}

export async function resetCheckinGuideSeen(userId?: string | null): Promise<void> {
  try {
    await AsyncStorage.removeItem(getCheckinGuideStorageKey(userId));
  } catch {}
}

const GUIDE_IMAGES = [
  require('../../assets/images/checkin-guide/slide1_daily_checkin.png'),
  require('../../assets/images/checkin-guide/slide2_feeling_fine.png'),
  require('../../assets/images/checkin-guide/slide3_abnormal_signs.png'),
  require('../../assets/images/checkin-guide/slide4_adaptive_questions.png'),
  require('../../assets/images/checkin-guide/slide5_listen_results.png'),
];

export type CheckinGuideSlide = {
  id: string;
  step: number;
  image: any;
  titleKey: string;
  descKey: string;
  badgeColor: string;
  badgeTextColor: string;
};

const SLIDES: CheckinGuideSlide[] = [
  {
    id: 'step1',
    step: 1,
    image: GUIDE_IMAGES[0],
    titleKey: 'checkinGuide.slide1Title',
    descKey: 'checkinGuide.slide1Desc',
    badgeColor: '#e6faf8',
    badgeTextColor: '#08b8a2',
  },
  {
    id: 'step2',
    step: 2,
    image: GUIDE_IMAGES[1],
    titleKey: 'checkinGuide.slide2Title',
    descKey: 'checkinGuide.slide2Desc',
    badgeColor: '#eefaf5',
    badgeTextColor: '#059669',
  },
  {
    id: 'step3',
    step: 3,
    image: GUIDE_IMAGES[2],
    titleKey: 'checkinGuide.slide3Title',
    descKey: 'checkinGuide.slide3Desc',
    badgeColor: '#fff7ed',
    badgeTextColor: '#ea580c',
  },
  {
    id: 'step4',
    step: 4,
    image: GUIDE_IMAGES[3],
    titleKey: 'checkinGuide.slide4Title',
    descKey: 'checkinGuide.slide4Desc',
    badgeColor: '#e6faf8',
    badgeTextColor: '#08b8a2',
  },
  {
    id: 'step5',
    step: 5,
    image: GUIDE_IMAGES[4],
    titleKey: 'checkinGuide.slide5Title',
    descKey: 'checkinGuide.slide5Desc',
    badgeColor: '#eefaf5',
    badgeTextColor: '#059669',
  },
];

export type CheckinGuideCarouselProps = {
  visible?: boolean;
  onClose?: () => void;
  onStartCheckin?: () => void;
  asModal?: boolean;
};

export const CheckinGuideCarousel = memo(function CheckinGuideCarousel({
  visible = true,
  onClose,
  onStartCheckin,
  asModal = true,
}: CheckinGuideCarouselProps) {
  const { t } = useTranslation('home');
  const userId = useAuthStore((state) => state.profile?.id);
  const insets = useSafeAreaInsets();
  const scaledTypography = useScaledTypography();
  const { isDark } = useThemeColors();

  const styles = useMemo(
    () => createStyles(scaledTypography, isDark, insets),
    [scaledTypography, isDark, insets],
  );

  const [activeIndex, setActiveIndex] = useState(0);
  const [containerWidth, setContainerWidth] = useState(Dimensions.get('window').width);
  const flatListRef = useRef<FlatList<CheckinGuideSlide>>(null);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offset = e.nativeEvent.contentOffset.x;
      if (containerWidth > 0) {
        const nextIndex = Math.round(offset / containerWidth);
        if (nextIndex >= 0 && nextIndex < SLIDES.length && nextIndex !== activeIndex) {
          setActiveIndex(nextIndex);
        }
      }
    },
    [containerWidth, activeIndex],
  );

  const handleSkip = useCallback(async () => {
    await markCheckinGuideSeen(userId);
    onClose?.();
  }, [onClose, userId]);

  const handleNext = useCallback(async () => {
    if (activeIndex < SLIDES.length - 1) {
      const nextIdx = activeIndex + 1;
      flatListRef.current?.scrollToIndex({ index: nextIdx, animated: true });
      setActiveIndex(nextIdx);
    } else {
      await markCheckinGuideSeen(userId);
      onClose?.();
      onStartCheckin?.();
    }
  }, [activeIndex, onClose, onStartCheckin, userId]);

  const handlePrev = useCallback(() => {
    if (activeIndex > 0) {
      const prevIdx = activeIndex - 1;
      flatListRef.current?.scrollToIndex({ index: prevIdx, animated: true });
      setActiveIndex(prevIdx);
    }
  }, [activeIndex]);

  const handleDotPress = useCallback((targetIndex: number) => {
    flatListRef.current?.scrollToIndex({ index: targetIndex, animated: true });
    setActiveIndex(targetIndex);
  }, []);

  const renderSlideItem = useCallback(
    ({ item }: { item: CheckinGuideSlide }) => {
      return (
        <View style={[styles.slideContainer, { width: containerWidth }]}>
          {/* Card with illustration */}
          <View style={styles.imageCard}>
            <Image
              cachePolicy="memory-disk"
              contentFit="cover"
              source={item.image}
              style={styles.slideImage}
            />
          </View>

          {/* Text block */}
          <View style={styles.contentWrap}>
            <View style={[styles.stepBadge, { backgroundColor: item.badgeColor }]}>
              <Text style={[styles.stepBadgeText, { color: item.badgeTextColor }]}>
                {t('checkinGuide.stepBadge', { current: item.step, total: SLIDES.length })}
              </Text>
            </View>

            <Text style={styles.slideTitle}>{t(item.titleKey)}</Text>
            <Text style={styles.slideDesc}>{t(item.descKey)}</Text>
          </View>
        </View>
      );
    },
    [containerWidth, styles, t],
  );

  const isLastSlide = activeIndex === SLIDES.length - 1;

  const content = (
    <View
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w > 0 && Math.abs(w - containerWidth) > 1) {
          setContainerWidth(w);
        }
      }}
      style={styles.modalRoot}
    >
      {/* Top Header Bar */}
      <View style={styles.headerBar}>
        <View style={styles.headerLeftBadge}>
          <Ionicons name="sparkles" size={14} color={colors.primary} />
          <Text style={styles.headerLeftText}>{t('checkinGuide.badge')}</Text>
        </View>

        <Pressable
          accessibilityLabel={t('checkinGuide.skip')}
          accessibilityRole="button"
          hitSlop={12}
          onPress={handleSkip}
          style={({ pressed }) => [styles.skipButton, pressed && styles.skipButtonPressed]}
        >
          <Text style={styles.skipButtonText}>{t('checkinGuide.skip')}</Text>
          <Ionicons name="close" size={16} color={isDark ? '#94a3b8' : '#64748b'} />
        </Pressable>
      </View>

      {/* Horizontal Paging FlatList */}
      <FlatList
        bounces={false}
        data={SLIDES}
        decelerationRate="fast"
        getItemLayout={(_, index) => ({
          length: containerWidth,
          offset: containerWidth * index,
          index,
        })}
        horizontal
        keyExtractor={(item) => item.id}
        onMomentumScrollEnd={handleScroll}
        pagingEnabled
        ref={flatListRef}
        renderItem={renderSlideItem}
        scrollEventThrottle={16}
        showsHorizontalScrollIndicator={false}
        style={styles.flatList}
      />

      {/* Bottom Controls Bar */}
      <View style={styles.footerBar}>
        {/* Pagination Dots */}
        <View style={styles.dotsRow}>
          {SLIDES.map((slide, idx) => {
            const isActive = idx === activeIndex;
            return (
              <Pressable
                accessibilityLabel={t('checkinGuide.stepBadge', { current: idx + 1, total: SLIDES.length })}
                accessibilityRole="button"
                hitSlop={8}
                key={slide.id}
                onPress={() => handleDotPress(idx)}
                style={[styles.dot, isActive ? styles.dotActive : styles.dotInactive]}
              />
            );
          })}
        </View>

        {/* Action Buttons Row */}
        <View style={styles.buttonsRow}>
          {activeIndex > 0 ? (
            <Pressable
              accessibilityLabel={t('checkinGuide.prev')}
              accessibilityRole="button"
              onPress={handlePrev}
              style={({ pressed }) => [styles.prevBtn, pressed && styles.prevBtnPressed]}
            >
              <Ionicons name="arrow-back" size={18} color={isDark ? '#cbd5e1' : '#475569'} />
              <Text style={styles.prevBtnText}>{t('checkinGuide.prev')}</Text>
            </Pressable>
          ) : (
            <View style={styles.prevBtnPlaceholder} />
          )}

          {isLastSlide ? (
            <Pressable
              accessibilityLabel={t('checkinGuide.start')}
              accessibilityRole="button"
              onPress={handleNext}
              style={({ pressed }) => [styles.startBtnWrap, pressed && { opacity: 0.9 }]}
            >
              <LinearGradient
                colors={[colors.primary, colors.primaryDark]}
                end={{ x: 1, y: 0 }}
                start={{ x: 0, y: 0 }}
                style={styles.startBtnGradient}
              >
                <Text style={styles.startBtnText}>{t('checkinGuide.start')}</Text>
                <Ionicons name="checkmark-circle" size={20} color="#ffffff" />
              </LinearGradient>
            </Pressable>
          ) : (
            <Pressable
              accessibilityLabel={t('checkinGuide.next')}
              accessibilityRole="button"
              onPress={handleNext}
              style={({ pressed }) => [styles.nextBtn, pressed && styles.nextBtnPressed]}
            >
              <Text style={styles.nextBtnText}>{t('checkinGuide.next')}</Text>
              <Ionicons name="arrow-forward" size={18} color="#ffffff" />
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );

  if (!asModal) {
    return content;
  }

  return (
    <Modal
      animationType="fade"
      hardwareAccelerated
      onRequestClose={handleSkip}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View style={styles.modalOverlay}>
        <Animated.View entering={FadeInDown.duration(320).springify()} style={styles.modalCard}>
          {content}
        </Animated.View>
      </View>
    </Modal>
  );
});

function createStyles(
  typography: ReturnType<typeof useScaledTypography>,
  isDark: boolean,
  insets: ReturnType<typeof useSafeAreaInsets>,
) {
  const isWeb = Platform.OS === 'web';

  return StyleSheet.create({
    modalOverlay: {
      alignItems: 'center',
      backgroundColor: 'rgba(15, 23, 42, 0.65)',
      flex: 1,
      justifyContent: 'center',
      paddingBottom: Math.max(insets.bottom, 16),
      paddingHorizontal: 16,
      paddingTop: Math.max(insets.top, 16),
    },
    modalCard: {
      backgroundColor: isDark ? '#0f172a' : '#ffffff',
      borderColor: isDark ? '#334155' : '#e2e8f0',
      borderRadius: 28,
      borderWidth: 1,
      height: '90%',
      maxHeight: 720,
      maxWidth: 480,
      overflow: 'hidden',
      width: '100%',
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 16 },
          shadowOpacity: 0.25,
          shadowRadius: 32,
        },
        android: {
          elevation: 16,
        },
        default: {},
      }),
    },
    modalRoot: {
      backgroundColor: isDark ? '#0f172a' : '#ffffff',
      flex: 1,
      justifyContent: 'space-between',
    },
    headerBar: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 8,
    },
    headerLeftBadge: {
      alignItems: 'center',
      backgroundColor: isDark ? '#042f2e' : colors.primaryLight,
      borderColor: isDark ? '#0d9488' : '#99f6e4',
      borderRadius: 14,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    headerLeftText: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: '700',
    },
    skipButton: {
      alignItems: 'center',
      backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
      borderRadius: 16,
      flexDirection: 'row',
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    skipButtonPressed: {
      opacity: 0.75,
    },
    skipButtonText: {
      color: isDark ? '#94a3b8' : '#64748b',
      fontSize: 12.5,
      fontWeight: '600',
    },
    flatList: {
      flex: 1,
    },
    slideContainer: {
      alignItems: 'center',
      flex: 1,
      justifyContent: 'flex-start',
      paddingHorizontal: 20,
      paddingTop: 10,
    },
    imageCard: {
      backgroundColor: isDark ? '#1e293b' : '#f8fafc',
      borderColor: isDark ? '#334155' : '#e2e8f0',
      borderRadius: 22,
      borderWidth: 1,
      height: 250,
      overflow: 'hidden',
      width: '100%',
      ...Platform.select({
        ios: {
          shadowColor: '#0f172a',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.08,
          shadowRadius: 16,
        },
        android: {
          elevation: 4,
        },
        default: {},
      }),
    },
    slideImage: {
      height: '100%',
      width: '100%',
    },
    contentWrap: {
      alignItems: 'center',
      marginTop: 20,
      paddingHorizontal: 10,
      width: '100%',
    },
    stepBadge: {
      borderRadius: 12,
      marginBottom: 10,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    stepBadgeText: {
      fontSize: 11.5,
      fontWeight: '800',
    },
    slideTitle: {
      color: isDark ? '#f8fafc' : '#0f172a',
      fontSize: 21,
      fontWeight: '800',
      letterSpacing: -0.4,
      marginBottom: 10,
      textAlign: 'center',
    },
    slideDesc: {
      color: isDark ? '#cbd5e1' : '#475569',
      fontSize: 14.5,
      lineHeight: 22,
      textAlign: 'center',
    },
    footerBar: {
      paddingBottom: Math.max(insets.bottom, 16),
      paddingHorizontal: 20,
      paddingTop: 14,
    },
    dotsRow: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
      marginBottom: 14,
    },
    dot: {
      borderRadius: 4,
      marginHorizontal: 4,
    },
    dotActive: {
      backgroundColor: colors.primary,
      height: 8,
      width: 24,
    },
    dotInactive: {
      backgroundColor: isDark ? '#334155' : '#cbd5e1',
      height: 8,
      width: 8,
    },
    buttonsRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 12,
      justifyContent: 'space-between',
    },
    prevBtn: {
      alignItems: 'center',
      backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
      borderRadius: 16,
      flexDirection: 'row',
      gap: 6,
      height: 48,
      justifyContent: 'center',
      paddingHorizontal: 16,
    },
    prevBtnPressed: {
      opacity: 0.75,
    },
    prevBtnText: {
      color: isDark ? '#cbd5e1' : '#475569',
      fontSize: 14,
      fontWeight: '700',
    },
    prevBtnPlaceholder: {
      width: 48,
    },
    nextBtn: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: 16,
      flex: 1,
      flexDirection: 'row',
      gap: 6,
      height: 48,
      justifyContent: 'center',
      paddingHorizontal: 20,
    },
    nextBtnPressed: {
      opacity: 0.85,
    },
    nextBtnText: {
      color: '#ffffff',
      fontSize: 15,
      fontWeight: '700',
    },
    startBtnWrap: {
      flex: 1,
      overflow: 'hidden',
    },
    startBtnGradient: {
      alignItems: 'center',
      borderRadius: 16,
      flexDirection: 'row',
      gap: 8,
      height: 48,
      justifyContent: 'center',
      paddingHorizontal: 20,
    },
    startBtnText: {
      color: '#ffffff',
      fontSize: 15,
      fontWeight: '800',
    },
  });
}
