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
const boxes = [0, 1, 2, 3, 4, 5] as const;

export type CheckinGiftReceipt = {
  id: string;
  title: string;
  description?: string | null;
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
};

/** The caller owns eligibility and the prize; the boxes choose a visual slot. */
export function CheckinGiftModal({
  visible,
  onClose,
  onSkip,
  onOpen,
  onReceived,
  readOnly = false,
  demo = false,
  initialReceipt = null,
}: Props) {
  const { t } = useTranslation('home');
  const { colors, isDark } = useThemeColors();
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const [selected, setSelected] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<CheckinGiftReceipt | null>(null);
  const [error, setError] = useState(false);
  const requestActive = useRef(false);

  useEffect(() => {
    if (!visible) {return;}
    setSelected(null);
    setBusy(false);
    setReceipt(initialReceipt);
    setError(false);
    requestActive.current = false;
  }, [visible, initialReceipt]);

  const openBox = async (box: number) => {
    if (readOnly || requestActive.current || receipt) {return;}
    requestActive.current = true;
    setBusy(true);
    setError(false);
    setSelected(box);
    try {
      const received = await onOpen(box);
      setReceipt(received);
      onReceived?.(received);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
      requestActive.current = false;
    }
  };

  const skip = async () => {
    if (readOnly || requestActive.current) {return;}
    requestActive.current = true;
    setBusy(true);
    setError(false);
    try {
      await onSkip();
      onClose();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
      requestActive.current = false;
    }
  };

  const dismiss = () => {
    if (!readOnly && !requestActive.current) {onClose();}
  };

  const ink = isDark ? colors.textPrimary : '#0f3a42';
  const subInk = isDark ? colors.textSecondary : '#5b7a82';
  const boxColor = isDark ? colors.primaryLight : '#f1fbf7';
  const boxBorder = isDark ? colors.primaryDark : '#bfeee1';
  const sparkleColor = isDark ? colors.primary : '#1eb596';
  const handleColor = isDark ? colors.border : '#c4e8de';
  const closeColor = isDark ? colors.primaryText : '#1eb596';
  const platformColor = isDark ? '#143630' : '#daf5ed';
  const heartFloatColor = isDark ? '#2e6b60' : '#a2e4d5';
  const overlayColor = isDark ? 'rgba(5, 25, 21, 0.92)' : 'rgba(12, 78, 68, 0.88)';
  const primaryBrand = isDark ? colors.primary : '#1eb596';

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
              <View style={[styles.floatDash, styles.floatDashLeft1, { backgroundColor: sparkleColor }]} />
              <View style={[styles.floatDash, styles.floatDashLeft2, { backgroundColor: sparkleColor }]} />

              {/* Right floating heart and dot */}
              <View style={styles.floatHeartRight}>
                <Ionicons name="heart" size={15} color={heartFloatColor} />
              </View>
              <View style={[styles.floatDot, styles.floatDotRight, { backgroundColor: sparkleColor }]} />
            </View>
          )}

          <Image
            source={giftImage}
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
        {demo && <Text style={[styles.demoLabel, { color: colors.primaryText }]}>
          {t('checkinGift.demoLabel')}
        </Text>}

        {receipt ? (
          <View style={styles.result} accessibilityLiveRegion="polite">
            <Text style={[styles.prizeTitle, { color: colors.primaryText }]}>
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
                      backgroundColor: boxColor,
                      borderColor:
                        selected === box ? primaryBrand : boxBorder,
                    },
                    pressed && styles.pressed,
                    busy && selected !== box && styles.muted,
                  ]}
                >
                  {/* Decorative corner dashes matching reference */}
                  <View style={[styles.boxSparkle, styles.boxSparkleTL, { backgroundColor: sparkleColor }]} />
                  <View style={[styles.boxSparkle, styles.boxSparkleBL, { backgroundColor: sparkleColor }]} />
                  <View style={[styles.boxSparkle, styles.boxSparkleTR, { backgroundColor: sparkleColor }]} />
                  <View style={[styles.boxSparkle, styles.boxSparkleBR, { backgroundColor: sparkleColor }]} />

                  <Image
                    source={giftImage}
                    style={styles.boxImage}
                    contentFit="contain"
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

            {/* Note row with circle icon and vertical divider */}
            <View style={styles.note}>
              <View style={[styles.noteIconBadge, { backgroundColor: primaryBrand }]}>
                <Ionicons
                  name="information"
                  size={15}
                  color="#ffffff"
                />
              </View>
              <View style={[styles.noteDivider, { backgroundColor: isDark ? colors.border : '#d2ede4' }]} />
              <Text style={[styles.noteText, { color: subInk }]}>
                {t(demo ? 'checkinGift.demoDailyLimit' : 'checkinGift.dailyLimit')}
              </Text>
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
            {t(receipt ? 'checkinGift.done' : 'checkinGift.skip')}
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
    paddingHorizontal: 20,
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
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 20,
  },
  demoLabel: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  box: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  boxSparkle: {
    position: 'absolute',
    width: 5.5,
    height: 2,
    borderRadius: 1,
  },
  boxSparkleTL: {
    left: 7,
    top: '32%',
    transform: [{ rotate: '-30deg' }],
  },
  boxSparkleBL: {
    left: 7,
    bottom: '32%',
    transform: [{ rotate: '30deg' }],
  },
  boxSparkleTR: {
    right: 7,
    top: '32%',
    transform: [{ rotate: '30deg' }],
  },
  boxSparkleBR: {
    right: 7,
    bottom: '32%',
    transform: [{ rotate: '-30deg' }],
  },
  boxImage: {
    width: '68%',
    height: '68%',
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
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18,
    paddingHorizontal: 4,
  },
  noteIconBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteDivider: {
    width: 1.5,
    height: 28,
    marginHorizontal: 12,
  },
  noteText: {
    fontSize: 13.5,
    lineHeight: 19,
    flex: 1,
    fontWeight: '400',
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
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  saved: {
    fontSize: 14,
    lineHeight: 21,
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
    minHeight: 52,
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
