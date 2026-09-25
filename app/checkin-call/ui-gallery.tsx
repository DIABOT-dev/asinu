import React, { useMemo, useState, type ReactNode } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

type PreviewId =
  | 'settings'
  | 'incoming-ios'
  | 'incoming-android'
  | 'user-call'
  | 'family-mild'
  | 'family-urgent'
  | 'result'
  | 'error';

type PreviewDefinition = {
  id: PreviewId;
  index: string;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  badge: string;
};

const PREVIEW_META: Array<Omit<PreviewDefinition, 'title' | 'description' | 'badge'> & { titleKey: string; descriptionKey: string; badgeKey: string }> = [
  { id: 'settings', index: '01', titleKey: 'gallery.settingsTitle', descriptionKey: 'gallery.settingsDescription', icon: 'options-outline', badgeKey: 'gallery.badgeApp' },
  { id: 'incoming-ios', index: '02', titleKey: 'gallery.iosTitle', descriptionKey: 'gallery.iosDescription', icon: 'logo-apple', badgeKey: 'gallery.badgeNative' },
  { id: 'incoming-android', index: '03', titleKey: 'gallery.androidTitle', descriptionKey: 'gallery.androidDescription', icon: 'logo-android', badgeKey: 'gallery.badgeNative' },
  { id: 'user-call', index: '04', titleKey: 'gallery.userTitle', descriptionKey: 'gallery.userDescription', icon: 'person-outline', badgeKey: 'gallery.badgeApp' },
  { id: 'family-mild', index: '05', titleKey: 'gallery.mildTitle', descriptionKey: 'gallery.mildDescription', icon: 'people-outline', badgeKey: 'gallery.badgeApp' },
  { id: 'family-urgent', index: '06', titleKey: 'gallery.urgentTitle', descriptionKey: 'gallery.urgentDescription', icon: 'warning-outline', badgeKey: 'gallery.badgeApp' },
  { id: 'result', index: '07', titleKey: 'gallery.resultTitle', descriptionKey: 'gallery.resultDescription', icon: 'checkmark-circle-outline', badgeKey: 'gallery.badgeState' },
  { id: 'error', index: '08', titleKey: 'gallery.errorTitle', descriptionKey: 'gallery.errorDescription', icon: 'alert-circle-outline', badgeKey: 'gallery.badgeState' },
];

const COLORS = {
  canvas: '#f3f8f7',
  surface: '#fbfdfc',
  ink: '#123b36',
  muted: '#64748b',
  line: '#dbe7e4',
  teal: '#087f6d',
  tealSoft: '#dff3ee',
  amber: '#b9750f',
  amberSoft: '#fbefd8',
  red: '#b72f3c',
  redSoft: '#f9e3e6',
};

function TopBar({ title, onBack }: { title: string; onBack: () => void }) {
  const { t } = useTranslation('common');
  return (
    <View style={styles.topBar}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('back')} style={styles.iconButton} onPress={onBack}>
        <Ionicons name="chevron-back" size={24} color={COLORS.ink} />
      </Pressable>
      <Text style={styles.topBarTitle} numberOfLines={1}>{title}</Text>
      <View style={styles.iconButton} />
    </View>
  );
}

function PreviewFrame({ children, note }: { children: ReactNode; note?: string }) {
  const { t } = useTranslation('checkinCall');
  return (
    <View style={styles.previewFrame}>
      <View style={styles.previewNotice}>
        <Ionicons name="color-palette-outline" size={17} color={COLORS.teal} />
        <Text style={styles.previewNoticeText}>{note || t('gallery.previewNotice')}</Text>
      </View>
      {children}
    </View>
  );
}

function ActionButton({ tone, children }: { tone: 'ok' | 'mild' | 'urgent' | 'neutral'; children: ReactNode }) {
  return (
    <View style={[styles.actionButton, styles[`action_${tone}`]]}>
      <Text style={[styles.actionText, tone === 'neutral' && styles.actionTextNeutral]}>{children}</Text>
    </View>
  );
}

