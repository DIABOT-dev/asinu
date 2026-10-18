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

const giftImage = require('../../../assets/images/rewards/checkin-gift.png');
const openingStageImage = require('../../../assets/images/rewards/box_opening_stage.png');
const previewPhoneImage = require('../../../assets/iphone-18-pro-01_5-1.webp');

// Display examples only, never other outcomes of the server's draw.
const previewRewards = [
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
  const [selected, setSelected] = useState<number | null>(initialReceipt?.box ?? null);
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<CheckinGiftReceipt | null>(initialReceipt);
  const [error, setError] = useState(false);
  const requestActive = useRef(false);
  const generation = useRef(0);
  const reduceMotion = useRef(true);
  const animation = useRef<Animated.CompositeAnimation | null>(null);
  const lid = useRef(new Animated.Value(initialReceipt ? 1 : 0)).current;
  const shake = useRef(new Animated.Value(0)).current;
  const reveal = useRef(new Animated.Value(initialReceipt ? 1 : 0)).current;

  useEffect(() => {
    // Hiding an interruptible modal must not discard a completed opening.
    if (requestActive.current) {return;}
    setSelected(initialReceipt?.box ?? null);
    setReceipt(initialReceipt ?? null);
    setError(false);
    lid.setValue(initialReceipt ? 1 : 0);
    reveal.setValue(initialReceipt ? 1 : 0);
  }, [initialReceipt, lid, reveal]);

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
        Animated.timing(shake, { toValue: 1, duration: 90, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 0, duration: 90, useNativeDriver: true }),
        Animated.timing(lid, {
          toValue: 1, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true,
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
      } else {
        const motion = Animated.timing(reveal, {
          toValue: 1, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true,
        });
        animation.current = motion;
        motion.start();
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
  const heartFloatColor = isDark ? '#2e6b60' : '#8ee5d3';
  const overlayColor = isDark ? 'rgba(0, 0, 0, 0.75)' : 'rgba(15, 35, 30, 0.45)';
  const primaryBrand = isDark ? colors.primary : '#21c4a2';
  const sheetWidth = Math.min(width - 32, 500);
  const boxWidth = (sheetWidth - 36) * 0.315 - 4;
  const isOpening = busy && selected !== null;

  // Render the full mascot illustration with gentle aura and animated lid overlay
  const boxArtwork = (box: number, size: number, opened: boolean) => {
    const source = identicalBoxes ? giftImage : boxImages[box];
    const artHeight = (size * 294) / 324;
    const progress = opened ? lid : null;
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
              scale: opened
                ? shake.interpolate({
                    inputRange: [-1, 0, 1],
                    outputRange: [0.98, 1, 1.04],
                  })
                : 1,
            },
          ],
        }}
      >
        {opened && (
          <Animated.View
            style={[
              styles.boxGlow,
              {
                opacity: lid,
                backgroundColor: isDark
                  ? 'rgba(46, 107, 96, 0.4)'
                  : 'rgba(255, 248, 200, 0.75)',
              },
            ]}
          />
        )}
        <Image
          source={source}
          style={{ width: size, height: artHeight }}
          contentFit="contain"
          accessible={false}
        />
        <Animated.View
          testID={`gift-box-lid-${box}`}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '40%',
            alignItems: 'center',
            justifyContent: 'center',
            transform: [
              {
                translateY: progress
                  ? progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -8],
                    })
                  : 0,
              },
            ],
          }}
        >
          {opened && (
            <Animated.View style={[styles.boxSparkle, { opacity: lid }]}>
              <Ionicons
                name="sparkles"
                size={Math.max(16, size * 0.16)}
                color={isDark ? '#ffe29a' : '#f5c842'}
              />
            </Animated.View>
          )}
        </Animated.View>
      </Animated.View>
    );
  };

  const content = (
    <View
      accessibilityViewIsModal
      style={[
        styles.sheet,
        {
          backgroundColor: isDark ? colors.surface : '#ffffff',
          width: sheetWidth,
          maxHeight: height - insets.top - insets.bottom - 32,
        },
      ]}
    >
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
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        bounces={false}
      >
        {/* Hero Section */}
        {!receipt && <View style={styles.heroWrapper}>
          <View style={styles.heroDecorations} pointerEvents="none">
            {/* Left floating heart and dashes */}
            <View style={styles.floatHeartLeft}>
              <Ionicons name="heart" size={17} color={heartFloatColor} />
            </View>
            <View style={[styles.floatDash, styles.floatDashLeft1, { backgroundColor: primaryBrand }]} />
            <View style={[styles.floatDash, styles.floatDashLeft2, { backgroundColor: primaryBrand }]} />

            {/* Right floating heart and dot */}
            <View style={styles.floatHeartRight}>
              <Ionicons name="heart" size={15} color={heartFloatColor} />
            </View>
            <View style={[styles.floatDot, styles.floatDotRight, { backgroundColor: primaryBrand }]} />
          </View>

          <Image
            source={giftImage}
            style={styles.hero}
            contentFit="contain"
            accessible={false}
          />
        </View>}

        <Text accessibilityRole="header" style={[styles.title, { color: ink }]}>
          {t(receipt ? 'checkinGift.received' : 'checkinGift.title')}
        </Text>

        <Text style={[styles.subtitle, { color: subInk }]}>
          {t(receipt ? 'checkinGift.openedToday' : isOpening ? 'checkinGift.openingBox' : 'checkinGift.choose', { number: (selected ?? 0) + 1 })}
        </Text>

        {notice && (
          <Text style={[styles.notice, { color: colors.warning, backgroundColor: colors.surfaceMuted }]}>
            {notice}
          </Text>
        )}

        {/* Dynamic Center Stage: Result, Opening Animation, or 6 Boxes */}
        {receipt ? (
          <Animated.View style={[styles.result, {
            opacity: reveal,
            transform: [{ translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
          }]} accessibilityLiveRegion="polite">
            {selected !== null ? <>
              <View style={styles.resultGrid} testID="gift-result-grid">
                {boxes.map((box) => {
                  const chosen = box === selected;
                  const preview = chosen ? null : previewRewards[(box - selected + 6) % 6 - 1];
                  const label = chosen ? receipt.title : t(preview!.labelKey);
                  return (
                    <Animated.View
                      key={box}
                      testID={chosen ? `gift-received-${box}` : `gift-preview-${box}`}
                      accessible
                      accessibilityLabel={`${t(chosen ? 'checkinGift.selectedReward' : 'checkinGift.previewReward')}: ${label}`}
                      style={[
                        styles.resultBox,
                        {
                          backgroundColor: chosen ? colors.primaryLight : colors.surfaceMuted,
                          borderColor: chosen ? primaryBrand : colors.border,
                          transform: [
                            { perspective: 600 },
                            { rotateY: reveal.interpolate({ inputRange: [0, 1], outputRange: ['90deg', '0deg'] }) },
                          ],
                        },
                      ]}
                    >
                      <Text style={[styles.resultBoxBadge, { color: chosen ? colors.primaryText : colors.textSecondary }]}>
                        {t(chosen ? 'checkinGift.selectedReward' : 'checkinGift.previewReward')}
                      </Text>
                      <View style={styles.resultBoxArt} testID={chosen ? `gift-box-art-${box}` : undefined}>
                        {preview?.labelKey === 'checkinGift.previewPhone'
                          ? <Image source={previewPhoneImage} contentFit="contain" style={styles.previewPhone} accessible={false} />
                          : <Ionicons
                              name={chosen ? (receipt.rulesPeriod ? 'ticket' : 'gift') : preview!.icon}
                              size={34}
                              color={chosen ? primaryBrand : colors.textSecondary}
                            />}
                      </View>
                      <Text numberOfLines={chosen ? 3 : undefined} style={[styles.resultBoxTitle, { color: chosen ? colors.primaryText : colors.textPrimary }]}>
                        {label}
                      </Text>
                    </Animated.View>
                  );
                })}
              </View>
              <Text style={[styles.previewExplanation, { color: colors.textSecondary }]}>
                {t('checkinGift.previewExplanation')}
              </Text>
            </> : <View
              style={styles.resultStageContainer}
              accessible
              accessibilityLabel={
                selected === null
                  ? t('checkinGift.received')
                  : t('checkinGift.openedBox', { number: selected + 1 })
              }
            >
              <Animated.View
                testID={selected !== null ? `gift-box-art-${selected}` : undefined}
                style={styles.stageArtWrapper}
              >
                <Image
                  source={openingStageImage}
                  style={styles.openingStageImage}
                  contentFit="contain"
                  accessible={false}
                />
              </Animated.View>
            </View>}

            <Text
              style={[
                styles.prizeTitle,
                {
                  color: colors.primaryText,
                  fontStyle: receipt.serif ? 'italic' : 'normal',
                },
              ]}
            >
              {receipt.title}
            </Text>
            {!!receipt.description && (
              <Text
                style={[
                  styles.prizeDescription,
                  { color: colors.textSecondary },
                ]}
              >
                {receipt.description}
              </Text>
            )}
            {!!receipt.prizeImage && !!receipt.rulesPeriod && (
              <View style={styles.prizeDetails}>
                <Image
                  source={receipt.prizeImage}
                  contentFit="contain"
                  style={styles.prizeBadgeImage}
                  accessible={false}
                />
                <Text
                  style={[
                    styles.prizeDescription,
                    { color: colors.textSecondary },
                  ]}
                >
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
                <Text style={[styles.rulesText, { color: primaryBrand }]}>
                  {t('checkinGift.rules')}
                </Text>
              </Pressable>
            )}
            <Text style={[styles.saved, { color: colors.textSecondary }]}>
              {t(demo ? 'checkinGift.demoSaved' : 'checkinGift.saved')}
            </Text>
          </Animated.View>
        ) : (
          <View style={styles.grid}>
            {boxes.map((box) => (
              <Pressable
                key={box}
                onPress={() => {
                  openBox(box);
                }}
                disabled={readOnly || busy}
                accessibilityRole="button"
                accessibilityLabel={t('checkinGift.box', { number: box + 1 })}
                accessibilityState={{
                  disabled: readOnly || busy,
                  selected: selected === box,
                  busy: busy && selected === box,
                }}
                style={({ pressed }) => [
                  styles.box,
                  {
                    borderColor:
                      selected === box ? primaryBrand : 'transparent',
                  },
                  pressed && styles.pressed,
                  busy && selected !== box && styles.muted,
                ]}
              >
                {boxArtwork(box, boxWidth, isOpening && selected === box)}
              </Pressable>
            ))}
          </View>
        )}

        {isOpening && (
          <View style={styles.openingStatus} accessibilityLiveRegion="polite">
            <ActivityIndicator color={primaryBrand} />
            <Text style={{ color: subInk, fontSize: 16 }}>{t('checkinGift.openingBox', { number: selected + 1 })}</Text>
          </View>
        )}

        {error && (
          <Text
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            style={[styles.error, { color: colors.danger }]}
          >
            {t('checkinGift.error')}
          </Text>
        )}

        <Pressable
          onPress={dismiss}
          disabled={readOnly || busy || !receipt}
          accessibilityRole="button"
          accessibilityState={{ disabled: readOnly || busy || !receipt }}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: primaryBrand },
            pressed && !!receipt && styles.pressed,
            (busy || !receipt) && styles.muted,
          ]}
        >
          <Text style={styles.buttonText}>
            {t(receipt ? 'checkinGift.done' : busy ? 'checkinGift.opening' : 'checkinGift.pickBox')}
          </Text>
        </Pressable>
      </ScrollView>
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
    paddingTop: 12,
    paddingBottom: 24,
  },
  heroWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 8,
    paddingTop: 6,
  },
  heroDecorations: {
    ...StyleSheet.absoluteFill,
  },
  floatHeartLeft: {
    position: 'absolute',
    left: '18%',
    top: 8,
    transform: [{ rotate: '-12deg' }],
  },
  floatDash: {
    position: 'absolute',
    width: 6,
    height: 2.2,
    borderRadius: 1.5,
  },
  floatDashLeft1: {
    left: '13%',
    top: 36,
    transform: [{ rotate: '-35deg' }],
  },
  floatDashLeft2: {
    left: '11%',
    top: 52,
    transform: [{ rotate: '15deg' }],
  },
  floatHeartRight: {
    position: 'absolute',
    right: '18%',
    top: 10,
    transform: [{ rotate: '15deg' }],
  },
  floatDot: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  floatDotRight: {
    right: '13%',
    top: 48,
  },
  hero: {
    width: 108,
    height: 104,
    alignSelf: 'center',
    zIndex: 1,
  },
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
    marginBottom: 20,
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
    aspectRatio: 324 / 294,
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
  boxLidOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '40%',
    alignItems: 'center',
    justifyContent: 'center',
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
  resultGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
  },
  resultBox: {
    width: '31.5%',
    minHeight: 150,
    paddingHorizontal: 6,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    gap: 8,
  },
  resultBoxBadge: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  resultBoxArt: {
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewPhone: { width: 56, height: 56 },
  resultBoxTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
    textAlign: 'center',
  },
  previewExplanation: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginVertical: 6,
  },
  resultStageContainer: {
    width: '100%',
    aspectRatio: 986 / 765,
    maxHeight: 240,
    borderRadius: 20,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  stageArtWrapper: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  openingStageImage: {
    width: '100%',
    height: '100%',
  },
  prizeTitle: {
    fontSize: 24,
    lineHeight: 32,
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
