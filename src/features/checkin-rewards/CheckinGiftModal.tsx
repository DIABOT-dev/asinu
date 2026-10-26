import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { QueuedModal } from '../../components/QueuedModal';
import { ScaledText as Text } from '../../components/ScaledText';
import { useThemeColors } from '../../hooks/useThemeColors';

const giftImage = require('../../../assets/images/rewards/checkin-gift.png');
const phonePrizeImage = require('../../../assets/iphone-18-pro-01_5-1.webp');
const rewardPhotos = {
  ticket: require('../../../assets/images/rewards/product-photos-v2/reward-ticket-photo-v2.png'),
  phone: phonePrizeImage,
  proverb: require('../../../assets/images/rewards/product-photos-v2/reward-proverb-photo-v2.png'),
  tip: require('../../../assets/images/rewards/product-photos-v2/reward-tip-photo-v2.png'),
  coupon: require('../../../assets/images/rewards/product-photos-v2/reward-coupon-photo-v2.png'),
  wish: require('../../../assets/images/rewards/product-photos-v2/reward-wish-photo-v2.png'),
};

const boxImages = [
  require('../../../assets/images/rewards/box_1.png'),
  require('../../../assets/images/rewards/box_2.png'),
  require('../../../assets/images/rewards/box_3.png'),
  require('../../../assets/images/rewards/box_4.png'),
  require('../../../assets/images/rewards/box_5.png'),
  require('../../../assets/images/rewards/box_6.png'),
] as const;

const boxes = [0, 1, 2, 3, 4, 5] as const;
const AUTO_CLOSE_SECONDS = 5;

export type CheckinGiftReceipt = {
  id: string;
  box?: number | null;
  title: string;
  shortTitle?: string;
  kind?: 'wish' | 'proverb' | 'health_tip' | 'ticket' | 'coupon';
  description?: string | null;
  serif?: boolean;
  prizeImage?: any;
  rulesPeriod?: string;
  drawPrize?: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onOpen: (box: number) => Promise<CheckinGiftReceipt>;
  onReceived?: (receipt: CheckinGiftReceipt) => void;
  readOnly?: boolean;
  demo?: boolean;
  identicalBoxes?: boolean;
  initialReceipt?: CheckinGiftReceipt | null;
  notice?: string;
  onRules?: (period: string) => void;
  preview?: boolean;
};

const otherRewardCatalog = [
  { key: 'ticket', labelKey: 'checkinGift.previewTicket' },
  { key: 'phone', labelKey: 'checkinGift.previewPhone' },
  { key: 'proverb', labelKey: 'checkinGift.previewProverb' },
  { key: 'tip', labelKey: 'checkinGift.previewTip' },
  { key: 'coupon', labelKey: 'checkinGift.couponLabel' },
  { key: 'wish', labelKey: 'checkinGift.previewWish' },
] as const;

