import React, { useMemo, useState, type ReactNode } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScaledText as Text } from '../../src/components/ScaledText';

type PreviewId =
  | 'settings'
  | 'incoming-ios'
  | 'incoming-android'
  | 'incoming-user-app'
  | 'incoming-family-app'
  | 'user-call'
  | 'triage-location'
  | 'triage-symptom'
  | 'triage-intensity'
  | 'family-unknown'
  | 'family-mild'
  | 'family-urgent'
  | 'result-user-ok'
  | 'result-user-mild'
  | 'result-user-urgent'
  | 'result-family-confirmed'
  | 'result-family-unavailable'
  | 'call-expired'
  | 'connection-states';

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
  { id: 'incoming-user-app', index: '04', titleKey: 'gallery.inAppUserTitle', descriptionKey: 'gallery.inAppUserDescription', icon: 'person-outline', badgeKey: 'gallery.badgeApp' },
  { id: 'incoming-family-app', index: '05', titleKey: 'gallery.inAppFamilyTitle', descriptionKey: 'gallery.inAppFamilyDescription', icon: 'people-outline', badgeKey: 'gallery.badgeApp' },
  { id: 'user-call', index: '06', titleKey: 'gallery.userTitle', descriptionKey: 'gallery.userDescription', icon: 'keypad-outline', badgeKey: 'gallery.badgeApp' },
  { id: 'triage-location', index: '07', titleKey: 'gallery.triageLocationTitle', descriptionKey: 'gallery.triageLocationDescription', icon: 'body-outline', badgeKey: 'gallery.badgeApp' },
  { id: 'triage-symptom', index: '08', titleKey: 'gallery.triageSymptomTitle', descriptionKey: 'gallery.triageSymptomDescription', icon: 'pulse-outline', badgeKey: 'gallery.badgeApp' },
  { id: 'triage-intensity', index: '09', titleKey: 'gallery.triageIntensityTitle', descriptionKey: 'gallery.triageIntensityDescription', icon: 'speedometer-outline', badgeKey: 'gallery.badgeApp' },
  { id: 'family-unknown', index: '10', titleKey: 'gallery.unknownTitle', descriptionKey: 'gallery.unknownDescription', icon: 'help-circle-outline', badgeKey: 'gallery.badgeApp' },
  { id: 'family-mild', index: '11', titleKey: 'gallery.mildTitle', descriptionKey: 'gallery.mildDescription', icon: 'heart-outline', badgeKey: 'gallery.badgeApp' },
  { id: 'family-urgent', index: '12', titleKey: 'gallery.urgentTitle', descriptionKey: 'gallery.urgentDescription', icon: 'warning-outline', badgeKey: 'gallery.badgeApp' },
  { id: 'result-user-ok', index: '13', titleKey: 'gallery.resultOkTitle', descriptionKey: 'gallery.resultOkDescription', icon: 'checkmark-circle-outline', badgeKey: 'gallery.badgeState' },
  { id: 'result-user-mild', index: '14', titleKey: 'gallery.resultMildTitle', descriptionKey: 'gallery.resultMildDescription', icon: 'heart-circle-outline', badgeKey: 'gallery.badgeState' },
  { id: 'result-user-urgent', index: '15', titleKey: 'gallery.resultUrgentTitle', descriptionKey: 'gallery.resultUrgentDescription', icon: 'alert-circle-outline', badgeKey: 'gallery.badgeState' },
  { id: 'result-family-confirmed', index: '16', titleKey: 'gallery.resultFamilyConfirmedTitle', descriptionKey: 'gallery.resultFamilyConfirmedDescription', icon: 'shield-checkmark-outline', badgeKey: 'gallery.badgeState' },
  { id: 'result-family-unavailable', index: '17', titleKey: 'gallery.resultFamilyUnavailableTitle', descriptionKey: 'gallery.resultFamilyUnavailableDescription', icon: 'people-circle-outline', badgeKey: 'gallery.badgeState' },
  { id: 'call-expired', index: '18', titleKey: 'gallery.expiredPreviewTitle', descriptionKey: 'gallery.expiredPreviewDescription', icon: 'time-outline', badgeKey: 'gallery.badgeState' },
  { id: 'connection-states', index: '19', titleKey: 'gallery.connectionStatesTitle', descriptionKey: 'gallery.connectionStatesDescription', icon: 'cloud-offline-outline', badgeKey: 'gallery.badgeState' },
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
  const { t: tc } = useTranslation('common');
  return (
    <View style={styles.topBar}>
      <Pressable accessibilityRole="button" accessibilityLabel={tc('back')} style={styles.iconButton} onPress={onBack}>
        <Ionicons name="chevron-back" size={24} color="#0f3e36" />
      </Pressable>
      <Text style={styles.topBarTitle} numberOfLines={1}>{title}</Text>
      <View style={{ width: 40 }} />
      <View style={styles.headerCrossArt} pointerEvents="none">
        <MaterialCommunityIcons name="plus" size={54} color="#dcf2eb" />
      </View>
    </View>
  );
}