function SettingsPreview() {
  const { t } = useTranslation('checkinCall');
  const rows: Array<{
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    value: string;
  }> = [
    { icon: 'call-outline', label: t('checkinTime'), value: '08:00' },
    { icon: 'timer-outline', label: t('fieldGrace'), value: t('gallery.graceValue') },
    { icon: 'time-outline', label: t('fieldUserTimeout'), value: t('gallery.userTimeoutValue') },
    { icon: 'notifications-outline', label: t('fieldFamilyRing'), value: t('gallery.familyRingValue') },
    { icon: 'stopwatch-outline', label: t('fieldFamilyConfirm'), value: t('gallery.familyConfirmValue') },
    { icon: 'warning-outline', label: t('fieldMaxRounds'), value: t('gallery.roundValue') },
  ];
  return (
    <PreviewFrame note={t('gallery.nativePreviewNotice')}>
      <View style={styles.settingsCard}>
        <View style={styles.settingsHeaderBlock}>
          <View style={styles.settingsTitleRow}>
            <Ionicons name="headset-outline" size={24} color="#00897b" />
            <Text style={styles.settingsMainTitle}>{t('title')}</Text>
          </View>
          <Text style={styles.settingsMainSubtitle}>{t('subtitle')}</Text>
        </View>

        <View style={styles.toggleRow}>
          <View style={styles.toggleCopy}>
            <Text style={styles.toggleLabel}>{t('enable')}</Text>
            <Text style={styles.toggleStatus}>{t('active')}</Text>
          </View>
          <Switch value trackColor={{ false: '#cbd5e1', true: '#00897b' }} />
        </View>

        <View style={styles.divider} />

        {rows.map((row) => (
          <View style={styles.settingItemRow} key={row.label}>
            <View style={styles.settingRowLeftGroup}>
              <Ionicons name={row.icon} size={22} color="#00897b" style={styles.settingRowIcon} />
              <Text style={styles.settingItemLabel}>{row.label}</Text>
            </View>
            <View style={styles.pillBadge}>
              <Text style={styles.pillBadgeText}>{row.value}</Text>
            </View>
          </View>
        ))}

        <Pressable style={styles.saveBtn}>
          <Text style={styles.saveBtnText}>{t('saveSettings')}</Text>
        </Pressable>
      </View>
    </PreviewFrame>
  );
}

function IncomingPreview({ platform: _platform }: { platform: 'ios' | 'android' }) {
  const { t } = useTranslation('checkinCall');
  return (
    <PreviewFrame note={t('gallery.nativePreviewNotice')}>
      <View style={styles.incomingWrapper}>
        <Image
          source={require('../../assets/images/asinu-brand-logo.png')}
          style={styles.incomingLogo}
          resizeMode="contain"
        />

        <View style={styles.incomingCard}>
          <Image
            source={require('../../assets/images/checkin-call/doctor_avatar.png')}
            style={styles.doctorAvatarImg}
            resizeMode="contain"
          />
          <View style={styles.incomingPill}>
            <Text style={styles.incomingPillText}>{t('gallery.incoming')}</Text>
          </View>
          <Text style={styles.incomingCardTitle}>{t('userHeading')}</Text>
          <Text style={styles.incomingCardSub}>{t('gallery.dailyCheck')}</Text>
          <View style={styles.dotsRow}>
            <View style={[styles.dot, styles.dotActive]} />
            <View style={[styles.dot, styles.dotActive]} />
            <View style={styles.dot} />
          </View>
        </View>

        <View style={styles.callButtonsRow}>
          <View style={styles.callButtonWrap}>
            <View style={[styles.callCircle, styles.decline]}>
              <Ionicons name="call" size={28} color="#ffffff" style={styles.hangupIcon} />
            </View>
            <Text style={styles.callButtonLabel}>{t('gallery.decline')}</Text>
          </View>
          <View style={styles.callButtonWrap}>
            <View style={[styles.callCircle, styles.accept]}>
              <Ionicons name="call" size={28} color="#ffffff" />
            </View>
            <Text style={styles.callButtonLabel}>{t('gallery.accept')}</Text>
          </View>
        </View>

        <Image
          source={require('../../assets/images/checkin-call/call_bottom_deco.png')}
          style={styles.callBottomDeco}
          resizeMode="cover"
        />
      </View>
    </PreviewFrame>
  );
}

