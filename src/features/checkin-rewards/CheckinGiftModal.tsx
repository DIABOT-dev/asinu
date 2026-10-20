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
const giftMascot = require('../../../assets/asinu_chat_sticker.png');

const openedMascotHero = require('../../../assets/images/rewards/opened_gift_mascot_hero.png');
const fortuneHeartHeader = require('../../../assets/images/rewards/fortune_heart_header.png');
const fortuneBranchLeft = require('../../../assets/images/rewards/fortune_branch_left.png');
const rewardBoxTicket = require('../../../assets/images/rewards/daily_reward_box_ticket.png');
const rewardBoxPhone = require('../../../assets/images/rewards/daily_reward_box_phone.png');
const rewardBoxBook = require('../../../assets/images/rewards/daily_reward_box_book.png');
const rewardBoxBulb = require('../../../assets/images/rewards/daily_reward_box_bulb.png');
const rewardBoxCoupon = require('../../../assets/images/rewards/daily_reward_box_coupon.png');
const rewardBoxWish = require('../../../assets/images/rewards/daily_reward_box_wish.png');

const boxImages = [
  require('../../../assets/images/rewards/box_1.png'),
  require('../../../assets/images/rewards/box_2.png'),
  require('../../../assets/images/rewards/box_3.png'),
  require('../../../assets/images/rewards/box_4.png'),
  require('../../../assets/images/rewards/box_5.png'),
  require('../../../assets/images/rewards/box_6.png'),
] as const;

const boxes = [0, 1, 2, 3, 4, 5] as const;

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
};

