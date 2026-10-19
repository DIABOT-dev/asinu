import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
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
import { useScaledFontSize } from '../../hooks/useScaledTypography';

const giftImage = require('../../../assets/images/rewards/checkin-gift.png');
const openGiftImage = require('../../../assets/images/rewards/gift-open-box.png');
const mascotImage = require('../../../assets/asinu_chat_sticker.png');
const previewPhoneImage = require('../../../assets/iphone-18-pro-01_5-1.webp');

// The other slots show the gift collection; only the chosen receipt is awarded.
const otherRewards = [
  { labelKey: 'checkinGift.previewWish', icon: 'heart-outline' },
  { labelKey: 'checkinGift.previewProverb', icon: 'book-outline' },
  { labelKey: 'checkinGift.previewTip', icon: 'bulb-outline' },
  { labelKey: 'checkinGift.previewTicket', icon: 'ticket-outline' },
  { labelKey: 'checkinGift.previewPhone', icon: 'phone-portrait-outline' },
] as const;

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
  const cardFontSize = useScaledFontSize(14);
  const [selected, setSelected] = useState<number | null>(initialReceipt?.box ?? null);
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<CheckinGiftReceipt | null>(initialReceipt);
  const [othersOpened, setOthersOpened] = useState(Boolean(initialReceipt));
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [error, setError] = useState(false);
  const requestActive = useRef(false);
  const generation = useRef(0);
  const reduceMotion = useRef(true);
  const animation = useRef<Animated.CompositeAnimation | null>(null);
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
    setDetailsExpanded(false);
    setError(false);
    lid.setValue(initialReceipt ? 1 : 0);
    reveal.setValue(initialReceipt ? 1 : 0);
    otherLid.setValue(initialReceipt ? 1 : 0);
    othersReveal.setValue(initialReceipt ? 1 : 0);
  }, [initialReceipt, lid, otherLid, othersReveal, reveal]);

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

  const animateOpening = () => {
    if (reduceMotion.current) {
      lid.setValue(1);
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      const motion = Animated.sequence([
        Animated.timing(shake, { toValue: 1, duration: 60, useNativeDriver: true }),
        Animated.timing(shake, { toValue: -1, duration: 60, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 0, duration: 60, useNativeDriver: true }),
        Animated.timing(lid, {
          toValue: 1, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true,
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
      // Retries use the first box saved by the server, never a new draw.
      setSelected(received.box ?? box);
      setReceipt(received);
      lid.setValue(1);
      if (reduceMotion.current) {
        reveal.setValue(1);
        otherLid.setValue(1);
        othersReveal.setValue(1);
        setOthersOpened(true);
      } else {
        // The chosen prize appears first. The five remaining lids then open
        // together in the same slots, before their quieter contents appear.
        await new Promise<void>(resolve => {
          const motion = Animated.parallel([
            Animated.timing(reveal, { toValue: 1, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
            Animated.timing(otherLid, { toValue: 1, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          ]);
          animation.current = motion;
          motion.start(() => resolve());
        });
        if (request !== generation.current) { return; }
        setOthersOpened(true);
        const fade = Animated.timing(othersReveal, { toValue: 1, duration: 180, useNativeDriver: true });
        animation.current = fade;
        fade.start();
      }
    } catch {
      if (request === generation.current) {
        animation.current?.stop();
        lid.setValue(0);
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

  const ink = isDark ? colors.textPrimary : '#0f3840';
  const subInk = isDark ? colors.textSecondary : '#587a82';
  const handleColor = isDark ? colors.border : '#d2ede5';
  const closeColor = isDark ? colors.primaryText : '#20b697';
  const overlayColor = isDark ? 'rgba(0, 0, 0, 0.75)' : 'rgba(15, 35, 30, 0.45)';
  const primaryBrand = isDark ? colors.primary : '#21c4a2';
  const sheetWidth = Math.min(width - 32, 500);
  const boxWidth = (sheetWidth - 36) * 0.315 - 8;
  const cellHeight = Math.max(192, Math.ceil(boxWidth + 44 + cardFontSize * 6));
  const isOpening = busy && !receipt && selected !== null;

  // Split the existing illustration into real lid/body crops while opening.
  // Both crops use the same local image, so the box stays in its original slot.
  const boxArtwork = (box: number, size: number, opened: boolean, progress = lid, wobble = true) => {
    const source = identicalBoxes ? giftImage : boxImages[box];
    const artHeight = (size * 294) / 324;
    const lidHeight = artHeight * 0.46;
    return (
      <Animated.View
        testID={`gift-box-art-${box}`}
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
                    outputRange: ['-6deg', '0deg', '6deg'],
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
                opacity: progress,
                backgroundColor: isDark
                  ? 'rgba(46, 107, 96, 0.4)'
                  : 'rgba(255, 248, 200, 0.75)',
              },
            ]}
          />
        )}
        {opened ? <View style={{ position: 'absolute', top: lidHeight, width: size, height: artHeight - lidHeight, overflow: 'hidden' }}>
          <Image source={source} style={{ position: 'absolute', top: -lidHeight, width: size, height: artHeight }} contentFit="contain" accessible={false} />
        </View> : <Image source={source} style={{ width: size, height: artHeight }} contentFit="contain" accessible={false} />}
        <Animated.View
          testID={`gift-box-lid-${box}`}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: lidHeight,
            opacity: opened ? progress.interpolate({ inputRange: [0, 0.65, 1], outputRange: [1, 1, 0] }) : 0,
            transform: [
              {
                translateY: opened
                  ? progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -size * 0.55],
                    })
                  : 0,
              },
              { rotate: opened ? progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-16deg'] }) : '0deg' },
            ],
          }}
        >
          {opened && <View style={{ width: size, height: lidHeight, overflow: 'hidden' }}>
            <Image source={source} style={{ width: size, height: artHeight }} contentFit="contain" accessible={false} />
          </View>}
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
      </Animated.View>
    );
  };

  const content = (
    <View accessibilityViewIsModal style={[styles.sheet, {
      backgroundColor: colors.surface,
      width: sheetWidth,
      maxHeight: height - insets.top - insets.bottom - 32,
    }]}>
      <View style={[styles.handle, { backgroundColor: handleColor }]} />
      {!!receipt && <Pressable
        style={styles.close}
        onPress={dismiss}
        disabled={readOnly || busy}
        accessibilityRole="button"
        accessibilityLabel={t('checkinGift.close')}
        accessibilityState={{ disabled: readOnly || busy }}
        hitSlop={8}
      >
        <Ionicons name="close" size={26} color={closeColor} />
      </Pressable>}
      <View style={styles.header}>
        <Image source={giftImage} style={styles.headerGift} contentFit="contain" accessible={false} />
        <Text accessibilityRole="header" style={[styles.title, { color: ink }]}>
          {t('checkinGift.title')}
        </Text>
        <Text style={[styles.subtitle, { color: subInk }]}>
          {receipt ? '' : t(isOpening ? 'checkinGift.openingBox' : 'checkinGift.choose', { number: (selected ?? 0) + 1 })}
        </Text>
      </View>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content} bounces={false}>
        {notice && <Text style={[styles.notice, { color: colors.warning, backgroundColor: colors.surfaceMuted }]}>
          {notice}
        </Text>}
        <View style={styles.grid} testID={receipt ? 'gift-result-grid' : 'gift-chooser-grid'}>
          {boxes.map(box => {
            const chosen = box === (receipt ? selected ?? 0 : selected);
            if (!receipt || (!chosen && !othersOpened)) {
              return <Pressable key={box}
                onPress={() => { openBox(box); }}
                disabled={readOnly || busy || !!receipt}
                accessibilityRole="button"
                accessibilityLabel={t('checkinGift.box', { number: box + 1 })}
                accessibilityState={{ disabled: readOnly || busy || !!receipt, selected: chosen, busy: busy && (chosen || !!receipt) }}
                style={({ pressed }) => [styles.box, {
                  height: cellHeight,
                  borderColor: chosen ? primaryBrand : 'transparent',
                  zIndex: isOpening && chosen ? 2 : 0,
                }, pressed && styles.pressed, busy && !chosen && styles.muted]}>
                {boxArtwork(box, boxWidth, receipt ? !othersOpened : isOpening && chosen, receipt ? otherLid : lid, !receipt)}
              </Pressable>;
            }
            const other = chosen ? null : otherRewards[(box - (selected ?? 0) + 6) % 6 - 1];
            const label = chosen ? receipt.shortTitle || receipt.title : t(other!.labelKey);
            return <Animated.View key={box}
              testID={chosen ? `gift-received-${box}` : `gift-other-${box}`}
              accessible={!chosen}
              accessibilityLabel={`${chosen ? t('checkinGift.selectedReward') : t('checkinGift.otherReward', { number: box + 1 })}: ${chosen ? receipt.title : label}`}
              style={[styles.resultBox, {
                height: cellHeight,
                zIndex: chosen ? 1 : 0,
                opacity: chosen ? reveal : othersReveal.interpolate({ inputRange: [0, 1], outputRange: [0, 0.62] }),
                transform: [
                  { perspective: 600 },
                  { scale: (chosen ? reveal : othersReveal).interpolate({ inputRange: [0, 1], outputRange: [chosen ? 0.8 : 0.96, chosen ? 1.06 : 1] }) },
                ],
              }]}>
              <View style={[styles.resultBoxArt, { width: boxWidth + 12, height: boxWidth + 24 }]} testID={chosen ? `gift-box-art-${box}` : undefined}>
                {chosen && <View style={[styles.selectedAura, { backgroundColor: isDark ? colors.primaryLight : '#fff3c7' }]} />}
                <Image source={openGiftImage} contentFit="contain" style={styles.openBoxImage} accessible={false} />
                <View style={styles.rewardInside}>
                {other?.labelKey === 'checkinGift.previewPhone'
                  ? <Image source={previewPhoneImage} contentFit="contain" style={styles.previewPhone} accessible={false} />
                  : chosen && !receipt.rulesPeriod
                    ? <Image source={mascotImage} contentFit="contain" style={styles.receivedMascot} accessible={false} />
                    : <Ionicons name={chosen ? 'ticket' : other!.icon}
                        size={30} color={primaryBrand} />}
                </View>
              </View>
              <View style={[styles.rewardLabel, { backgroundColor: isDark ? colors.surface : '#f4fbfa' }]}>
              <Text numberOfLines={2} style={[styles.resultBoxTitle, { color: chosen ? colors.primaryText : colors.textPrimary }]}>
                {label}
              </Text>
              </View>
              <View style={styles.badgeSlot}>
                {chosen && <Pressable accessibilityRole="button" accessibilityLabel={t('checkinGift.readGift')}
                  accessibilityHint={receipt.title}
                  accessibilityState={{ expanded: detailsExpanded, disabled: readOnly || busy }} disabled={readOnly || busy}
                  onPress={() => { if (!readOnly && !busy) { setDetailsExpanded(value => !value); } }}
                  style={[styles.receivedBadge, { backgroundColor: colors.primaryLight }]}>
                  <Ionicons name="checkmark-circle" size={14} color={primaryBrand} />
                  <Text style={[styles.resultBoxBadge, { color: colors.primaryText }]}>{t('checkinGift.receivedBadge')}</Text>
                  <Ionicons name={detailsExpanded ? 'chevron-up' : 'chevron-down'} size={12} color={primaryBrand} />
                </Pressable>}
              </View>
            </Animated.View>;
          })}
        </View>
        {isOpening && <View style={styles.openingStatus} accessibilityLiveRegion="polite">
          <ActivityIndicator color={primaryBrand} />
          <Text style={{ color: subInk, fontSize: 16 }}>{t('checkinGift.openingBox', { number: selected + 1 })}</Text>
        </View>}
        {receipt && detailsExpanded && <Animated.View style={[styles.result, { opacity: reveal }]} accessibilityLiveRegion="polite" testID="gift-expanded-details">
          <Text style={[styles.prizeTitle, { color: colors.primaryText, fontStyle: receipt.serif ? 'italic' : 'normal' }]}>
            {receipt.title}
          </Text>
          {!!receipt.description && <Text style={[styles.prizeDescription, { color: colors.textSecondary }]}>
            {receipt.description}
          </Text>}
          {!!receipt.prizeImage && !!receipt.rulesPeriod && <View style={styles.prizeDetails} testID="gift-prize-details">
            <Image source={receipt.prizeImage} contentFit="contain" style={styles.prizeBadgeImage} accessible={false} />
            <Text style={[styles.prizeDescription, { color: colors.textSecondary }]}>
              {t('checkinGift.drawPrize', { prize: receipt.drawPrize })}
            </Text>
          </View>}
          {!!receipt.rulesPeriod && <Pressable accessibilityRole="button" disabled={readOnly || busy}
            onPress={() => onRules?.(receipt.rulesPeriod!)} style={styles.rulesButton}>
            <Text style={[styles.rulesText, { color: primaryBrand }]}>{t('checkinGift.rules')}</Text>
          </Pressable>}
          {demo && <Text style={[styles.saved, { color: colors.textSecondary }]}>{t('checkinGift.demoSaved')}</Text>}
        </Animated.View>}
        {error && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.error, { color: colors.danger }]}>
          {t('checkinGift.error')}
        </Text>}
      </ScrollView>
      <View style={styles.footer}>
        <Pressable onPress={dismiss} disabled={readOnly || busy || !receipt}
          accessibilityRole="button" accessibilityState={{ disabled: readOnly || busy || !receipt }}
          style={({ pressed }) => [styles.button, { backgroundColor: primaryBrand },
            pressed && !!receipt && styles.pressed, (busy || !receipt) && styles.muted]}>
          <Text style={styles.buttonText}>
            {t(receipt ? 'checkinGift.done' : busy ? 'checkinGift.opening' : 'checkinGift.pickBox')}
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
    borderRadius: 28,
    overflow: 'hidden',
    flexShrink: 1,
  },
  handle: {
    height: 4.5,
    width: 48,
    borderRadius: 2.5,
    alignSelf: 'center',
    marginTop: 12,
  },
  close: {
    position: 'absolute',
    right: 14,
    top: 14,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 16,
  },
  header: { paddingHorizontal: 44, paddingTop: 12, flexShrink: 0 },
  headerGift: { width: 40, height: 40, alignSelf: 'center', marginBottom: 2 },
  scroll: { flexShrink: 1 },
  footer: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 18, flexShrink: 0 },
  badgeSlot: { minHeight: 44, width: '100%', justifyContent: 'center' },
  title: {
    fontSize: 27,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
    textAlign: 'center',
    minHeight: 24,
    marginBottom: 8,
  },
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
    rowGap: 10,
    marginBottom: 20,
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
    left: '8%',
    right: '8%',
    top: '20%',
    height: '40%',
    borderRadius: 999,
  },
  boxSparkle: {
    position: 'absolute',
    top: -6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  openingStatus: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  result: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 10,
  },
  resultBox: {
    width: '31.5%',
    minHeight: 164,
    paddingHorizontal: 0,
    paddingVertical: 0,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  resultBoxBadge: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    flexShrink: 1,
  },
  resultBoxArt: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  openBoxImage: { width: '100%', height: '100%', position: 'absolute' },
  rewardInside: { position: 'absolute', left: '40%', right: '7%', top: '31%', bottom: '29%', alignItems: 'center', justifyContent: 'center' },
  receivedMascot: { width: 58, height: 64 },
  selectedAura: { position: 'absolute', width: '112%', height: '76%', top: '20%', borderRadius: 999, opacity: 0.45 },
  receivedBadge: { minHeight: 44, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 4, gap: 2 },
  rewardLabel: { width: '100%', minHeight: 28, borderRadius: 10, paddingHorizontal: 3, paddingVertical: 3, alignItems: 'center', justifyContent: 'center' },
  previewPhone: { width: 36, height: 44 },
  resultBoxTitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  prizeTitle: {
    fontSize: 19,
    lineHeight: 28,
    fontWeight: '700',
    textAlign: 'center',
  },
  prizeDescription: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  prizeDetails: {
    alignItems: 'center',
    gap: 8,
    marginVertical: 8,
  },
  prizeBadgeImage: {
    width: 140,
    height: 140,
  },
  rulesButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  rulesText: {
    fontSize: 17,
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
  pressed: { opacity: 0.82 },
  muted: { opacity: 0.55 },
});