function PreviewFrame({ children, note }: { children: ReactNode; note?: string }) {
  const { t } = useTranslation('checkinCall');
  return (
    <View style={styles.previewFrame}>
      <View style={styles.previewNotice}>
        <Ionicons name="information-circle" size={19} color="#00897b" />
        <Text style={styles.previewNoticeText}>{note || t('gallery.previewNotice')}</Text>
      </View>
      {children}
    </View>
  );
}

function ActionButton({
  tone,
  indexNumber,
  icon,
  children,
}: {
  tone: 'ok' | 'mild' | 'urgent' | 'neutral';
  indexNumber?: string | number;
  icon?: ReactNode;
  children: ReactNode;
}) {
  const toneStyle = {
    ok: {
      bg: '#eefaf5',
      border: '#cceee2',
      textColor: '#064e3b',
      iconColor: '#059669',
      defaultIcon: <Ionicons name="happy-outline" size={28} color="#059669" />,
    },
    mild: {
      bg: '#fff7ed',
      border: '#fed7aa',
      textColor: '#9a3412',
      iconColor: '#ea580c',
      defaultIcon: <MaterialCommunityIcons name="emoticon-neutral-outline" size={28} color="#ea580c" />,
    },
    urgent: {
      bg: '#fef2f2',
      border: '#fecaca',
      textColor: '#991b1b',
      iconColor: '#dc2626',
      defaultIcon: <MaterialCommunityIcons name="plus-circle-outline" size={28} color="#dc2626" />,
    },
    neutral: {
      bg: '#f8fafc',
      border: '#e2e8f0',
      textColor: '#0f172a',
      iconColor: '#00897b',
      defaultIcon: null,
    },
  }[tone];

  const renderedIcon = icon !== undefined ? icon : toneStyle.defaultIcon;

  return (
    <View
      style={[
        styles.actionButton,
        {
          backgroundColor: toneStyle.bg,
          borderColor: toneStyle.border,
          borderWidth: 1.5,
        },
      ]}
    >
      {renderedIcon ? (
        <View style={styles.actionIconDirect}>{renderedIcon}</View>
      ) : null}
      <Text style={[styles.actionText, { color: toneStyle.textColor, flex: 1, textAlign: 'left' }]}>
        {typeof children === 'string' && indexNumber && !children.startsWith(String(indexNumber))
          ? `${indexNumber} · ${children}`
          : children}
      </Text>
      <Ionicons name="chevron-forward" size={20} color={toneStyle.iconColor} />
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
          <Switch disabled value trackColor={{ false: '#cbd5e1', true: '#00897b' }} />
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

        <View style={styles.saveBtn}>
          <Text style={styles.saveBtnText}>{t('saveSettings')}</Text>
        </View>
      </View>
    </PreviewFrame>
  );
}

function NativeIncomingPreview({ platform }: { platform: 'ios' | 'android' }) {
  const { t } = useTranslation('checkinCall');
  const ios = platform === 'ios';
  return (
    <PreviewFrame note={t('gallery.nativePreviewNotice')}>
      <View style={[styles.incoming, ios ? styles.incomingIos : styles.incomingAndroid]}>
        <Text style={[styles.incomingEyebrow, ios && styles.incomingTextMuted]}>
          {t(ios ? 'gallery.iosSystemLabel' : 'gallery.androidSystemLabel')}
        </Text>
        <View style={styles.callAvatar}>
          <Ionicons name={ios ? 'logo-apple' : 'call-outline'} size={34} color={ios ? '#dce9e5' : COLORS.teal} />
        </View>
        <Text style={[styles.incomingTitle, ios && styles.incomingTextLight]}>{t('userHeading')}</Text>
        <Text style={[styles.incomingSubtitle, ios && styles.incomingTextMuted]}>{t('gallery.dailyCheck')}</Text>
        <View style={styles.callActions}>
          <View style={styles.callActionItem}>
            <View style={[styles.callCircle, styles.decline]}>
              <Ionicons name="call" size={28} color="#f7fffc" style={styles.hangupIcon} />
            </View>
            <Text style={[styles.callActionLabel, ios && styles.incomingTextLight]}>{t('gallery.decline')}</Text>
          </View>
          <View style={styles.callActionItem}>
            <View style={[styles.callCircle, styles.accept]}>
              <Ionicons name="call" size={28} color="#f7fffc" />
            </View>
            <Text style={[styles.callActionLabel, ios && styles.incomingTextLight]}>{t('gallery.accept')}</Text>
          </View>
        </View>
      </View>
    </PreviewFrame>
  );
}