/** The server owns eligibility and the prize. The six boxes only choose a visual slot. */
export function CheckinGiftModal({
  visible,
  onClose,
  onOpen,
  onReceived,
  readOnly = false,
  demo = false,
  identicalBoxes = false,
  initialReceipt = null,
  notice,
  onRules,
  preview,
}: Props) {
  const { t } = useTranslation('home');
  const { colors, isDark } = useThemeColors();
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const [selected, setSelected] = useState<number | null>(initialReceipt?.box ?? null);
  const [phase, setPhase] = useState<'choosing' | 'opening' | 'reward' | 'complete'>(initialReceipt ? 'complete' : 'choosing');
  const busy = phase === 'opening';
  const othersOpened = phase === 'reward' || phase === 'complete';
  const [receipt, setReceipt] = useState<CheckinGiftReceipt | null>(initialReceipt);
  const [error, setError] = useState(false);
  const [presented, setPresented] = useState(false);
  const [closeSeconds, setCloseSeconds] = useState(AUTO_CLOSE_SECONDS);
  const closeRequested = useRef(false);
  const returnToGridCallback = useRef<() => void>(() => {});
  const closeCallback = useRef(onClose);
  closeCallback.current = onClose;
  const scrollRef = useRef<ScrollView>(null);
  const scrollOffset = useRef(0);
  const [sheetHeight, setSheetHeight] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const [gridTop, setGridTop] = useState(0);
  const requestActive = useRef(false);
  const generation = useRef(0);
  const reduceMotion = useRef(true);
  const animation = useRef<Animated.CompositeAnimation | null>(null);
  const focus = useRef(new Animated.Value(0)).current;
  const lid = useRef(new Animated.Value(initialReceipt ? 1 : 0)).current;
  const shake = useRef(new Animated.Value(0)).current;
  const reveal = useRef(new Animated.Value(initialReceipt ? 1 : 0)).current;
  const otherOpening = useRef(new Animated.Value(initialReceipt ? 1 : 0)).current;
  const otherOpeningStarted = useRef(Boolean(initialReceipt));

  useEffect(() => {
    // Hiding an interruptible modal must not discard a completed opening.
    if (requestActive.current) {return;}
    setSelected(initialReceipt?.box ?? null);
    setReceipt(initialReceipt ?? null);
    setPhase(initialReceipt ? 'complete' : 'choosing');
    setError(false);
    focus.setValue(0);
    lid.setValue(initialReceipt ? 1 : 0);
    reveal.setValue(initialReceipt ? 1 : 0);
    otherOpening.setValue(initialReceipt ? 1 : 0);
    otherOpeningStarted.current = Boolean(initialReceipt);
  }, [initialReceipt, focus, lid, reveal, otherOpening]);

  useEffect(() => {
    let live = true;
    const update = (enabled: boolean) => { if (live) reduceMotion.current = enabled; };
    void AccessibilityInfo.isReduceMotionEnabled().then(update).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', update);
    return () => {
      live = false;
      generation.current++;
      animation.current?.stop();
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (receipt) {scrollRef.current?.scrollTo({ y: 0, animated: false });}
  }, [receipt]);

  useEffect(() => {
    if (!visible) {setPresented(false);}
  }, [visible]);

  useEffect(() => {
    if (!visible || !presented || phase !== 'reward' || !receipt?.id || otherOpeningStarted.current) {return;}
    otherOpeningStarted.current = true;
    if (reduceMotion.current) {
      otherOpening.setValue(1);
      return;
    }
    // Every remaining lid and reward uses one native animation, with no slot delay.
    const motion = Animated.timing(otherOpening, {
      toValue: 1, duration: 1100, easing: Easing.linear, useNativeDriver: true,
    });
    motion.start();
    return () => {
      motion.stop();
      // An urgent dialog or closing the upper section must not strand half-open boxes.
      otherOpening.setValue(1);
    };
  }, [visible, presented, phase, receipt?.id, otherOpening]);

  useEffect(() => {
    setCloseSeconds(AUTO_CLOSE_SECONDS);
    closeRequested.current = false;
    // Keep the full fortune above the already revealed grid for five visible
    // seconds, then collapse only that upper section. The grid stays open.
    if (!visible || !presented || readOnly || phase !== 'reward' || !receipt?.id) {return;}
    let remaining = AUTO_CLOSE_SECONDS;
    const advance = () => {
      if (closeRequested.current) {return;}
      remaining -= 1;
      setCloseSeconds(remaining);
      if (remaining === 0) {
        returnToGridCallback.current();
      } else {
        timer = setTimeout(advance, 1000);
      }
    };
    let timer = setTimeout(advance, 1000);
    return () => clearTimeout(timer);
  }, [visible, presented, readOnly, phase, receipt?.id]);

  const animateOpening = () => {
    if (reduceMotion.current) {
      focus.setValue(1);
      lid.setValue(1);
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      const motion = Animated.sequence([
        Animated.timing(focus, {
          toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true,
        }),
        Animated.timing(shake, { toValue: 1, duration: 55, useNativeDriver: true }),
        Animated.timing(shake, { toValue: -0.65, duration: 55, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 0, duration: 70, useNativeDriver: true }),
        Animated.timing(lid, {
          toValue: 1, duration: 340, easing: Easing.out(Easing.cubic), useNativeDriver: true,
        }),
      ]);
      animation.current = motion;
      motion.start(() => resolve());
    });
  };

  const openBox = async (box: number) => {
    if (readOnly || requestActive.current || receipt) {return;}
    const request = ++generation.current;
    requestActive.current = true;
    setPhase('opening');
    setError(false);
    setSelected(box);
    focus.setValue(0);
    lid.setValue(0);
    reveal.setValue(0);
    otherOpening.setValue(0);
    otherOpeningStarted.current = false;
    const opened = animateOpening();
    let savedReceipt: CheckinGiftReceipt | null = null;
    try {
      const received = await onOpen(box);
      if (request !== generation.current) {return;}
      savedReceipt = received;
      onReceived?.(received);
      await opened;
      if (request !== generation.current) {return;}
      setSelected(received.box ?? box);
      setReceipt(received);
      lid.setValue(1);
      if (reduceMotion.current) {
        reveal.setValue(1);
      } else {
        await new Promise<void>(resolve => {
          const motion = Animated.timing(reveal, { toValue: 1, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true });
          animation.current = motion;
          motion.start(() => resolve());
        });
        if (request !== generation.current) { return; }
      }
      setPhase('reward');
    } catch {
      if (request === generation.current) {
        animation.current?.stop();
        lid.setValue(0);
        focus.setValue(0);
        shake.setValue(0);
        if (savedReceipt) {
          setSelected(savedReceipt.box ?? box);
          setReceipt(savedReceipt);
          reveal.setValue(1);
          setPhase('reward');
        } else {
          setError(true);
          setPhase('choosing');
        }
      }
    } finally {
      if (request === generation.current) {
        requestActive.current = false;
      }
    }
  };

  const returnToGrid = () => {
    if (readOnly || !receipt || phase !== 'reward' || requestActive.current) {return;}
    focus.setValue(0);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    setPhase('complete');
  };
  returnToGridCallback.current = returnToGrid;

  const dismiss = () => {
    if (readOnly || !receipt || requestActive.current) {return;}
    if (phase === 'reward') {
      returnToGrid();
    } else if (phase === 'complete' && !closeRequested.current) {
      closeRequested.current = true;
      closeCallback.current();
    }
  };

  const ink = isDark ? colors.textPrimary : '#084844';
  const subInk = isDark ? colors.textSecondary : '#587a82';
  const handleColor = isDark ? colors.border : '#d1eae6';
  const closeColor = isDark ? colors.primaryText : '#087f70';
  const overlayColor = isDark ? 'rgba(0, 0, 0, 0.75)' : 'rgba(15, 35, 30, 0.45)';
  const primaryBrand = isDark ? colors.primary : '#087f70';
  const primaryInk = isDark ? '#073b33' : '#f4fffb';
  const sheetWidth = Math.min(width, 500);
  const boxWidth = (sheetWidth - 36) * 0.315 - 8;
  const cellHeight = phase === 'reward' ? Math.max(124, Math.ceil(boxWidth + 20)) : Math.max(148, Math.ceil(boxWidth + 48));
  const gridWidth = sheetWidth - 36;
  const rowGap = 12;
  const gridHeight = cellHeight * 2 + rowGap;
  const stageSize = Math.min(gridWidth - 12, 244);
  const selectedColumn = (selected ?? 0) % 3;
  const selectedRow = Math.floor((selected ?? 0) / 3);
  const tileWidth = gridWidth * 0.315;
  const sourceCenterX = tileWidth / 2 + selectedColumn * (gridWidth - tileWidth) / 2;
  const sourceCenterY = scrollTop + gridTop - scrollOffset.current + cellHeight / 2 + selectedRow * (cellHeight + rowGap);
  const sceneTop = ((sheetHeight || gridHeight + 208) - stageSize) / 2;
  const rewardPhoto = (kind: CheckinGiftReceipt['kind']) => {
    const key = kind === 'health_tip' ? 'tip' : kind || 'wish';
    const reward = otherRewardCatalog.find((item) => item.key === key) || otherRewardCatalog[5];
    return rewardPhotos[reward.key];
  };
  const rewardArtwork = (kind: CheckinGiftReceipt['kind'], size: number) => (
    <Image source={rewardPhoto(kind)} style={{ width: size, height: size }} contentFit="contain" accessible={false} />
  );
  // Animate the transparent present itself. Cropping the illustrated choice card
  // would lift its background and mascot together with the lid.
  const boxArtwork = (box: number, size: number, opened: boolean, progress = lid, wobble = true, showcase = false) => {
    const source = opened || identicalBoxes ? giftImage : boxImages[box];
    const artHeight = opened ? size : (size * 294) / 324;
    const imageWidth = opened ? size * 1.45 : size;
    const imageHeight = opened ? imageWidth * (1144 / 1375) : artHeight;
    const imageTop = opened ? -size * 0.14 : 0;
    const imageLeft = (size - imageWidth) / 2;
    const lidHeight = size * 0.47;
    return (
      <Animated.View
        testID={showcase ? 'gift-opening-art' : `gift-box-art-${box}`}
        pointerEvents="none"
        style={{
          width: size,
          height: artHeight,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [
            {
              rotate: opened && wobble
                ? shake.interpolate({
                    inputRange: [-1, 0, 1],
                    outputRange: ['-3deg', '0deg', '3deg'],
                  })
                : '0deg',
            },
          ],
        }}
      >
        {opened && (
          <Animated.View
            style={[
              styles.boxGlow,
              {
                opacity: progress.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0, 0, 0.9] }),
                transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.5] }) }],
              },
            ]}
          >
            <Svg width="100%" height="100%" viewBox="0 0 200 200" accessible={false}>
              <Defs>
                <RadialGradient id={`gift-light-${showcase ? 'main' : box}`} cx="50%" cy="50%" r="50%">
                  <Stop offset="0%" stopColor={isDark ? '#5fc7aa' : '#ffeaa0'} stopOpacity={0.9} />
                  <Stop offset="45%" stopColor={isDark ? '#2c8a73' : '#fff0b4'} stopOpacity={0.5} />
                  <Stop offset="100%" stopColor={isDark ? '#2c8a73' : '#fff8dc'} stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Rect width="200" height="200" fill={`url(#gift-light-${showcase ? 'main' : box})`} />
            </Svg>
          </Animated.View>
        )}
        {opened && (
          <Animated.View
            style={[
              styles.boxMouth,
              { top: lidHeight - size * 0.025, height: size * 0.09, opacity: progress },
            ]}
          />
        )}
        {showcase && receipt && (
          <Animated.View
            testID="gift-emerging-reward"
            style={{
              position: 'absolute',
              top: size * 0.22,
              left: size * 0.25,
              width: size * 0.5,
              height: size * 0.5,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: reveal,
              transform: [
                { translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [size * 0.2, -size * 0.25] }) },
                { scale: reveal.interpolate({ inputRange: [0, 1], outputRange: [0.65, 1] }) },
              ],
            }}
          >
            {rewardArtwork(receipt.kind, size * 0.5)}
          </Animated.View>
        )}
        {opened ? (
          <View style={{ position: 'absolute', top: lidHeight, width: size, height: artHeight - lidHeight, overflow: 'hidden' }}>
            <Image source={source} style={{ position: 'absolute', top: imageTop - lidHeight, left: imageLeft, width: imageWidth, height: imageHeight }} contentFit="contain" accessible={false} />
          </View>
        ) : (
          <Image source={source} style={{ width: size, height: artHeight }} contentFit="contain" accessible={false} />
        )}
        <Animated.View
          testID={showcase ? 'gift-opening-lid' : `gift-box-lid-${box}`}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: lidHeight,
            opacity: opened ? progress.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1, 0.2] }) : 0,
            transform: [
              {
                translateY: opened
                  ? progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -size * 0.5],
                    })
                  : 0,
              },
              { translateX: opened ? progress.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.08] }) : 0 },
              { rotate: opened ? progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-16deg'] }) : '0deg' },
            ],
          }}
        >
          {opened && (
            <View style={{ width: size, height: lidHeight, overflow: 'hidden' }}>
              <Image source={source} style={{ position: 'absolute', top: imageTop, left: imageLeft, width: imageWidth, height: imageHeight }} contentFit="contain" accessible={false} />
            </View>
          )}
          {opened && (
            <Animated.View style={[styles.boxSparkle, { opacity: progress }]}>
              <Ionicons
                name="sparkles"
                size={Math.max(22, size * 0.24)}
                color={isDark ? '#ffe29a' : '#f5c842'}
              />
            </Animated.View>
          )}
        </Animated.View>
        {showcase && [-1, 1, -0.65, 0.65, -0.3, 0.3].map((direction, index) => (
          <Animated.View
            key={index}
            testID={`gift-opening-spark-${index}`}
            style={[
              styles.openingSpark,
              {
                top: size * 0.36,
                left: size * 0.48,
                backgroundColor: index % 2 ? '#34cbb2' : '#f5c842',
                opacity: progress.interpolate({ inputRange: [0, 0.3, 0.75, 1], outputRange: [0, 0, 1, 0.4] }),
                transform: [
                  { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, direction * size * 0.52] }) },
                  { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, -size * (0.12 + index * 0.075)] }) },
                  { rotate: `${index * 35 + 20}deg` },
                  { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) },
                ],
              },
            ]}
          />
        ))}
      </Animated.View>
    );
  };

  const awardedBoxIndex = selected ?? receipt?.box ?? 0;

  // Determine label for the awarded prize
  const categoryLabel = receipt
    ? receipt.shortTitle || (demo ? receipt.title : t(
        receipt.kind === 'ticket'
          ? 'checkinGift.previewTicket'
          : receipt.kind === 'coupon'
          ? 'checkinGift.couponLabel'
          : receipt.kind === 'proverb'
          ? 'checkinGift.previewProverb'
          : receipt.kind === 'health_tip'
          ? 'checkinGift.previewTip'
          : 'checkinGift.previewWish'
      ))
    : '';

  // The other slots reveal the existing preview catalogue, never another award.
  const otherRewardsToShow = receipt
    ? otherRewardCatalog.filter(item => {
        if (receipt.kind === 'ticket' && item.key === 'ticket') return false;
        if (receipt.kind === 'coupon' && item.key === 'coupon') return false;
        if (receipt.kind === 'proverb' && item.key === 'proverb') return false;
        if (receipt.kind === 'health_tip' && item.key === 'tip') return false;
        if ((!receipt.kind || receipt.kind === 'wish') && item.key === 'wish') return false;
        return true;
      }).slice(0, 5)
    : [];

  const fortuneContent = receipt && (
    <View testID="gift-fortune" accessibilityLiveRegion="polite" style={styles.fortuneCard}>
      <Text style={[styles.fortuneText, { color: ink, fontStyle: receipt.serif ? 'italic' : 'normal' }]}>{receipt.title}</Text>
      {!!receipt.description && (demo || preview || !!receipt.rulesPeriod || receipt.kind === 'coupon') && (
        <Text style={[styles.prizeDescription, { color: subInk }]}>{receipt.description}</Text>
      )}
      {!!receipt.prizeImage && !!receipt.rulesPeriod && (
        <View style={styles.prizeDetails} testID="gift-prize-details">
          <Image source={receipt.prizeImage} contentFit="contain" style={styles.prizeBadgeImage} accessible={false} />
          <Text style={[styles.prizeDescription, { color: subInk }]}>{t('checkinGift.drawPrize', { prize: receipt.drawPrize })}</Text>
        </View>
      )}
      {!!receipt.rulesPeriod && (
        <Pressable accessibilityRole="button" disabled={readOnly || busy}
          onPress={() => onRules?.(receipt.rulesPeriod!)} style={styles.rulesButton}>
          <Text style={[styles.rulesText, { color: primaryBrand }]}>{t('checkinGift.rules')}</Text>
        </Pressable>
      )}
    </View>
  );

  const content = (
    <View
      accessibilityViewIsModal
      onLayout={(event) => setSheetHeight(event.nativeEvent.layout.height)}
      style={[
        styles.sheet,
        {
          backgroundColor: isDark ? colors.surface : '#fbfefc',
          width: sheetWidth,
          paddingBottom: Math.max(insets.bottom, 12),
          maxHeight: height - insets.top - insets.bottom - 24,
        },
      ]}
    >
      <View style={[styles.handle, { backgroundColor: handleColor }]} />
      {!!receipt && (
        <Pressable
          style={styles.close}
          onPress={dismiss}
          disabled={readOnly || busy}
          accessibilityRole="button"
          accessibilityLabel={t(phase === 'reward' ? 'checkinGift.backToBoxes' : 'checkinGift.close')}
          accessibilityState={{ disabled: readOnly || busy }}
          hitSlop={8}
        >
          <Ionicons name="close" size={26} color={closeColor} />
        </Pressable>
      )}
      <Animated.View style={[styles.header, { opacity: busy && !othersOpened ? focus.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 0, 0] }) : 1 }]}>
        <Text accessibilityRole="header" style={[styles.title, { color: ink }]}>
          {t(phase === 'reward' ? 'checkinGift.received' : 'checkinGift.title')}
        </Text>
        <View style={[styles.subtitleSpace, receipt && styles.openedSubtitle]}>
          {preview && <Text style={[styles.previewLabel, { color: subInk }]}>{t('checkinGift.previewMode')}</Text>}
          {!receipt && !busy && (
            <Text style={[styles.subtitle, { color: subInk }]}>{t('checkinGift.choose')}</Text>
          )}
        </View>
      </Animated.View>

      <ScrollView
        ref={scrollRef}
        onLayout={(event) => setScrollTop(event.nativeEvent.layout.y)}
        onScroll={(event) => { scrollOffset.current = event.nativeEvent.contentOffset.y; }}
        scrollEventThrottle={16}
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        bounces={false}
      >
        {notice && (
          <Text style={[styles.notice, { color: colors.warning, backgroundColor: colors.surfaceMuted }]}>
            {notice}
          </Text>
        )}

        {phase === 'reward' && receipt && (
          <View testID="gift-reward-page" style={styles.rewardPage}>
            <Image testID="gift-detail-photo" source={rewardPhoto(receipt.kind)}
              style={{ width: Math.min(sheetWidth - 80, 104), height: Math.min(sheetWidth - 80, 104) }}
              contentFit="contain" accessible={false} />
            <Text style={[styles.rewardCategory, { color: primaryBrand }]}>{categoryLabel}</Text>
            {fortuneContent}
          </View>
        )}

        <View
          style={styles.grid}
          testID={othersOpened ? 'gift-result-grid' : 'gift-chooser-grid'}
          onLayout={(event) => setGridTop(event.nativeEvent.layout.y)}
        >
          {boxes.map(box => {
            const chosen = selected !== null ? box === selected : !!receipt && box === awardedBoxIndex;
            const otherIndex = boxes.filter(slot => slot !== awardedBoxIndex).indexOf(box);
            const otherReward = otherRewardsToShow[otherIndex];
            const showOther = othersOpened && !chosen && !!otherReward;
            if (othersOpened && chosen && receipt) {
              return (
                <View
                  key={box}
                  testID={`gift-received-${box}`}
                  accessibilityLabel={`${t('checkinGift.selectedReward')}: ${receipt.title}`}
                  style={[
                    styles.box, styles.receivedBox,
                    { minHeight: cellHeight, borderColor: primaryBrand, backgroundColor: isDark ? colors.surfaceMuted : '#eaf9f3' },
                  ]}
                >
                  <View style={[styles.receivedBadge, { backgroundColor: primaryBrand }]}>
                    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}
                      style={[styles.receivedBadgeText, { color: primaryInk }]}>{t('checkinGift.selectedReward')}</Text>
                  </View>
                  <View testID={`gift-box-art-${box}`}>
                    <Image testID="gift-received-photo" source={rewardPhoto(receipt.kind)}
                      style={{ width: phase === 'reward' ? Math.min(boxWidth * 0.78, 64) : boxWidth * 0.78, height: phase === 'reward' ? Math.min(boxWidth * 0.78, 64) : boxWidth * 0.78 }} contentFit="contain" accessible={false} />
                  </View>
                  <Text style={[styles.slotLabel, { color: ink }]}>{categoryLabel}</Text>
                </View>
              );
            }
            if (showOther) {
              return (
                <View
                  key={box}
                  testID={`gift-other-${otherIndex}`}
                  accessibilityLabel={`${t('checkinGift.otherReward', { number: box + 1 })}: ${t(otherReward.labelKey)}`}
                  style={[styles.box, { minHeight: cellHeight, backgroundColor: isDark ? colors.surfaceMuted : '#f7faf8' }]}
                >
                  <Animated.View
                    testID={`gift-other-reveal-${box}`}
                    style={{
                      alignItems: 'center',
                      opacity: otherOpening.interpolate({ inputRange: [0, 0.55, 0.9, 1], outputRange: [0, 0, 1, 1] }),
                      transform: [
                        { translateY: otherOpening.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
                        { scale: otherOpening.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) },
                      ],
                    }}
                  >
                    <Image testID={`gift-other-photo-${otherReward.key}`} source={rewardPhotos[otherReward.key]}
                      style={{ width: phase === 'reward' ? Math.min(boxWidth * 0.76, 64) : boxWidth * 0.76, height: phase === 'reward' ? Math.min(boxWidth * 0.76, 64) : boxWidth * 0.76 }} contentFit="contain" accessible={false} />
                    <Text style={[styles.slotLabel, { color: subInk }]}>{t(otherReward.labelKey)}</Text>
                  </Animated.View>
                  <Animated.View
                    testID={`gift-other-opening-${box}`}
                    pointerEvents="none"
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                    style={[styles.otherOpening, {
                      opacity: otherOpening.interpolate({ inputRange: [0, 0.6, 0.9, 1], outputRange: [1, 1, 0, 0] }),
                    }]}
                  >
                    <Animated.View style={{ opacity: otherOpening.interpolate({ inputRange: [0, 0.1, 0.3, 1], outputRange: [0, 0, 1, 1] }) }}>
                      {boxArtwork(box, boxWidth, true, otherOpening, false)}
                    </Animated.View>
                    <Animated.View style={[styles.otherOpening, {
                      opacity: otherOpening.interpolate({ inputRange: [0, 0.1, 0.3, 1], outputRange: [1, 1, 0, 0] }),
                    }]}>
                      <Image source={identicalBoxes ? giftImage : boxImages[box]}
                        style={{ width: boxWidth, height: boxWidth * 294 / 324 }} contentFit="contain" accessible={false} />
                    </Animated.View>
                  </Animated.View>
                </View>
              );
            }
            return (
              <Pressable
                key={box}
                onPress={() => { openBox(box); }}
                disabled={readOnly || busy || !!receipt}
                accessibilityRole="button"
                accessibilityLabel={t('checkinGift.box', { number: box + 1 })}
                accessibilityState={{ disabled: readOnly || busy || !!receipt, selected: chosen, busy: busy && chosen }}
                style={({ pressed }) => [
                  styles.box,
                  { minHeight: cellHeight, backgroundColor: isDark ? colors.surfaceMuted : '#f7faf8' },
                  pressed && styles.pressed,
                ]}
              >
                <Animated.View style={{ opacity: chosen && busy ? focus.interpolate({ inputRange: [0, 0.35, 1], outputRange: [1, 0, 0] }) : 1 }}>
                  {boxArtwork(box, boxWidth, false, lid, false)}
                </Animated.View>
              </Pressable>
            );
          })}
        </View>

        {phase === 'complete' && (receipt?.kind === 'ticket' || receipt?.kind === 'coupon') && fortuneContent}

        {error && (
          <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.error, { color: colors.danger }]}>
            {t('checkinGift.error')}
          </Text>
        )}
      </ScrollView>

      {busy && !othersOpened && selected !== null && (
        <Animated.View
          testID="gift-opening-scene"
          pointerEvents="none"
          accessibilityState={{ busy: true }}
          style={[
            styles.openingScene,
            {
              width: stageSize,
              height: stageSize,
              left: (sheetWidth - stageSize) / 2,
              top: sceneTop,
              opacity: focus.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 1] }),
              transform: [
                { translateX: focus.interpolate({ inputRange: [0, 1], outputRange: [sourceCenterX - gridWidth / 2, 0] }) },
                { translateY: focus.interpolate({ inputRange: [0, 1], outputRange: [sourceCenterY - sceneTop - stageSize / 2, 0] }) },
                { scale: focus.interpolate({ inputRange: [0, 1], outputRange: [boxWidth / stageSize, 1] }) },
              ],
            },
          ]}
        >
          <View
            testID={receipt ? `gift-received-${selected}` : undefined}
            accessibilityLabel={receipt ? `${t('checkinGift.selectedReward')}: ${receipt.title}` : undefined}
          >
            {boxArtwork(selected, stageSize, true, lid, true, true)}
          </View>
        </Animated.View>
      )}

      {!!receipt && !busy && (
        <View style={styles.footer}>
          <Pressable
            onPress={dismiss}
            disabled={readOnly}
            accessibilityRole="button"
            accessibilityState={{ disabled: readOnly }}
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: primaryBrand },
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.buttonText, { color: primaryInk }]}>
              {t(phase === 'reward' && !readOnly ? 'checkinGift.closingIn' : 'checkinGift.done', { seconds: closeSeconds })}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );

  if (readOnly) {return <View style={styles.preview}>{content}</View>;}

  return (
    <QueuedModal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      priority={10}
      interruptible
      onShow={() => setPresented(true)}
      onDismiss={() => setPresented(false)}
      onRequestClose={dismiss}
    >
      <View
        style={[
          styles.overlay,
          {
            backgroundColor: overlayColor,
            paddingTop: insets.top + 16,
            paddingBottom: 0,
          },
        ]}
      >
        {content}
      </View>
    </QueuedModal>
  );
}

