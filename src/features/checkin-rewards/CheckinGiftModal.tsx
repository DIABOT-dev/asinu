import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
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
  title: string;
  description?: string | null;
  serif?: boolean;
  rulesPeriod?: string;
  drawPrize?: string;
  prizeImage?: number;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onSkip: () => Promise<void>;
  onOpen: (box: number) => Promise<CheckinGiftReceipt>;
  onReceived?: (receipt: CheckinGiftReceipt) => void;
  readOnly?: boolean;
  demo?: boolean;
  initialReceipt?: CheckinGiftReceipt | null;
  identicalBoxes?: boolean;
  thanks?: string;
  notice?: string;
  onRules?: (period: string) => void;
};

/** The server owns eligibility and the prize. The six boxes only choose a visual slot. */
export function CheckinGiftModal({
  visible,
  onClose,
  onSkip,
  onOpen,
  onReceived,
  readOnly = false,
  demo = false,
  initialReceipt = null,
  identicalBoxes = false,
  thanks,
  notice,
  onRules,
}: Props) {
  const { t } = useTranslation('home');
  const { colors, isDark } = useThemeColors();
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const [selected, setSelected] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<CheckinGiftReceipt | null>(initialReceipt);
  const [error, setError] = useState(false);
  const requestActive = useRef(false);
  const generation = useRef(0);

  useEffect(() => {
    generation.current++;
    if (!visible) {return;}
    setSelected(null);
    setBusy(false);
    setReceipt(initialReceipt ?? null);
    setError(false);
    requestActive.current = false;
    return () => { generation.current++; };
  }, [visible, initialReceipt]);

  const openBox = async (box: number) => {
    if (readOnly || requestActive.current || receipt) {return;}
    requestActive.current = true;
    setBusy(true);
    setError(false);
    setSelected(box);
    const requestGeneration = generation.current;
    try {
      const received = await onOpen(box);
      if (generation.current !== requestGeneration) return;
      setReceipt(received);
      onReceived?.(received);
    } catch {
      if (generation.current === requestGeneration) setError(true);
    } finally {
      if (generation.current === requestGeneration) { setBusy(false); requestActive.current = false; }
    }
  };

  const skip = async () => {
    if (readOnly || requestActive.current) {return;}
    requestActive.current = true;
    setBusy(true);
    setError(false);
    const requestGeneration = generation.current;
    try {
      await onSkip();
      if (generation.current !== requestGeneration) return;
      onClose();
    } catch {
      if (generation.current === requestGeneration) setError(true);
    } finally {
      if (generation.current === requestGeneration) { setBusy(false); requestActive.current = false; }
    }
  };

  const dismiss = () => {
    if (!readOnly && !requestActive.current) {onClose();}
  };

  const ink = isDark ? colors.textPrimary : '#0f3a42';
  const subInk = isDark ? colors.textSecondary : '#5b7a82';
  const boxColor = isDark ? colors.primaryLight : '#f1fbf7';
  const handleColor = isDark ? colors.border : '#c4e8de';
  const closeColor = isDark ? colors.primaryText : '#1eb596';
  const platformColor = isDark ? '#143630' : '#daf5ed';
  const heartFloatColor = isDark ? '#2e6b60' : '#a2e4d5';
  const overlayColor = isDark ? 'rgba(5, 25, 21, 0.92)' : 'rgba(12, 78, 68, 0.88)';
  const primaryBrand = isDark ? colors.primary : '#1eb596';

  const heroSource = !identicalBoxes && receipt && selected !== null && boxImages[selected]
    ? boxImages[selected]
    : giftImage;

  const content = (
    <View
      accessibilityViewIsModal
      style={[
        styles.sheet,
        {
          backgroundColor: isDark ? colors.surface : '#ffffff',
          width: Math.min(width - 32, 500),
          maxHeight: height - insets.top - insets.bottom - 32,
        },
      ]}
    >
      <View style={[styles.handle, { backgroundColor: handleColor }]} />
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
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        bounces={false}
      >
        {/* Hero Section */}
        <View style={styles.heroWrapper}>
          {!receipt && (
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
          )}

          <Image
            source={heroSource}
            style={[styles.hero, receipt && styles.resultHero]}
            contentFit="contain"
            accessible={false}
          />
          {!receipt && (
            <View style={[styles.heroPlatform, { backgroundColor: platformColor }]} />
          )}
        </View>

        <Text accessibilityRole="header" style={[styles.title, { color: ink }]}>
          {t(receipt ? 'checkinGift.received' : 'checkinGift.title')}
        </Text>
        {!!thanks && !receipt && <Text style={[styles.subtitle, { color: subInk }]}>{thanks}</Text>}
        {!!notice && <Text accessibilityRole="alert" style={[styles.notice, { color: colors.textPrimary, backgroundColor: colors.surfaceMuted }]}>{notice}</Text>}

        {receipt ? (
          <View style={styles.result} accessibilityLiveRegion="polite">
            <Text style={[styles.prizeTitle, { color: colors.primaryText, fontStyle: receipt.serif ? 'italic' : 'normal' }]}>
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
              <View style={{ alignItems: 'center', gap: 12 }}>
                <Image source={receipt.prizeImage} contentFit="contain"
                  style={{ width: 160, height: 160 }} accessible={false} />
                <Text style={[styles.prizeDescription, { color: colors.textSecondary }]}>
                  {t('checkinGift.drawPrize', { prize: receipt.drawPrize })}
                </Text>
              </View>
            )}
            {!!receipt.rulesPeriod && <Pressable accessibilityRole="button" disabled={readOnly || busy}
              onPress={() => onRules?.(receipt.rulesPeriod!)} style={{ minHeight: 56, justifyContent: 'center' }}>
              <Text style={{ fontSize: 20, color: colors.primaryText }}>{t('checkinGift.rules')}</Text>
            </Pressable>}
            <Text style={[styles.saved, { color: colors.textSecondary }]}>
              {t(demo ? 'checkinGift.demoSaved' : 'checkinGift.saved')}
            </Text>
          </View>
        ) : (
          <>
            <Text style={[styles.subtitle, { color: subInk }]}>
              {t('checkinGift.choose')}
            </Text>
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
                    busy: busy && selected === box,
                  }}
                  style={({ pressed }) => [
                    styles.box,
                    {
                      borderColor: selected === box ? primaryBrand : 'transparent',
                    },
                    pressed && styles.pressed,
                    busy && selected !== box && styles.muted,
                  ]}
                >
                  <Image
                    source={identicalBoxes ? giftImage : boxImages[box]}
                    style={styles.boxImage}
                    contentFit="cover"
                    accessible={false}
                  />
                  {busy && selected === box && (
                    <View
                      style={[styles.opening, { backgroundColor: boxColor }]}
                    >
                      <ActivityIndicator color={primaryBrand} />
                      <Text
                        style={[
                          styles.openingText,
                          { color: colors.primaryText },
                        ]}
                      >
                        {t('checkinGift.opening')}
                      </Text>
                    </View>
                  )}
                </Pressable>
              ))}
            </View>
          </>
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
          onPress={
            receipt
              ? dismiss
              : () => {
                  skip();
                }
          }
          disabled={readOnly || busy}
          accessibilityRole="button"
          accessibilityState={{ disabled: readOnly || busy }}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: primaryBrand },
            pressed && styles.pressed,
            busy && styles.muted,
          ]}
        >
          <Text style={styles.buttonText}>
            {t(receipt ? 'checkinGift.done' : demo ? 'checkinGift.skip' : 'checkinGift.later')}
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
    width: 56,
    height: 56,
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
  heroPlatform: {
    width: 120,
    height: 14,
    borderRadius: 7,
    marginTop: -8,
    alignSelf: 'center',
  },
  resultHero: {
    width: 144,
    height: 144,
    marginTop: 12,
  },
  title: {
    fontSize: 27,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 20,
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
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#effcf7',
  },
  boxImage: {
    width: '100%',
    height: '100%',
  },
  opening: {
    position: 'absolute',
    inset: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    zIndex: 2,
  },
  openingText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  result: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 12,
  },
  prizeTitle: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700',
    textAlign: 'center',
  },
  prizeDescription: {
    fontSize: 18,
    lineHeight: 27,
    textAlign: 'center',
  },
  saved: {
    fontSize: 18,
    lineHeight: 27,
    textAlign: 'center',
    marginTop: 8,
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
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  pressed: { opacity: 0.82 },
  muted: { opacity: 0.55 },
  notice: { fontSize: 18, lineHeight: 27, padding: 16, borderRadius: 12, marginVertical: 12 },
});