function UserCallPreview() {
  const { t } = useTranslation('checkinCall');
  return (
    <PreviewFrame>
      <View style={styles.callHeaderIcon}><Ionicons name="headset-outline" size={29} color={COLORS.teal} /></View>
      <Text style={styles.screenTitleCentered}>{t('userHeading')}</Text>
      <Text style={styles.callStatus}>{t('gallery.connectedInstruction')}</Text>
      <ActionButton tone="ok">{t('choiceOk')}</ActionButton>
      <ActionButton tone="mild">{t('choiceMild')}</ActionButton>
      <ActionButton tone="urgent">{t('choiceUrgent')}</ActionButton>
      <View style={styles.replayRow}><Ionicons name="volume-high-outline" size={20} color={COLORS.teal} /><Text style={styles.replayText}>{t('replay')}</Text></View>
      <SafetyNote />
    </PreviewFrame>
  );
}

function FamilyPreview({ urgent }: { urgent: boolean }) {
  const { t } = useTranslation('checkinCall');
  return (
    <PreviewFrame note={t('gallery.nativePreviewNotice')}>
      <View style={styles.familyWrapper}>
        {/* Top card */}
        <View style={[styles.familyCard, urgent ? styles.familyCardUrgent : styles.familyCardMild]}>
          <View style={[styles.urgentBadgeCircle, urgent ? styles.urgentBadgeCircleUrgent : styles.urgentBadgeCircleMild]}>
            <Ionicons
              name={urgent ? 'warning-outline' : 'heart-outline'}
              size={36}
              color={urgent ? '#dc2626' : COLORS.amber}
            />
          </View>
          <Text style={[styles.familyCardTitle, urgent ? styles.familyCardTitleUrgent : styles.familyCardTitleMild]}>
            {t(urgent ? 'gallery.urgentFamilyTitle' : 'gallery.mildFamilyTitle')}
          </Text>
          <Text style={styles.familyCardSubtitle}>
            {t(urgent ? 'gallery.urgentFamilyMessage' : 'gallery.mildFamilyMessage')}
          </Text>
        </View>

        {/* 3 Action Buttons */}
        <View style={styles.familyActionsCol}>
          <View style={[styles.familyActionBtn, urgent ? styles.familyActionBtnUrgent : styles.familyActionBtnMild]}>
            <Text style={styles.familyActionTextUrgent}>{t('confirmCheck')}</Text>
          </View>
          <View style={[styles.familyActionBtn, styles.familyActionBtnMint]}>
            <Text style={styles.familyActionTextMint}>{t('confirmOnMyWay')}</Text>
          </View>
          <View style={[styles.familyActionBtn, styles.familyActionBtnMint]}>
            <Text style={styles.familyActionTextMint}>{t('confirmCalled')}</Text>
          </View>
        </View>

        <Text style={styles.familyFootnoteText}>
          {t('gallery.familyConfirmationNote')}
        </Text>

        <Image
          source={require('../../assets/images/checkin-call/call_bottom_deco.png')}
          style={styles.callBottomDeco}
          resizeMode="cover"
        />
      </View>
    </PreviewFrame>
  );
}

