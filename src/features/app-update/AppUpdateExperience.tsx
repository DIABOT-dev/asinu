import React, { useMemo } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { QueuedModal } from '../../components/QueuedModal';
import { ScaledText as Text } from '../../components/ScaledText';
import { useThemeColors } from '../../hooks/useThemeColors';

type Props = {
  visible: boolean;
  version?: string;
  phase: 'available' | 'starting' | 'pending' | 'downloading' | 'downloaded' | 'installing' | 'error';
  downloadedBytes: number;
  totalBytes: number;
  onClose: () => void;
  onAction: () => void;
  onDismiss: () => void | Promise<void>;
};
const HERO = require('../../../assets/images/app-update/update-hero.jpg');
const DOWNLOAD = require('../../../assets/images/app-update/update-download.jpg');
const APP_ICON = require('../../../assets/icon.png');

export function AppUpdateExperience({ visible, version, phase, downloadedBytes, totalBytes, onClose, onAction, onDismiss }: Props) {
  const { t } = useTranslation('common');
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { isDark } = useThemeColors();
  const surface = isDark ? '#122B2B' : '#F7FCFA';
  const transparentSurface = isDark ? 'rgba(18,43,43,0)' : 'rgba(247,252,250,0)';
  const tablet = width >= 600;
  const styles = useMemo(() => makeStyles(isDark), [isDark]);
  const available = phase === 'available' || phase === 'error';
  const ready = phase === 'downloaded';
  const installing = phase === 'installing';
  const measured = (phase === 'downloading' || ready) && totalBytes > 0 && Number.isFinite(totalBytes) && Number.isFinite(downloadedBytes);
  const percent = ready ? 100 : measured ? Math.round(Math.max(0, Math.min(1, downloadedBytes / totalBytes)) * 100) : null;
  const megabytes = (bytes: number) => (bytes / 1024 / 1024).toFixed(1);
  const stageKey = phase === 'error' ? 'errorTitle' : ready ? 'readyTitle' : installing ? 'installingTitle' : phase === 'downloading' ? 'downloadingTitle' : 'preparingTitle';
  const label = ready ? 'restart' : phase === 'error' ? 'retry' : 'updateNow';

  return (
    <QueuedModal
      visible={visible}
      transparent
      animationType="fade"
      priority={-20}
      interruptible
      onRequestClose={onClose}
      onDismiss={onDismiss}
      statusBarTranslucent
    >
      <View style={[styles.overlay, tablet && { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
        <View accessibilityViewIsModal style={[
          styles.sheet,
          tablet ? { width: Math.min(600, width - 64), maxHeight: Math.min(1020, height - insets.top - insets.bottom - 40), borderRadius: 30 }
            : { width: '100%', height: '100%', paddingTop: insets.top },
        ]}>
          <View style={styles.topBar}>
            <Text style={styles.brand}>{version ? t('appUpdate.versionLabel', { version }) : 'Asinu'}</Text>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={t('close')} hitSlop={8} style={styles.close}>
              <Ionicons name="close" size={26} color={isDark ? '#DCECE8' : '#3D605E'} />
            </Pressable>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {available ? <>
              <View style={styles.intro}>
                <Text accessibilityRole="header" style={styles.title}>{t(phase === 'error' ? 'appUpdate.errorTitle' : 'appUpdate.experienceTitle')}</Text>
                <Text style={styles.subtitle}>{t(phase === 'error' ? 'appUpdate.errorMessage' : 'appUpdate.experienceMessage')}</Text>
              </View>
              <View style={[styles.photo, { height: tablet ? 360 : Math.max(180, Math.min(250, height * 0.23)) }]}>
                <Image source={HERO} style={StyleSheet.absoluteFill} contentFit="cover" accessible={false} />
                <LinearGradient colors={[surface, transparentSurface]} style={styles.photoTop} pointerEvents="none" />
                <LinearGradient colors={[transparentSurface, surface]} style={styles.photoBottom} pointerEvents="none" />
              </View>
              <View style={styles.benefits}>
                {([
                  ['sparkles-outline', 'experience'],
                  ['heart-outline', 'connection'],
                  ['shield-checkmark-outline', 'store'],
                ] as const).map(([icon, key], index) => (
                  <View key={key} style={[styles.benefit, index !== 2 && styles.benefitBorder]}>
                    <Ionicons name={icon} size={29} color={isDark ? '#65DBCB' : '#008F85'} style={styles.benefitIcon} />
                    <View style={styles.benefitCopy}>
                      <Text style={styles.benefitTitle}>{t(`appUpdate.benefits.${key}.title`)}</Text>
                      <Text style={styles.benefitDescription}>{t(`appUpdate.benefits.${key}.message`)}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </> : <>
              <View style={styles.progressIntro}>
                <View style={styles.appIconWrap}>
                  <Image source={APP_ICON} style={styles.appIcon} contentFit="cover" accessible={false} />
                  {(installing || phase === 'starting' || phase === 'pending') && <ActivityIndicator size="large" color="#08B8A2" style={styles.loadingIndicator} />}
                  {ready && <View style={styles.readyCheck}><Ionicons name="checkmark" size={22} color="#F5FFFB" /></View>}
                </View>
                <Text accessibilityRole="header" style={[styles.title, styles.center]}>{t(`appUpdate.${stageKey}`)}</Text>
                <Text style={[styles.subtitle, styles.center]}>{t(ready ? 'appUpdate.readyMessage' : installing ? 'appUpdate.installingMessage' : 'appUpdate.downloadingMessage')}</Text>
                <View
                  accessible
                  accessibilityRole="progressbar"
                  accessibilityLabel={t(`appUpdate.${stageKey}`)}
                  accessibilityValue={percent === null ? { text: t(`appUpdate.${stageKey}`) } : { min: 0, max: 100, now: percent }}
                  style={styles.progressSection}
                >
                  <View style={styles.progressLine}>
                    <View style={styles.track}>
                      {percent !== null ? <LinearGradient colors={['#009780', '#008D94']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.fill, { width: `${percent}%` }]} />
                        : <ActivityIndicator size="small" color="#009F96" />}
                    </View>
                    {percent !== null && <Text style={styles.percent}>{percent}%</Text>}
                  </View>
                  {measured && <Text style={styles.bytes}>{t('appUpdate.downloadSize', { downloaded: megabytes(downloadedBytes), total: megabytes(totalBytes) })}</Text>}
                </View>
              </View>
              <View style={[styles.photo, styles.downloadPhoto, { height: tablet ? 360 : Math.max(240, Math.min(340, height * 0.35)) }]}>
                <Image source={DOWNLOAD} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="center" accessible={false} />
                <LinearGradient colors={[surface, transparentSurface]} style={styles.photoTop} pointerEvents="none" />
                <LinearGradient colors={[transparentSurface, surface]} style={styles.photoBottom} pointerEvents="none" />
              </View>
              <View style={styles.notice}>
                <Ionicons name={installing ? 'shield-checkmark-outline' : 'information-circle-outline'} size={28} color={isDark ? '#66DCCB' : '#008F85'} />
                <View style={styles.benefitCopy}>
                  <Text style={styles.benefitTitle}>{t(installing ? 'appUpdate.installNoticeTitle' : 'appUpdate.downloadNoticeTitle')}</Text>
                  <Text style={styles.benefitDescription}>{t(installing ? 'appUpdate.installNoticeMessage' : 'appUpdate.downloadNoticeMessage')}</Text>
                </View>
              </View>
            </>}
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: tablet ? 16 : Math.max(insets.bottom, 14) }]}>
            {(available || ready) && <Pressable onPress={onAction} accessibilityRole="button" accessibilityLabel={t(`appUpdate.${label}`)} style={({ pressed }) => [styles.action, pressed && { opacity: 0.85 }]}>
              <LinearGradient colors={['#00836F', '#007F87']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.actionFill}>
                <Text style={styles.actionText}>{t(`appUpdate.${label}`)}</Text>
                <Ionicons name={ready ? 'refresh-outline' : 'chevron-forward'} size={24} color="#F5FFFB" />
              </LinearGradient>
            </Pressable>}
            <Pressable onPress={onClose} accessibilityRole="button" style={styles.later}>
              <Text style={styles.laterText}>{t(available || ready ? 'appUpdate.later' : 'appUpdate.continueUsing')}</Text>
            </Pressable>
            {available && <Text style={styles.storeNote}>{t(Platform.OS === 'ios' ? 'appUpdate.iosStoreNote' : 'appUpdate.androidStoreNote')}</Text>}
          </View>
        </View>
      </View>
    </QueuedModal>
  );
}

function makeStyles(dark: boolean) {
  const surface = dark ? '#122B2B' : '#F7FCFA';
  const primary = dark ? '#E3F4EF' : '#103C40';
  const secondary = dark ? '#B4CCC7' : '#586F78';
  return StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(9, 34, 38, 0.56)' },
    sheet: { backgroundColor: surface, overflow: 'hidden', flexShrink: 1 },
    topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 25, paddingRight: 14, minHeight: 52 },
    brand: { color: secondary, fontSize: 13, fontWeight: '600', flexShrink: 1 },
    close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    scroll: { flexShrink: 1 },
    scrollContent: { paddingBottom: 4 },
    intro: { paddingHorizontal: 26, paddingTop: 4, paddingBottom: 10 },
    title: { color: primary, fontSize: 28, fontWeight: '800', letterSpacing: -0.6 },
    subtitle: { color: secondary, fontSize: 15, marginTop: 10 },
    center: { textAlign: 'center' },
    photo: { width: '100%', overflow: 'hidden', backgroundColor: surface },
    photoTop: { position: 'absolute', top: 0, left: 0, right: 0, height: 28 },
    photoBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 45 },
    benefits: { marginHorizontal: 20, paddingHorizontal: 18, borderRadius: 24, backgroundColor: dark ? '#1A3836' : '#FEFFFE' },
    benefit: { flexDirection: 'row', gap: 15, alignItems: 'center', paddingVertical: 14 },
    benefitIcon: { width: 32 },
    benefitCopy: { flex: 1 },
    benefitBorder: { borderBottomWidth: 1, borderBottomColor: dark ? '#2D4B47' : '#E4EFEB' },
    benefitTitle: { color: dark ? '#9EEBDA' : '#117E76', fontSize: 16, fontWeight: '700' },
    benefitDescription: { color: secondary, fontSize: 14, marginTop: 3 },
    footer: { paddingHorizontal: 24, paddingTop: 14, backgroundColor: surface, borderTopWidth: 1, borderTopColor: dark ? '#29443F' : '#EAF3EF' },
    action: { borderRadius: 30, overflow: 'hidden' },
    actionFill: { minHeight: 58, paddingHorizontal: 22, paddingVertical: 13, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12 },
    actionText: { color: '#F5FFFB', fontSize: 18, fontWeight: '700', textAlign: 'center', flexShrink: 1 },
    later: { minHeight: 46, alignItems: 'center', justifyContent: 'center', paddingVertical: 7 },
    laterText: { color: dark ? '#9ACDC2' : '#34756F', fontSize: 15, fontWeight: '600', textAlign: 'center' },
    storeNote: { color: secondary, fontSize: 11, textAlign: 'center', paddingBottom: 2 },
    progressIntro: { alignItems: 'center', paddingHorizontal: 28, paddingTop: 22 },
    appIconWrap: { marginBottom: 28, alignItems: 'center', justifyContent: 'center', width: 112, height: 112 },
    appIcon: { width: 96, height: 96, borderRadius: 24 },
    loadingIndicator: { position: 'absolute', right: -12, bottom: -12 },
    readyCheck: { position: 'absolute', right: -4, bottom: -4, borderRadius: 18, backgroundColor: '#00AA91', padding: 6 },
    progressSection: { width: '100%', marginTop: 26, marginBottom: 14 },
    progressLine: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    track: { height: 12, backgroundColor: dark ? '#294A43' : '#DFECE8', borderRadius: 8, overflow: 'hidden', flex: 1, justifyContent: 'center' },
    fill: { height: '100%', borderRadius: 8 },
    percent: { color: primary, fontSize: 16, fontWeight: '700', minWidth: 43, textAlign: 'right' },
    bytes: { color: secondary, fontSize: 12, marginTop: 8 },
    downloadPhoto: { marginTop: 10 },
    notice: { marginHorizontal: 22, marginBottom: 12, padding: 18, borderRadius: 22, flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: dark ? '#1D423C' : '#E5F5EE' },
  });
}