function InAppIncomingPreview({ role }: { role: 'USER' | 'FAMILY' }) {
  const { t } = useTranslation('checkinCall');
  return (
    <PreviewFrame>
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
          <Text style={styles.incomingCardTitle}>{t(role === 'FAMILY' ? 'familyHeading' : 'userHeading')}</Text>
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
      <View style={styles.userCallCard}>
        <Image
          source={require('../../assets/images/checkin-call/checkin_call_hero_art.png')}
          style={styles.userCallHeroArt}
          resizeMode="contain"
        />
        <Text style={styles.userCallMainTitle}>{t('userHeading')}</Text>
        <Text style={styles.userCallSub}>{t('gallery.connectedInstruction')}</Text>

        <View style={styles.userOptionsList}>
          <ActionButton tone="ok" indexNumber="1">
            {t('choiceOk')}
          </ActionButton>
          <ActionButton tone="mild" indexNumber="2">
            {t('choiceMild')}
          </ActionButton>
          <ActionButton tone="urgent" indexNumber="3">
            {t('choiceUrgent')}
          </ActionButton>
        </View>

        <View style={styles.replayPill}>
          <Ionicons name="volume-high" size={20} color="#0284c7" />
          <Text style={styles.replayPillText}>{t('replay')}</Text>
        </View>

        <SafetyNote />
      </View>
    </PreviewFrame>
  );
}

function TriagePreview({ step }: { step: 'location' | 'symptom' | 'intensity' }) {
  const { t } = useTranslation('checkinCall');
  const stepNumber = step === 'location' ? 1 : step === 'symptom' ? 2 : 3;
  return (
    <PreviewFrame>
      <View style={styles.callHeaderIcon}><Ionicons name="pulse-outline" size={29} color={COLORS.teal} /></View>
      <Text style={styles.screenTitleCentered}>{t(`triage.${step}Title`)}</Text>
      <Text style={styles.callStatus}>{t(`triage.${step}Instruction`)}</Text>
      <Text style={styles.triageProgressPreview}>{t('triage.progress', { current: stepNumber })}</Text>
      {step === 'location' && (
        <>
          <View style={styles.previewContextNote}>
            <Ionicons name="time-outline" size={17} color={COLORS.teal} />
            <Text style={styles.previewContextNoteText}>{t('triage.recentContext')}</Text>
          </View>
          <ActionButton tone="neutral">{t('gallery.triageHeadExample')}</ActionButton>
          <ActionButton tone="neutral">{t('gallery.triageChestExample')}</ActionButton>
          <ActionButton tone="neutral">{t('gallery.triageWholeBodyExample')}</ActionButton>
        </>
      )}
      {step === 'symptom' && (
        <>
          <View style={styles.previewSelectionSummary}>
            <Text style={styles.previewSelectionLabel}>{t('triage.selected')}</Text>
            <Text style={styles.previewSelectionValue}>{t('gallery.selectedLocationExample')}</Text>
          </View>
          <ActionButton tone="neutral">{t('gallery.symptomDizzinessExample')}</ActionButton>
          <ActionButton tone="neutral">{t('gallery.symptomHeadacheExample')}</ActionButton>
          <ActionButton tone="urgent">{t('gallery.symptomFaintingExample')}</ActionButton>
        </>
      )}
      {step === 'intensity' && (
        <>
          <View style={styles.previewSelectionSummary}>
            <Text style={styles.previewSelectionLabel}>{t('triage.selected')}</Text>
            <Text style={styles.previewSelectionValue}>{t('gallery.selectedSymptomExample')}</Text>
          </View>
          <ActionButton tone="mild">{t('triage.intensityMild')}</ActionButton>
          <ActionButton tone="mild">{t('triage.intensityModerate')}</ActionButton>
          <ActionButton tone="urgent">{t('triage.intensityUrgent')}</ActionButton>
        </>
      )}
      <Text style={styles.triageGuaranteePreview}>{t('triageGuarantee')}</Text>
      <View style={styles.replayRow}><Ionicons name="volume-high-outline" size={20} color={COLORS.teal} /><Text style={styles.replayText}>{t('replay')}</Text></View>
      <SafetyNote />
    </PreviewFrame>
  );
}