function ResultPreview() {
  const { t } = useTranslation('checkinCall');
  return (
    <PreviewFrame note={t('gallery.nativePreviewNotice')}>
      <View style={styles.resultWrapper}>
        {/* Top checkmark with leaves artwork */}
        <Image
          source={require('../../assets/images/checkin-call/checkin_success_art.png')}
          style={styles.resultSuccessArt}
          resizeMode="contain"
        />

        <Text style={styles.resultHeading}>{t('gallery.okResultTitle')}</Text>
        <Text style={styles.resultSub}>{t('gallery.okResultMessage')}</Text>

        {/* Info card */}
        <View style={styles.resultCard}>
          <View style={styles.resultRow}>
            <View style={styles.resultRowLeft}>
              <Ionicons name="person-circle-outline" size={26} color="#00897b" />
              <Text style={styles.resultRowLabel}>{t('gallery.statusLabel')}</Text>
            </View>
            <View style={styles.resultPill}>
              <Text style={styles.resultPillTextResolved}>{t('gallery.resolved')}</Text>
            </View>
          </View>

          <View style={styles.resultDivider} />

          <View style={styles.resultRow}>
            <View style={styles.resultRowLeft}>
              <Ionicons name="time-outline" size={24} color="#00897b" />
              <Text style={styles.resultRowLabel}>{t('gallery.timeLabel')}</Text>
            </View>
            <View style={styles.resultPill}>
              <Text style={styles.resultPillTextTime}>08:14</Text>
            </View>
          </View>
        </View>

        {/* Close Button */}
        <View style={styles.resultCloseBtn}>
          <Text style={styles.resultCloseBtnText}>{t('close', { ns: 'common' })}</Text>
        </View>

        <Image
          source={require('../../assets/images/checkin-call/call_bottom_deco.png')}
          style={styles.callBottomDeco}
          resizeMode="cover"
        />
      </View>
    </PreviewFrame>
  );
}

function ErrorPreview() {
  const { t } = useTranslation('checkinCall');
  return (
    <PreviewFrame>
      <View style={[styles.severityIcon, styles.severityUrgent]}><Ionicons name="time-outline" size={31} color={COLORS.red} /></View>
      <Text style={styles.screenTitleCentered}>{t('gallery.expiredTitle')}</Text>
      <Text style={styles.callStatus}>{t('gallery.expiredMessage')}</Text>
      <ActionButton tone="neutral">{t('back', { ns: 'common' })}</ActionButton>
      <View style={styles.inlineError}>
        <Ionicons name="cloud-offline-outline" size={20} color={COLORS.red} />
        <Text style={styles.inlineErrorText}>{t('gallery.connectionError')}</Text>
      </View>
    </PreviewFrame>
  );
}

function SafetyNote() {
  const { t } = useTranslation('checkinCall');
  return <Text style={styles.safetyNote}>{t('safetyNote')}</Text>;
}