const otherRewardCatalog = [
  { key: 'ticket', labelKey: 'checkinGift.previewTicket', image: rewardBoxTicket },
  { key: 'phone', labelKey: 'checkinGift.previewPhone', image: rewardBoxPhone },
  { key: 'proverb', labelKey: 'checkinGift.previewProverb', image: rewardBoxBook },
  { key: 'tip', labelKey: 'checkinGift.previewTip', image: rewardBoxBulb },
  { key: 'coupon', labelKey: 'checkinGift.couponLabel', image: rewardBoxCoupon },
  { key: 'wish', labelKey: 'checkinGift.previewWish', image: rewardBoxWish },
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
}: Props) {
  const { t } = useTranslation('home');
  const { colors, isDark } = useThemeColors();
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const [selected, setSelected] = useState<number | null>(initialReceipt?.box ?? null);
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<CheckinGiftReceipt | null>(initialReceipt);
  const [othersOpened, setOthersOpened] = useState(Boolean(initialReceipt));
  const [error, setError] = useState(false);
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
  const otherLid = useRef(new Animated.Value(initialReceipt ? 1 : 0)).current;
  const othersReveal = useRef(new Animated.Value(initialReceipt ? 1 : 0)).current;

  useEffect(() => {
    // Hiding an interruptible modal must not discard a completed opening.
    if (requestActive.current) {return;}
    setSelected(initialReceipt?.box ?? null);
    setReceipt(initialReceipt ?? null);
    setOthersOpened(Boolean(initialReceipt));
    setError(false);
    focus.setValue(0);
    lid.setValue(initialReceipt ? 1 : 0);
    reveal.setValue(initialReceipt ? 1 : 0);
    otherLid.setValue(initialReceipt ? 1 : 0);
    othersReveal.setValue(initialReceipt ? 1 : 0);
  }, [initialReceipt, focus, lid, otherLid, othersReveal, reveal]);

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
    setBusy(true);
    setError(false);
    setSelected(box);
    focus.setValue(0);
    lid.setValue(0);
    reveal.setValue(0);
    otherLid.setValue(0);
    othersReveal.setValue(0);
    setOthersOpened(false);
    const opened = animateOpening();
    try {
      const received = await onOpen(box);
      if (request !== generation.current) {return;}
      onReceived?.(received);
      await opened;
      if (request !== generation.current) {return;}
      setSelected(received.box ?? box);
      setReceipt(received);
      lid.setValue(1);
      if (reduceMotion.current) {
        reveal.setValue(1);
        otherLid.setValue(1);
        othersReveal.setValue(1);
        setOthersOpened(true);
      } else {
        await new Promise<void>(resolve => {
          const motion = Animated.parallel([
            Animated.timing(reveal, { toValue: 1, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
            Animated.timing(otherLid, { toValue: 1, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          ]);
          animation.current = motion;
          motion.start(() => resolve());
        });
        if (request !== generation.current) { return; }
        reveal.setValue(0);
        setOthersOpened(true);
        await new Promise<void>(resolve => {
          const entrance = Animated.parallel([
            Animated.timing(reveal, { toValue: 1, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
            Animated.timing(othersReveal, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          ]);
          animation.current = entrance;
          entrance.start(() => resolve());
        });
      }
    } catch {
      if (request === generation.current) {
        animation.current?.stop();
        lid.setValue(0);
        focus.setValue(0);
        shake.setValue(0);
        setError(true);
      }
    } finally {
      if (request === generation.current) {
        setBusy(false);
        requestActive.current = false;
      }
    }
  };

  const dismiss = () => {
    if (!readOnly && receipt && !requestActive.current) {onClose();}
  };

  const ink = isDark ? colors.textPrimary : '#084844';
  const subInk = isDark ? colors.textSecondary : '#587a82';
  const handleColor = isDark ? colors.border : '#d1eae6';
  const closeColor = isDark ? colors.primaryText : '#00bba4';
  const overlayColor = isDark ? 'rgba(0, 0, 0, 0.75)' : 'rgba(15, 35, 30, 0.45)';
  const primaryBrand = isDark ? colors.primary : '#00bba4';
  const sheetWidth = Math.min(width - 32, 500);
  const boxWidth = (sheetWidth - 36) * 0.315 - 8;
  const cellHeight = Math.max(88, Math.ceil(boxWidth * (294 / 324)) + 12);
  const isOpening = busy && !receipt && selected !== null;
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
              opacity: reveal,
              transform: [
                { translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [size * 0.2, -size * 0.25] }) },
                { scale: reveal.interpolate({ inputRange: [0, 1], outputRange: [0.65, 1] }) },
              ],
            }}
          >
            <Image source={giftMascot} style={styles.heroImage} contentFit="contain" accessible={false} />
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

  // Other 5 rewards displayed in the bottom row, accounting for all 6 boxes (1 hero + 5 other = 6)
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

  const heroWidth = Math.min(sheetWidth - 24, 380);
  const heroHeight = Math.round(heroWidth * (423 / 852));

  const content = (
    <View
      accessibilityViewIsModal
      onLayout={(event) => setSheetHeight(event.nativeEvent.layout.height)}
      style={[
        styles.sheet,
        {
          backgroundColor: isDark ? colors.surface : '#ffffff',
          width: sheetWidth,
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
          accessibilityLabel={t('checkinGift.close')}
          accessibilityState={{ disabled: readOnly || busy }}
          hitSlop={8}
        >
          <Ionicons name="close" size={26} color={closeColor} />
        </Pressable>
      )}
      <Animated.View style={[styles.header, { opacity: busy && !othersOpened ? focus.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 0, 0] }) : 1 }]}>
        <Image source={giftImage} style={styles.headerGift} contentFit="contain" accessible={false} />
        <Text accessibilityRole="header" style={[styles.title, { color: ink }]}>
          {t('checkinGift.title')}
        </Text>
        <View style={styles.subtitleSpace}>
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

        {!othersOpened ? (
          <View style={styles.grid} testID="gift-chooser-grid" onLayout={(event) => setGridTop(event.nativeEvent.layout.y)}>
            {boxes.map(box => {
              const chosen = selected !== null && box === selected;
              if (receipt && chosen) {
                return (
                  <View key={box} style={[styles.box, { height: cellHeight }]} />
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
                    {
                      height: cellHeight,
                      borderColor: chosen && !busy ? primaryBrand : 'transparent',
                      zIndex: isOpening && chosen ? 2 : 0,
                    },
                    pressed && styles.pressed,
                    busy && !chosen && styles.muted,
                  ]}
                >
                  <Animated.View
                    style={{ opacity: chosen && busy ? focus.interpolate({ inputRange: [0, 0.35, 1], outputRange: [1, 0, 0] }) : 1 }}
                  >
                    {boxArtwork(box, boxWidth, !!receipt, otherLid, false)}
                  </Animated.View>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={styles.openedContainer}>
            {/* Hero Mascot in Open Gift Box */}
            <Animated.View
              testID={`gift-received-${awardedBoxIndex}`}
              accessibilityLabel={`${t('checkinGift.selectedReward')}: ${receipt?.title ?? ''}`}
              style={[
                styles.heroContainer,
                {
                  opacity: reveal,
                  transform: [
                    {
                      scale: reveal.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.88, 1],
                      }),
                    },
                  ],
                },
              ]}
            >
              <View
                testID={`gift-box-art-${awardedBoxIndex}`}
                style={[styles.heroArtWrapper, { width: heroWidth, height: heroHeight }]}
              >
                <Image
                  source={openedMascotHero}
                  style={styles.heroImage}
                  contentFit="contain"
                  accessible={false}
                />
              </View>
            </Animated.View>

            {/* Badges: Category pill & Status pill with sunburst rays */}
            <Animated.View style={[styles.badgesWrapper, { opacity: reveal }]}>
              {/* Category pill */}
              <View
                style={[
                  styles.categoryPill,
                  {
                    backgroundColor: isDark ? colors.surfaceMuted : '#f3fbf9',
                    borderColor: isDark ? colors.border : '#a7f3d0',
                  },
                ]}
              >
                <Text style={[styles.categoryPillText, { color: isDark ? colors.textPrimary : '#084844' }]}>
                  {categoryLabel}
                </Text>
              </View>

              {/* Status pill with radiating sunburst ticks */}
              <View style={styles.statusPillRow}>
                {/* Left sunburst ticks */}
                <View style={styles.sunburstTicksLeft}>
                  <View style={[styles.sunburstTick, styles.tickTopLeft]} />
                  <View style={[styles.sunburstTick, styles.tickMidLeft]} />
                  <View style={[styles.sunburstTick, styles.tickBotLeft]} />
                </View>

                {/* Status pill container */}
                <View
                  style={[
                    styles.statusPill,
                    { backgroundColor: isDark ? colors.surfaceMuted : '#e3f8f2' },
                  ]}
                >
                  <Ionicons name="checkmark-circle" size={18} color="#059669" style={styles.statusIcon} />
                  <Text style={[styles.statusPillText, { color: isDark ? colors.textPrimary : '#084844' }]}>
                    {t('checkinGift.receivedBadge')}
                  </Text>
                </View>

                {/* Right sunburst ticks */}
                <View style={styles.sunburstTicksRight}>
                  <View style={[styles.sunburstTick, styles.tickTopRight]} />
                  <View style={[styles.sunburstTick, styles.tickMidRight]} />
                  <View style={[styles.sunburstTick, styles.tickBotRight]} />
                </View>
              </View>
            </Animated.View>

            {/* Fortune Card */}
            {receipt && (
              <Animated.View
                testID="gift-fortune"
                accessibilityLiveRegion="polite"
                style={[
                  styles.fortuneCard,
                  {
                    opacity: reveal,
                    backgroundColor: isDark ? colors.surface : '#fbfefe',
                    borderColor: isDark ? colors.border : '#b2edd9',
                  },
                ]}
              >
                {/* Pink heart with golden sparkles */}
                <Image
                  source={fortuneHeartHeader}
                  style={styles.fortuneHeartHeader}
                  contentFit="contain"
                  accessible={false}
                />

                {/* Left floral vine */}
                <Image
                  source={fortuneBranchLeft}
                  style={styles.fortuneBranchLeft}
                  contentFit="contain"
                  accessible={false}
                />

                {/* Right floral vine */}
                <Image
                  source={fortuneBranchLeft}
                  style={styles.fortuneBranchRight}
                  contentFit="contain"
                  accessible={false}
                />

                {/* Fortune Text */}
                <Text
                  style={[
                    styles.fortuneText,
                    {
                      color: isDark ? colors.textPrimary : '#094d45',
                      fontStyle: receipt.serif ? 'italic' : 'normal',
                    },
                  ]}
                >
                  {receipt.title}
                </Text>

                {!!receipt.description && (demo || !!receipt.rulesPeriod || receipt.kind === 'coupon') && (
                  <Text style={[styles.prizeDescription, { color: colors.textSecondary }]}>
                    {receipt.description}
                  </Text>
                )}

                {!!receipt.prizeImage && !!receipt.rulesPeriod && (
                  <View style={styles.prizeDetails} testID="gift-prize-details">
                    <Image source={receipt.prizeImage} contentFit="contain" style={styles.prizeBadgeImage} accessible={false} />
                    <Text style={[styles.prizeDescription, { color: colors.textSecondary }]}>
                      {t('checkinGift.drawPrize', { prize: receipt.drawPrize })}
                    </Text>
                  </View>
                )}

                {!!receipt.rulesPeriod && (
                  <Pressable
                    accessibilityRole="button"
                    disabled={readOnly || busy}
                    onPress={() => onRules?.(receipt.rulesPeriod!)}
                    style={styles.rulesButton}
                  >
                    <Text style={[styles.rulesText, { color: primaryBrand }]}>{t('checkinGift.rules')}</Text>
                  </Pressable>
                )}

                {demo && <Text style={[styles.saved, { color: colors.textSecondary }]}>{t('checkinGift.demoSaved')}</Text>}
              </Animated.View>
            )}

            {/* Other Prizes Row */}
            <Animated.View
              testID="gift-result-grid"
              style={[
                styles.otherRewardsRow,
                {
                  opacity: othersReveal.interpolate({ inputRange: [0, 1], outputRange: [0, 0.9] }),
                },
              ]}
            >
              {otherRewardsToShow.map((item, index) => (
                <Animated.View
                  key={item.key}
                  testID={`gift-other-${index}`}
                  accessibilityLabel={`${t('checkinGift.otherReward', { number: index + 1 })}: ${t(item.labelKey)}`}
                  style={[
                    styles.otherRewardItem,
                    {
                      opacity: othersReveal.interpolate({ inputRange: [0, (index + 1) * 0.05, 0.72 + index * 0.06, 1], outputRange: [0, 0, 1, 1] }),
                      transform: [{ translateY: othersReveal.interpolate({ inputRange: [0, 1], outputRange: [12 + index * 2, 0] }) }],
                    },
                  ]}
                >
                  <Image
                    source={item.image}
                    style={styles.otherRewardBoxImage}
                    contentFit="contain"
                    accessible={false}
                  />
                  <View
                    style={[
                      styles.otherRewardLabelContainer,
                      { backgroundColor: isDark ? colors.surfaceMuted : '#f1f5f5' },
                    ]}
                  >
                    <Text
                      numberOfLines={2}
                      style={[
                        styles.otherRewardLabelText,
                        { color: isDark ? colors.textSecondary : '#556565' },
                      ]}
                    >
                      {t(item.labelKey)}
                    </Text>
                  </View>
                </Animated.View>
              ))}
            </Animated.View>
          </View>
        )}

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
          {receipt && (
            <Animated.View style={[styles.openingBadge, { opacity: reveal }]}>
              <Ionicons name="checkmark-circle" size={18} color={primaryBrand} />
              <Text style={{ color: ink, fontSize: 15, fontWeight: '700' }}>{t('checkinGift.receivedBadge')}</Text>
            </Animated.View>
          )}
        </Animated.View>
      )}

      <View style={styles.footer}>
        <Pressable
          onPress={dismiss}
          disabled={readOnly || busy || !receipt}
          accessibilityRole="button"
          accessible={!busy}
          accessibilityState={{ disabled: readOnly || busy || !receipt }}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: primaryBrand },
            pressed && !!receipt && styles.pressed,
            (busy || !receipt) && styles.muted,
            busy && styles.invisible,
          ]}
        >
          <Text style={styles.buttonText}>
            {!busy && t(receipt ? 'checkinGift.done' : 'checkinGift.pickBox')}
          </Text>
        </Pressable>
      </View>
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
      onRequestClose={dismiss}
    >
      <View
        style={[
          styles.overlay,
          {
            backgroundColor: overlayColor,
            paddingTop: insets.top + 16,
            paddingBottom: insets.bottom + 16,
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
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  sheet: {
    borderRadius: 32,
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
  header: { paddingHorizontal: 44, paddingTop: 8, paddingBottom: 4, alignItems: 'center', flexShrink: 0 },
  headerGift: { width: 38, height: 38, marginBottom: 2 },
  scroll: { flexShrink: 1 },
  footer: { paddingHorizontal: 18, paddingTop: 6, paddingBottom: 18, flexShrink: 0 },
  title: {
    fontSize: 25,
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
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    position: 'relative',
    backgroundColor: 'transparent',
  },
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
  openingBadge: {
    position: 'absolute',
    bottom: -30,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#e3f8f2',
  },
  invisible: { opacity: 0 },
  openedContainer: {
    width: '100%',
    alignItems: 'center',
  },
  heroContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    marginBottom: 6,
  },
  heroArtWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  badgesWrapper: {
    alignItems: 'center',
    width: '100%',
    marginBottom: 12,
  },
  categoryPill: {
    paddingHorizontal: 28,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1.5,
    marginBottom: 8,
    shadowColor: '#1ca492',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 1,
  },
  categoryPillText: {
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  statusPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sunburstTicksLeft: {
    width: 22,
    height: 24,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingRight: 5,
  },
  sunburstTicksRight: {
    width: 22,
    height: 24,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingLeft: 5,
  },
  sunburstTick: {
    width: 7,
    height: 2.5,
    borderRadius: 1.5,
    backgroundColor: '#f59e0b',
  },
  tickTopLeft: {
    transform: [{ rotate: '-35deg' }],
  },
  tickMidLeft: {
    transform: [{ rotate: '0deg' }],
  },
  tickBotLeft: {
    transform: [{ rotate: '35deg' }],
  },
  tickTopRight: {
    transform: [{ rotate: '35deg' }],
  },
  tickMidRight: {
    transform: [{ rotate: '0deg' }],
  },
  tickBotRight: {
    transform: [{ rotate: '-35deg' }],
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 999,
    gap: 5,
  },
  statusIcon: {
    marginRight: 1,
  },
  statusPillText: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  fortuneCard: {
    width: '100%',
    borderRadius: 24,
    borderWidth: 1.5,
    paddingHorizontal: 28,
    paddingTop: 16,
    paddingBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#1ca492',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
    marginBottom: 14,
  },
  fortuneHeartHeader: {
    width: 78,
    height: 28,
    marginBottom: 10,
  },
  fortuneBranchLeft: {
    position: 'absolute',
    left: 4,
    bottom: 2,
    width: 58,
    height: 76,
  },
  fortuneBranchRight: {
    position: 'absolute',
    right: 4,
    bottom: 2,
    width: 58,
    height: 76,
    transform: [{ scaleX: -1 }],
  },
  fortuneText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  otherRewardsRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  otherRewardItem: {
    width: '18.8%',
    alignItems: 'center',
  },
  otherRewardBoxImage: {
    width: '100%',
    height: 52,
    marginBottom: 3,
  },
  otherRewardLabelContainer: {
    width: '100%',
    minHeight: 32,
    borderRadius: 11,
    paddingHorizontal: 1.5,
    paddingVertical: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otherRewardLabelText: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '600',
    textAlign: 'center',
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
    minHeight: 54,
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
  muted: { opacity: 0.55 },
});