const styles = StyleSheet.create({
  preview: { alignItems: 'center', paddingVertical: 16 },
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 0,
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    flexShrink: 1,
  },
  handle: {
    height: 4.5,
    width: 44,
    borderRadius: 2.5,
    alignSelf: 'center',
    marginTop: 12,
  },
  close: {
    position: 'absolute',
    right: 16,
    top: 16,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 4,
    paddingBottom: 16,
  },
  header: { paddingHorizontal: 44, paddingTop: 16, paddingBottom: 8, alignItems: 'center', flexShrink: 0 },
  scroll: { flexShrink: 1 },
  footer: { paddingHorizontal: 18, paddingTop: 6, paddingBottom: 18, flexShrink: 0 },
  title: {
    fontSize: 21,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
    textAlign: 'center',
    minHeight: 24,
    marginBottom: 8,
  },
  subtitleSpace: { minHeight: 32 },
  openedSubtitle: { minHeight: 0 },
  previewLabel: { fontSize: 12, lineHeight: 18, textAlign: 'center', marginBottom: 6 },
  notice: {
    fontSize: 16,
    lineHeight: 24,
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
    marginBottom: 12,
  },
  box: {
    minHeight: 56,
    width: '31.5%',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    position: 'relative',
    backgroundColor: 'transparent',
  },
  receivedBox: { paddingTop: 38, paddingHorizontal: 5, paddingBottom: 10 },
  receivedBadge: { position: 'absolute', top: -1, left: 4, right: 4, paddingHorizontal: 2, paddingVertical: 3, borderBottomLeftRadius: 6, borderBottomRightRadius: 6 },
  receivedBadgeText: { color: '#f4fffb', fontSize: 12, fontWeight: '700', textAlign: 'center' },
  slotLabel: { fontSize: 14, lineHeight: 19, fontWeight: '600', textAlign: 'center', marginTop: 6, paddingHorizontal: 4 },
  otherOpening: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' },
  boxGlow: {
    position: 'absolute',
    left: '-10%',
    width: '120%',
    top: '-10%',
    height: '120%',
  },
  boxSparkle: {
    position: 'absolute',
    top: -6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxMouth: {
    position: 'absolute',
    left: '7%',
    right: '7%',
    borderRadius: 999,
    borderWidth: 3,
    borderColor: '#9be2d5',
    backgroundColor: '#237f71',
  },
  openingScene: {
    position: 'absolute',
    zIndex: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  openingSpark: {
    position: 'absolute',
    width: 7,
    height: 11,
    borderRadius: 2,
  },
  rewardPage: { alignItems: 'center', paddingTop: 12, paddingBottom: 8 },
  rewardCategory: { fontSize: 20, lineHeight: 28, fontWeight: '700', textAlign: 'center', marginTop: 10 },
  fortuneCard: { width: '100%', paddingHorizontal: 8, paddingTop: 12, paddingBottom: 8, alignItems: 'center' },
  fortuneText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 0,
  },
  prizeDescription: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 6,
  },
  prizeDetails: {
    alignItems: 'center',
    gap: 8,
    marginVertical: 8,
  },
  prizeBadgeImage: {
    width: 130,
    height: 130,
  },
  rulesButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
    marginTop: 4,
  },
  rulesText: {
    fontSize: 16,
    fontWeight: '600',
  },
  saved: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 6,
  },
  error: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 16,
  },
  button: {
    borderRadius: 999,
    minHeight: 56,
    paddingHorizontal: 20,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  pressed: { opacity: 0.85 },
});