export default function CheckinCallUiGalleryScreen() {
  const router = useRouter();
  const { t } = useTranslation('checkinCall');
  const [selected, setSelected] = useState<PreviewId | null>(null);
  const previews = useMemo<PreviewDefinition[]>(() => PREVIEW_META.map((item) => ({
    id: item.id,
    index: item.index,
    icon: item.icon,
    title: t(item.titleKey),
    description: t(item.descriptionKey),
    badge: t(item.badgeKey),
  })), [t]);
  const definition = useMemo(() => previews.find((item) => item.id === selected), [previews, selected]);

  const preview = useMemo(() => {
    switch (selected) {
      case 'settings': return <SettingsPreview />;
      case 'incoming-ios': return <IncomingPreview platform="ios" />;
      case 'incoming-android': return <IncomingPreview platform="android" />;
      case 'user-call': return <UserCallPreview />;
      case 'family-mild': return <FamilyPreview urgent={false} />;
      case 'family-urgent': return <FamilyPreview urgent />;
      case 'result': return <ResultPreview />;
      case 'error': return <ErrorPreview />;
      default: return null;
    }
  }, [selected]);

  if (selected && definition) {
    return (
      <View style={styles.root}>
        <TopBar title={definition.title} onBack={() => setSelected(null)} />
        <ScrollView contentContainerStyle={styles.previewScroll}>{preview}</ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <TopBar title={t('gallery.title')} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.galleryContent}>
        <Text style={styles.galleryTitle}>{t('gallery.heading')}</Text>
        <Text style={styles.galleryLead}>{t('gallery.lead')}</Text>
        <View style={styles.devBadge}><Ionicons name="construct-outline" size={16} color={COLORS.teal} /><Text style={styles.devBadgeText}>{t('gallery.developmentOnly')}</Text></View>
        <View style={styles.list}>
          {previews.map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityLabel={t('gallery.viewAccessibility', { title: item.title })}
              style={({ pressed }) => [styles.listRow, pressed && styles.listRowPressed]}
              onPress={() => setSelected(item.id)}
            >
              <Text style={styles.listIndex}>{item.index}</Text>
              <View style={styles.listIcon}><Ionicons name={item.icon} size={22} color={COLORS.teal} /></View>
              <View style={styles.listCopy}>
                <View style={styles.listTitleRow}><Text style={styles.listTitle}>{item.title}</Text><Text style={styles.listBadge}>{item.badge}</Text></View>
                <Text style={styles.listDescription}>{item.description}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#8aa19d" />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.canvas },
  topBar: { minHeight: 96, paddingTop: 46, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.line, backgroundColor: COLORS.surface },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  topBarTitle: { flex: 1, textAlign: 'center', color: COLORS.ink, fontSize: 17, fontWeight: '700' },
  galleryContent: { padding: 20, paddingBottom: 48 },
  galleryTitle: { color: COLORS.ink, fontSize: 30, lineHeight: 36, fontWeight: '800', marginTop: 8 },
  galleryLead: { color: COLORS.muted, fontSize: 15, lineHeight: 23, marginTop: 8, maxWidth: 560 },
  devBadge: { alignSelf: 'flex-start', marginTop: 18, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: COLORS.tealSoft, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  devBadgeText: { color: COLORS.teal, fontWeight: '700', fontSize: 12 },
  list: { marginTop: 24, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.line },
  listRow: { minHeight: 86, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.line, paddingVertical: 12 },
  listRowPressed: { backgroundColor: '#e9f3f0' },
  listIndex: { width: 24, color: '#78908c', fontSize: 12, fontWeight: '700' },
  listIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.tealSoft },
  listCopy: { flex: 1, gap: 4 },
  listTitleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  listTitle: { color: COLORS.ink, fontSize: 16, fontWeight: '700', flexShrink: 1 },
  listBadge: { color: COLORS.teal, backgroundColor: COLORS.tealSoft, fontSize: 10, fontWeight: '800', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  listDescription: { color: COLORS.muted, fontSize: 13, lineHeight: 18 },
  previewScroll: { flexGrow: 1, padding: 18, paddingBottom: 48 },
  previewFrame: { flex: 1, maxWidth: 620, width: '100%', alignSelf: 'center', backgroundColor: COLORS.surface, borderRadius: 22, borderWidth: 1, borderColor: COLORS.line, padding: 22, gap: 14 },
  previewNotice: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.tealSoft, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  previewNoticeText: { color: COLORS.teal, fontSize: 12, lineHeight: 17, fontWeight: '600', flex: 1 },
  screenTitle: { color: COLORS.ink, fontSize: 27, lineHeight: 34, fontWeight: '800', marginTop: 6 },
  screenTitleCentered: { color: COLORS.ink, fontSize: 25, lineHeight: 32, fontWeight: '800', textAlign: 'center' },
  screenLead: { color: COLORS.muted, fontSize: 14, lineHeight: 21, marginBottom: 4 },
  settingRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.line },
  settingCopy: { flex: 1, gap: 3 },
  settingLabel: { color: COLORS.ink, fontSize: 15, fontWeight: '600', flex: 1 },
  settingHint: { color: COLORS.teal, fontSize: 12, fontWeight: '600' },
  valuePill: { backgroundColor: '#edf3f1', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  valueText: { color: COLORS.ink, fontSize: 14, fontWeight: '700' },
  actionButton: { minHeight: 64, borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, paddingVertical: 13 },
  action_ok: { backgroundColor: COLORS.teal },
  action_mild: { backgroundColor: COLORS.amber },
  action_urgent: { backgroundColor: COLORS.red },
  action_neutral: { backgroundColor: '#e8efed', borderWidth: 1, borderColor: '#d2dfdc' },
  actionText: { color: '#f7fffc', fontSize: 18, lineHeight: 23, fontWeight: '800', textAlign: 'center' },
  actionTextNeutral: { color: COLORS.ink },
  incoming: { minHeight: 620, borderRadius: 24, alignItems: 'center', paddingHorizontal: 24, paddingTop: 62, paddingBottom: 34 },
  incomingIos: { backgroundColor: '#15201e' },
  incomingAndroid: { backgroundColor: '#eaf2f0', borderWidth: 1, borderColor: '#cfdedb' },
  incomingEyebrow: { color: COLORS.muted, fontSize: 12, letterSpacing: 1.5, fontWeight: '800' },
  incomingTextLight: { color: '#f2faf7' },
  incomingTextMuted: { color: '#b8c8c4' },
  callAvatar: { width: 78, height: 78, borderRadius: 39, alignItems: 'center', justifyContent: 'center', backgroundColor: '#d6ebe5', marginTop: 34 },
  callAvatarDark: { backgroundColor: '#29443e' },
  incomingTitle: { color: COLORS.ink, fontSize: 25, lineHeight: 32, fontWeight: '700', textAlign: 'center', marginTop: 24 },
  incomingSubtitle: { color: COLORS.muted, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 6 },
  callActions: { width: '100%', flexDirection: 'row', justifyContent: 'space-around', marginTop: 'auto' },
  callActionItem: { alignItems: 'center', gap: 10 },
  callCircle: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center' },
  decline: { backgroundColor: '#c84049' },
  accept: { backgroundColor: '#168a64' },
  hangupIcon: { transform: [{ rotate: '135deg' }] },
  callActionLabel: { color: COLORS.ink, fontSize: 13, fontWeight: '600' },
  callHeaderIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', backgroundColor: COLORS.tealSoft, marginTop: 14 },
  callStatus: { color: COLORS.muted, fontSize: 15, lineHeight: 23, textAlign: 'center', marginBottom: 6 },
  replayRow: { minHeight: 48, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  replayText: { color: COLORS.teal, fontSize: 15, fontWeight: '700' },
  safetyNote: { color: COLORS.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 8 },
  severityIcon: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginTop: 12 },
  severityMild: { backgroundColor: COLORS.amberSoft },
  severityUrgent: { backgroundColor: COLORS.redSoft },
  severityMessage: { borderRadius: 14, padding: 14, borderWidth: 1 },
  severityMessageMild: { backgroundColor: '#fff8eb', borderColor: '#ecd6aa' },
  severityMessageUrgent: { backgroundColor: '#fff0f2', borderColor: '#edc2c8' },
  severityMessageText: { color: COLORS.ink, fontSize: 14, lineHeight: 21, fontWeight: '600', textAlign: 'center' },
  familyFootnote: { color: COLORS.muted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  resultIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', backgroundColor: COLORS.teal, marginTop: 18 },
  resultSummary: { minHeight: 70, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: COLORS.line, paddingVertical: 12 },
  resultLabel: { color: COLORS.muted, fontSize: 12 },
  resultValue: { color: COLORS.teal, fontSize: 16, fontWeight: '700', marginTop: 3 },
  resultTime: { color: COLORS.ink, fontSize: 15, fontWeight: '700' },
  inlineError: { flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 12, backgroundColor: COLORS.redSoft, padding: 12 },
  inlineErrorText: { flex: 1, color: COLORS.red, fontSize: 13, lineHeight: 18, fontWeight: '600' },

  // Screen 2 - Incoming
  incomingWrapper: {
    minHeight: 560,
    backgroundColor: '#eff8f5',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 24,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  incomingLogo: {
    width: 130,
    height: 38,
    marginBottom: 18,
  },
  incomingCard: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#d1fae5',
    paddingVertical: 22,
    paddingHorizontal: 18,
    alignItems: 'center',
    shadowColor: '#059669',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    zIndex: 2,
  },
  doctorAvatarImg: {
    width: 104,
    height: 98,
    marginBottom: 12,
  },
  incomingPill: {
    backgroundColor: '#d1fae5',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 5,
    marginBottom: 10,
  },
  incomingPillText: {
    color: '#0f766e',
    fontWeight: '700',
    fontSize: 13,
  },
  incomingCardTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#0f3e36',
    textAlign: 'center',
    marginBottom: 4,
  },
  incomingCardSub: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 14,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#cbd5e1',
  },
  dotActive: {
    backgroundColor: '#059669',
  },
  callButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 24,
    zIndex: 2,
  },
  callButtonWrap: {
    alignItems: 'center',
    gap: 8,
  },
  callButtonLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f3e36',
  },
  callBottomDeco: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    width: '100%',
    height: 110,
    opacity: 0.85,
  },

  // Screen 3 - Settings
  settingsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 18,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  settingsHeaderBlock: {
    gap: 4,
  },
  settingsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  settingsMainTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f3e36',
  },
  settingsMainSubtitle: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  toggleCopy: {
    flex: 1,
    gap: 2,
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f3e36',
  },
  toggleStatus: {
    fontSize: 13,
    color: '#00897b',
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 4,
  },
  settingItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  settingRowLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    paddingRight: 8,
  },
  settingRowIcon: {
    width: 24,
    textAlign: 'center',
  },
  settingItemLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#475569',
    flex: 1,
  },
  pillBadge: {
    backgroundColor: '#f0fdf9',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  pillBadgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f3e36',
  },
  saveBtn: {
    backgroundColor: '#00897b',
    borderRadius: 20,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 14,
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },

  // Screen 4 - Family Urgent Call
  familyWrapper: {
    minHeight: 560,
    backgroundColor: '#eff8f5',
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 28,
    paddingBottom: 30,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  familyCard: {
    width: '100%',
    borderRadius: 24,
    borderWidth: 1,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginBottom: 20,
    zIndex: 2,
  },
  familyCardUrgent: {
    backgroundColor: '#fff5f5',
    borderColor: '#ffe4e6',
  },
  familyCardMild: {
    backgroundColor: '#fffdf0',
    borderColor: '#fef08a',
  },
  urgentBadgeCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 5,
  },
  urgentBadgeCircleUrgent: {
    backgroundColor: '#fee2e2',
    borderColor: '#fff1f2',
  },
  urgentBadgeCircleMild: {
    backgroundColor: '#fef3c7',
    borderColor: '#fefce8',
  },
  familyCardTitle: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  familyCardTitleUrgent: {
    color: '#dc2626',
  },
  familyCardTitleMild: {
    color: COLORS.amber,
  },
  familyCardSubtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
  },
  familyActionsCol: {
    width: '100%',
    gap: 12,
    zIndex: 2,
  },
  familyActionBtn: {
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  familyActionBtnUrgent: {
    backgroundColor: '#c83244',
  },
  familyActionBtnMild: {
    backgroundColor: COLORS.amber,
  },
  familyActionBtnMint: {
    backgroundColor: '#e6f5f1',
  },
  familyActionTextUrgent: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  familyActionTextMint: {
    color: '#0d6857',
    fontSize: 16,
    fontWeight: '700',
  },
  familyFootnoteText: {
    color: '#64748b',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'left',
    alignSelf: 'flex-start',
    marginTop: 16,
    paddingHorizontal: 4,
    zIndex: 2,
  },

  // Screen 5 - Result
  resultWrapper: {
    minHeight: 560,
    backgroundColor: '#eff8f5',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 30,
    paddingBottom: 30,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  resultSuccessArt: {
    width: 130,
    height: 100,
    marginBottom: 8,
    zIndex: 2,
  },
  resultHeading: {
    fontSize: 21,
    fontWeight: '800',
    color: '#0f3e36',
    textAlign: 'center',
    marginTop: 8,
    zIndex: 2,
  },
  resultSub: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 21,
    marginTop: 8,
    paddingHorizontal: 12,
    zIndex: 2,
  },
  resultCard: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2f2ec',
    paddingHorizontal: 18,
    paddingVertical: 14,
    marginTop: 22,
    zIndex: 2,
    shadowColor: '#059669',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  resultRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  resultRowLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f3e36',
  },
  resultPill: {
    backgroundColor: '#e6f7f2',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  resultPillTextResolved: {
    color: '#00897b',
    fontWeight: '700',
    fontSize: 13,
  },
  resultPillTextTime: {
    color: '#0f3e36',
    fontWeight: '700',
    fontSize: 14,
  },
  resultDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 6,
  },
  resultCloseBtn: {
    width: '100%',
    backgroundColor: '#00897b',
    borderRadius: 18,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
    zIndex: 2,
  },
  resultCloseBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