function FamilyPreview({ severity }: { severity: 'UNKNOWN' | 'MILD' | 'URGENT' }) {
  const { t } = useTranslation('checkinCall');
  const urgent = severity === 'URGENT';
  const unknown = severity === 'UNKNOWN';
  const titleKey = urgent
    ? 'gallery.urgentFamilyTitle'
    : unknown
      ? 'gallery.unknownFamilyTitle'
      : 'gallery.mildFamilyTitle';
  const messageKey = urgent
    ? 'gallery.urgentFamilyMessage'
    : unknown
      ? 'gallery.unknownFamilyMessage'
      : 'gallery.mildFamilyMessage';
  return (
    <PreviewFrame>
      <View style={styles.familyWrapper}>
        {/* Top card */}
        <View style={[styles.familyCard, urgent ? styles.familyCardUrgent : unknown ? styles.familyCardUnknown : styles.familyCardMild]}>
          <View style={styles.urgentBadgeCircle}>
            <Ionicons
              name={urgent ? 'warning-outline' : unknown ? 'help-outline' : 'heart-outline'}
              size={36}
              color={urgent ? '#dc2626' : unknown ? COLORS.teal : COLORS.amber}
            />
          </View>
          <Text style={[styles.familyCardTitle, urgent ? styles.familyCardTitleUrgent : unknown ? styles.familyCardTitleUnknown : styles.familyCardTitleMild]}>
            {t(titleKey)}
          </Text>
          <Text style={styles.familyCardSubtitle}>
            {t(messageKey)}
          </Text>
          <View style={styles.galleryReportedIssueBox}>
            <Text style={styles.galleryReportedIssueLabel}>{t('reportedIssue')}</Text>
            <Text style={styles.galleryReportedIssueValue}>
              {t(urgent ? 'issue.URGENT_RED_FLAG' : unknown ? 'issue.UNKNOWN' : 'issue.MILD_FATIGUE')}
            </Text>
          </View>
        </View>

        {/* One confirmation action, matching the live family call screen. */}
        <View style={styles.familyActionsCol}>
          <View style={[styles.familyActionBtn, urgent ? styles.familyActionBtnUrgent : unknown ? styles.familyActionBtnUnknown : styles.familyActionBtnMild]}>
            <Text style={styles.familyActionTextUrgent}>{t('confirmCheck')}</Text>
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

function ResultPreview({ kind }: { kind: 'USER_OK' | 'USER_MILD' | 'USER_URGENT' | 'FAMILY_CONFIRMED' | 'FAMILY_UNAVAILABLE' }) {
  const { t } = useTranslation('checkinCall');
  const content = {
    USER_OK: {
      title: t('result.userOkTitle'),
      message: t('result.userOkMessage'),
      state: t('result.resolved'),
      success: true,
    },
    USER_MILD: {
      title: t('result.mildTitle'),
      message: t('result.mildMessage'),
      state: t('result.notified'),
      success: true,
    },
    USER_URGENT: {
      title: t('result.urgentTitle'),
      message: t('result.urgentMessage'),
      state: t('result.escalating'),
      success: false,
    },
    FAMILY_CONFIRMED: {
      title: t('result.familyConfirmedTitle'),
      message: t('result.familyConfirmedMessage'),
      state: t('result.accepted'),
      success: true,
    },
    FAMILY_UNAVAILABLE: {
      title: t('result.familyUnavailableTitle'),
      message: t('result.familyUnavailableMessage'),
      state: t('result.needsAttention'),
      success: false,
    },
  }[kind];
  return (
    <PreviewFrame>
      <View style={styles.resultWrapper}>
        {content.success ? (
          <Image
            source={require('../../assets/images/checkin-call/checkin_success_art.png')}
            style={styles.resultSuccessArt}
            resizeMode="contain"
          />
        ) : (
          <View style={styles.resultWarningIcon}>
            <Ionicons name="time-outline" size={54} color={COLORS.amber} />
          </View>
        )}

        <Text style={styles.resultHeading}>{content.title}</Text>
        <Text style={styles.resultSub}>{content.message}</Text>

        {/* Info card */}
        <View style={styles.resultCard}>
          <View style={styles.resultRow}>
            <View style={styles.resultRowLeft}>
              <Ionicons name="person-circle-outline" size={26} color="#00897b" />
              <Text style={styles.resultRowLabel}>{t('gallery.statusLabel')}</Text>
            </View>
            <View style={[styles.resultPill, !content.success && styles.resultPillWarning]}>
              <Text style={[styles.resultPillTextResolved, !content.success && styles.resultPillTextWarning]}>{content.state}</Text>
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

function ExpiredPreview() {
  const { t } = useTranslation('checkinCall');
  return (
    <PreviewFrame>
      <View style={styles.severityIcon}><Ionicons name="time-outline" size={31} color={COLORS.red} /></View>
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

function ConnectionStatesPreview() {
  const { t } = useTranslation('checkinCall');
  const states: Array<{ key: string; icon: keyof typeof Ionicons.glyphMap; tone: 'neutral' | 'ok' | 'error' }> = [
    { key: 'statusPreparing', icon: 'hourglass-outline', tone: 'neutral' },
    { key: 'statusConnecting', icon: 'sync-outline', tone: 'neutral' },
    { key: 'statusConnected', icon: 'checkmark-circle-outline', tone: 'ok' },
    { key: 'statusNoLiveKit', icon: 'volume-mute-outline', tone: 'error' },
    { key: 'statusConnectionUnavailable', icon: 'cloud-offline-outline', tone: 'error' },
    { key: 'statusAcceptFailed', icon: 'alert-circle-outline', tone: 'error' },
    { key: 'statusConnectionLost', icon: 'wifi-outline', tone: 'error' },
    { key: 'statusUrgentAccepted', icon: 'shield-checkmark-outline', tone: 'ok' },
  ];
  return (
    <PreviewFrame>
      <Text style={styles.screenTitleCentered}>{t('gallery.connectionStatesTitle')}</Text>
      <Text style={styles.callStatus}>{t('gallery.connectionStatesLead')}</Text>
      <View style={styles.stateList}>
        {states.map((state) => (
          <View style={styles.stateRow} key={state.key}>
            <View style={styles.stateIcon}>
              <Ionicons
                name={state.icon}
                size={21}
                color={state.tone === 'ok' ? COLORS.teal : state.tone === 'error' ? COLORS.red : COLORS.muted}
              />
            </View>
            <Text style={styles.stateText}>{t(state.key)}</Text>
          </View>
        ))}
      </View>
    </PreviewFrame>
  );
}

function SafetyNote() {
  const { t } = useTranslation('checkinCall');
  return (
    <View style={styles.safetyFooterRow}>
      <Ionicons name="shield-checkmark-outline" size={22} color="#64748b" />
      <Text style={styles.safetyFooterText}>{t('safetyNote')}</Text>
    </View>
  );
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
      case 'incoming-ios': return <NativeIncomingPreview platform="ios" />;
      case 'incoming-android': return <NativeIncomingPreview platform="android" />;
      case 'incoming-user-app': return <InAppIncomingPreview role="USER" />;
      case 'incoming-family-app': return <InAppIncomingPreview role="FAMILY" />;
      case 'user-call': return <UserCallPreview />;
      case 'triage-location': return <TriagePreview step="location" />;
      case 'triage-symptom': return <TriagePreview step="symptom" />;
      case 'triage-intensity': return <TriagePreview step="intensity" />;
      case 'family-unknown': return <FamilyPreview severity="UNKNOWN" />;
      case 'family-mild': return <FamilyPreview severity="MILD" />;
      case 'family-urgent': return <FamilyPreview severity="URGENT" />;
      case 'result-user-ok': return <ResultPreview kind="USER_OK" />;
      case 'result-user-mild': return <ResultPreview kind="USER_MILD" />;
      case 'result-user-urgent': return <ResultPreview kind="USER_URGENT" />;
      case 'result-family-confirmed': return <ResultPreview kind="FAMILY_CONFIRMED" />;
      case 'result-family-unavailable': return <ResultPreview kind="FAMILY_UNAVAILABLE" />;
      case 'call-expired': return <ExpiredPreview />;
      case 'connection-states': return <ConnectionStatesPreview />;
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
  listIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  listCopy: { flex: 1, gap: 4 },
  listTitleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  listTitle: { color: COLORS.ink, fontSize: 16, fontWeight: '700', flexShrink: 1 },
  listBadge: { color: COLORS.teal, backgroundColor: COLORS.tealSoft, fontSize: 10, fontWeight: '800', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  listDescription: { color: COLORS.muted, fontSize: 13, lineHeight: 18 },
  previewScroll: { flexGrow: 1, padding: 18, paddingBottom: 48 },
  previewFrame: { flex: 1, maxWidth: 620, width: '100%', alignSelf: 'center', backgroundColor: 'transparent', borderWidth: 0, padding: 0, gap: 14 },
  previewNotice: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#e6f7f2', borderRadius: 14, borderWidth: 1, borderColor: '#cceee2', paddingHorizontal: 14, paddingVertical: 11 },
  previewNoticeText: { color: '#0f766e', fontSize: 13, lineHeight: 18, fontWeight: '600', flex: 1 },
  headerCrossArt: { position: 'absolute', right: 8, top: 40, opacity: 0.65 },
  screenTitle: { color: COLORS.ink, fontSize: 27, lineHeight: 34, fontWeight: '800', marginTop: 6 },
  screenTitleCentered: { color: COLORS.ink, fontSize: 25, lineHeight: 32, fontWeight: '800', textAlign: 'center' },
  screenLead: { color: COLORS.muted, fontSize: 14, lineHeight: 21, marginBottom: 4 },
  settingRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.line },
  settingCopy: { flex: 1, gap: 3 },
  settingLabel: { color: COLORS.ink, fontSize: 15, fontWeight: '600', flex: 1 },
  settingHint: { color: COLORS.teal, fontSize: 12, fontWeight: '600' },
  valuePill: { backgroundColor: '#edf3f1', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  valueText: { color: COLORS.ink, fontSize: 14, fontWeight: '700' },
  actionButton: { minHeight: 66, borderRadius: 20, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 14 },
  actionIconDirect: { marginRight: 12, alignItems: 'center', justifyContent: 'center' },
  action_ok: { backgroundColor: COLORS.teal },
  action_mild: { backgroundColor: COLORS.amber },
  action_urgent: { backgroundColor: COLORS.red },
  action_neutral: { backgroundColor: '#e8efed', borderWidth: 1, borderColor: '#d2dfdc' },
  actionText: { fontSize: 16, lineHeight: 22, fontWeight: '700' },
  actionTextNeutral: { color: COLORS.ink },

  // User Call Preview Card
  userCallCard: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#e2f2ec',
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 20,
    alignItems: 'center',
    shadowColor: '#059669',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  userCallHeroArt: {
    width: '100%',
    height: 110,
    marginBottom: 8,
  },
  userCallMainTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f3e36',
    textAlign: 'center',
    marginTop: 4,
  },
  userCallSub: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 6,
    marginBottom: 18,
    paddingHorizontal: 8,
  },
  userOptionsList: {
    width: '100%',
    gap: 12,
  },
  replayPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#e0f2fe',
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 11,
    marginTop: 20,
    marginBottom: 16,
  },
  replayPillText: {
    color: '#0284c7',
    fontSize: 14,
    fontWeight: '700',
  },
  safetyFooterRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e2e8f0',
    paddingTop: 14,
    marginTop: 4,
  },
  safetyFooterText: {
    flex: 1,
    color: '#64748b',
    fontSize: 12,
    lineHeight: 17,
  },
  incoming: { minHeight: 620, borderRadius: 24, alignItems: 'center', paddingHorizontal: 24, paddingTop: 62, paddingBottom: 34 },
  incomingIos: { backgroundColor: '#15201e' },
  incomingAndroid: { backgroundColor: '#eaf2f0', borderWidth: 1, borderColor: '#cfdedb' },
  incomingEyebrow: { color: COLORS.muted, fontSize: 12, letterSpacing: 1.5, fontWeight: '800' },
  incomingTextLight: { color: '#f2faf7' },
  incomingTextMuted: { color: '#b8c8c4' },
  callAvatar: { width: 78, height: 78, borderRadius: 39, alignItems: 'center', justifyContent: 'center', marginTop: 34 },
  incomingTitle: { color: COLORS.ink, fontSize: 25, lineHeight: 32, fontWeight: '700', textAlign: 'center', marginTop: 24 },
  incomingSubtitle: { color: COLORS.muted, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 6 },
  callActions: { width: '100%', flexDirection: 'row', justifyContent: 'space-around', marginTop: 'auto' },
  callActionItem: { alignItems: 'center', gap: 10 },
  callCircle: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center' },
  decline: { backgroundColor: '#c84049' },
  accept: { backgroundColor: '#168a64' },
  hangupIcon: { transform: [{ rotate: '135deg' }] },
  callActionLabel: { color: COLORS.ink, fontSize: 13, fontWeight: '600' },
  callHeaderIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginTop: 14 },
  callStatus: { color: COLORS.muted, fontSize: 15, lineHeight: 23, textAlign: 'center', marginBottom: 6 },
  replayRow: { minHeight: 48, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  replayText: { color: COLORS.teal, fontSize: 15, fontWeight: '700' },
  safetyNote: { color: COLORS.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 8 },
  severityIcon: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginTop: 12 },
  severityMessage: { borderRadius: 14, padding: 14, borderWidth: 1 },
  severityMessageMild: { backgroundColor: '#fff8eb', borderColor: '#ecd6aa' },
  severityMessageUrgent: { backgroundColor: '#fff0f2', borderColor: '#edc2c8' },
  severityMessageText: { color: COLORS.ink, fontSize: 14, lineHeight: 21, fontWeight: '600', textAlign: 'center' },
  familyFootnote: { color: COLORS.muted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  resultIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginTop: 18 },
  resultSummary: { minHeight: 70, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: COLORS.line, paddingVertical: 12 },
  resultLabel: { color: COLORS.muted, fontSize: 12 },
  resultValue: { color: COLORS.teal, fontSize: 16, fontWeight: '700', marginTop: 3 },
  resultTime: { color: COLORS.ink, fontSize: 15, fontWeight: '700' },
  inlineError: { flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 12, backgroundColor: COLORS.redSoft, padding: 12 },
  inlineErrorText: { flex: 1, color: COLORS.red, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  stateList: { gap: 10 },
  stateRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.line, paddingVertical: 9 },
  stateIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  stateText: { flex: 1, color: COLORS.ink, fontSize: 14, lineHeight: 20, fontWeight: '600' },

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
  familyCardUnknown: {
    backgroundColor: '#f2f8f6',
    borderColor: '#cfe3de',
  },
  urgentBadgeCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
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
  familyCardTitleUnknown: {
    color: COLORS.teal,
  },
  familyCardSubtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
  },
  galleryReportedIssueBox: {
    width: '100%',
    marginTop: 14,
    borderRadius: 14,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 3,
  },
  galleryReportedIssueLabel: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  galleryReportedIssueValue: {
    color: '#1e293b',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  previewContextNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    backgroundColor: COLORS.tealSoft,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  previewContextNoteText: {
    flex: 1,
    color: '#0d6857',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  triageProgressPreview: {
    color: COLORS.teal,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  previewSelectionSummary: {
    borderRadius: 14,
    backgroundColor: '#edf4f2',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 3,
  },
  previewSelectionLabel: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  previewSelectionValue: {
    color: COLORS.ink,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '800',
  },
  triageGuaranteePreview: {
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 2,
  },
  familyActionsCol: {
    width: '100%',
    gap: 12,
    zIndex: 2,
  },
  familyActionBtn: {
    minHeight: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    width: '100%',
  },
  familyActionBtnUrgent: {
    backgroundColor: '#c83244',
  },
  familyActionBtnMild: {
    backgroundColor: COLORS.amber,
  },
  familyActionBtnUnknown: {
    backgroundColor: COLORS.teal,
  },
  familyActionTextUrgent: {
    color: '#ffffff',
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
  resultWarningIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
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
  resultPillWarning: {
    backgroundColor: COLORS.amberSoft,
  },
  resultPillTextResolved: {
    color: '#00897b',
    fontWeight: '700',
    fontSize: 13,
  },
  resultPillTextWarning: {
    color: '#8a5108',
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
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginTop: 22,
    zIndex: 2,
  },
  resultCloseBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
