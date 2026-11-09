import React, { useEffect, useRef, useState } from 'react';
import { View, Image, Pressable, type ViewStyle, type TextStyle, type ImageStyle } from 'react-native';
import Animated, { FadeInDown, FadeInLeft } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ScaledText as Text } from '../../components/ScaledText';
import { GuideTarget, useGuideAcknowledgement } from '../guidance/GuidanceProvider';
import { VoiceAnswerInput } from '../guidance/VoiceAnswerInput';
import { colors, spacing } from '../../styles';
import { LOCATION_DETAIL_GROUPS, locationDetailLabel, toggleLocationDetail, missingLocationDetails, formatLocationNotes, type BodyLocation, type LocationDetails } from './location-details';
import { saveLocationDraft, type LocationDraft } from './checkin-progress';
import type { CheckinStatus } from './checkin.api';
type Styles = Record<string, ViewStyle & TextStyle> & { mascotSticker: ImageStyle };
const asinuChatSticker = require('../../../assets/asinu_chat_sticker.png');

type MciName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
const BODY_LOCATION_OPTIONS: Array<{ key: BodyLocation; icon: MciName; labelKey: string; descKey: string }> = [
  { key: 'head', icon: 'head-outline', labelKey: 'checkinLocationHead', descKey: 'checkinLocationHeadDesc' },
  { key: 'chest', icon: 'heart-pulse', labelKey: 'checkinLocationChest', descKey: 'checkinLocationChestDesc' },
  { key: 'abdomen', icon: 'stomach', labelKey: 'checkinLocationAbdomen', descKey: 'checkinLocationAbdomenDesc' },
  { key: 'limbs', icon: 'arm-flex-outline', labelKey: 'checkinLocationLimbs', descKey: 'checkinLocationLimbsDesc' },
  { key: 'skin', icon: 'hand-back-right-outline', labelKey: 'checkinLocationSkin', descKey: 'checkinLocationSkinDesc' },
  { key: 'whole_body', icon: 'human', labelKey: 'checkinLocationWholeBody', descKey: 'checkinLocationWholeBodyDesc' },
  { key: 'mental', icon: 'brain', labelKey: 'checkinLocationMental', descKey: 'checkinLocationMentalDesc' },
];

export function CheckinLocationFlow({
  styles,
  onConfirm,
  onQuestionChange,
  onBack,
  onBackHandlerChange,
  initialDraft,
  draftStatus,
  draftAccount,
  loading,
  onBeforeAi,
  practice = false,
  readOnly = false,
}: {
  styles: Styles;
  onConfirm: (locs: BodyLocation[], other: string) => void | Promise<void>;
  onBack: () => void;
  onBackHandlerChange?: (handler: (() => void) | null) => void;
  initialDraft?: LocationDraft | null;
  draftStatus?: CheckinStatus | null;
  draftAccount?: string | number;
  onQuestionChange?: () => void;
  loading: boolean;
  onBeforeAi: () => Promise<boolean>;
  practice?: boolean;
  readOnly?: boolean;
}) {
  const { t } = useTranslation('home');
  const { t: tg } = useTranslation('onboarding');
  const acknowledgeGuide = useGuideAcknowledgement();
  const [selected, setSelected] = useState<Set<BodyLocation>>(
    readOnly ? new Set([BODY_LOCATION_OPTIONS[0].key]) : new Set(initialDraft?.selected || [])
  );
  const [other, setOther] = useState(initialDraft?.other || '');
  const [locationDetails, setLocationDetails] = useState<LocationDetails>(readOnly ? { head: ['uncertain'] } : initialDraft?.details || {});
  const [detailIndex, setDetailIndex] = useState<number | null>(initialDraft?.detailIndex ?? null);
  const [positionNotes, setPositionNotes] = useState<Partial<Record<BodyLocation, string>>>(initialDraft?.positionNotes || {});
  const [isTranscribing, setIsTranscribing] = useState(false);
  const submitting = useRef(false);
  const questionChange = useRef(onQuestionChange);
  questionChange.current = onQuestionChange;
  useEffect(() => { questionChange.current?.(); }, [detailIndex]);
  const snapshot = JSON.stringify({ status: draftStatus, selected: [...selected], other, details: locationDetails, positionNotes, detailIndex });
  useEffect(() => {
    if (!practice && !readOnly && draftAccount != null && draftStatus && !loading) {
      void saveLocationDraft(draftAccount, JSON.parse(snapshot));
    }
  }, [snapshot, draftAccount, practice, readOnly, loading]);
  const goBack = () => {
    if (loading || isTranscribing || readOnly || submitting.current) return;
    if (detailIndex !== null) setDetailIndex(detailIndex > 0 ? detailIndex - 1 : null);
    else onBack();
  };
  useEffect(() => {
    onBackHandlerChange?.(goBack);
    return () => onBackHandlerChange?.(null);
  }, [onBackHandlerChange, detailIndex, loading, isTranscribing, readOnly, onBack]);

  const toggle = (key: BodyLocation) => {
    if (readOnly) {return;}
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {next.delete(key);}
      else {next.add(key);}
      return next;
    });
  };

  const count = selected.size + (other.trim() ? 1 : 0);
  const detailGroups = LOCATION_DETAIL_GROUPS.filter(group => selected.has(group.location));
  const canConfirm = count > 0 && !loading && !isTranscribing;
  const confirmLabel = count > 0
    ? t('checkinLocationContinueCount', { count })
    : t('checkinLocationContinue');

  const complete = async () => {
    if (submitting.current || readOnly || loading || isTranscribing) {return;}
    submitting.current = true;
    try {
      questionChange.current?.();
      await onConfirm(Array.from(selected), formatLocationNotes(
        Array.from(selected), locationDetails, other, key => String(t(key)), positionNotes
      ));
    } finally { submitting.current = false; }
  };
  const advance = () => {
    if (readOnly || !canConfirm) {return;}
    if (detailGroups.length) {setDetailIndex(0);}
    else {complete();}
  };
  const group = detailIndex === null ? null : detailGroups[detailIndex];
  if (group) {
    const note = positionNotes[group.location] || '';
    const ready = !missingLocationDetails([group.location], locationDetails, note).length
      && !loading && !isTranscribing && !readOnly;
    return <View style={styles.section} testID={`checkin-location-question-${group.location}`}>
      <View style={styles.triageProgressRow}>
        <View style={styles.triageProgressTrack}>
          <View style={[styles.triageProgressFill, { width: `${((detailIndex! + 1) / detailGroups.length) * 100}%` }]} />
        </View>
        <Text style={styles.triageProgressText}>{t('checkinLocationPositionProgress', { current: detailIndex! + 1, total: detailGroups.length })}</Text>
      </View>
      <View style={[styles.questionSection, styles.questionHeaderRow]}>
        <Image
          source={asinuChatSticker}
          style={[styles.mascotSticker, { width: 56, height: 64, flexShrink: 0 }]}
          resizeMode="contain"
          accessible={false}
          importantForAccessibility="no"
        />
        <Text allowFontScaling accessibilityRole="header" style={[styles.questionHeaderTitle, { fontSize: 22, lineHeight: 30 }]}>
          {t(group.questionKey)}
        </Text>
      </View>
      <View style={styles.triageOptionsList}>
        {group.positionKeys.map(key => {
          const checked = (locationDetails[group.location] || []).includes(key);
          return <Pressable key={key} testID={`checkin-location-position-${group.location}-${key}`}
            accessibilityRole="checkbox" accessibilityState={{ checked, disabled: loading || isTranscribing || readOnly }}
            disabled={loading || isTranscribing || readOnly}
            onPress={() => { if (!loading && !isTranscribing && !readOnly) {setLocationDetails(previous => toggleLocationDetail(previous, group.location, key));} }}
            style={({ pressed }) => [styles.triageOptionCard, { minHeight: 56 }, checked && styles.triageOptionCardSelected, pressed && { opacity: 0.85 }]}>
            <View style={[styles.triageCheckbox, checked && styles.triageCheckboxSelected]}>
              {checked && <Ionicons name="checkmark" size={16} color={colors.surface} />}
            </View>
            <Text allowFontScaling style={[styles.triageOptionTitle, checked && styles.triageOptionTitleSelected]}>{t(locationDetailLabel(key))}</Text>
          </Pressable>;
        })}
      </View>
      {(locationDetails[group.location] || []).includes('other_detail') && <VoiceAnswerInput
        key={group.location} value={note}
        onChangeText={text => setPositionNotes(previous => ({ ...previous, [group.location]: text }))}
        onBeforeAi={onBeforeAi} onProcessingChange={setIsTranscribing}
        disabled={loading} readOnly={readOnly} practice={practice}
        placeholder={t('checkinLocationOtherPlaceholder')} maxLength={200}
        style={styles.triageInputCard} inputStyle={styles.triageTextInput} />}
      <Pressable testID="checkin-location-question-next" disabled={!ready}
        onPress={() => {
          if (!ready) {return;}
          if (detailIndex! + 1 < detailGroups.length) {setDetailIndex(detailIndex! + 1);}
          else {complete();}
        }}
        style={[styles.triagePillBtn, !ready && styles.triagePillBtnDisabled]}>
        <Text allowFontScaling style={[styles.triagePillBtnText, !ready && styles.triagePillBtnTextDisabled]}>{t('checkinLocationContinue')}</Text>
      </Pressable>
      <Pressable testID="checkin-location-question-back" disabled={loading || isTranscribing || readOnly}
        accessibilityRole="button"
        onPress={goBack}
        style={({ pressed }) => [styles.triagePillBtn, styles.triageBackBtn,
          (loading || isTranscribing || readOnly) && { opacity: 0.45 }, pressed && { opacity: 0.78 }]}>
        <Text allowFontScaling style={[styles.triagePillBtnText, styles.triageBackBtnText]}>{t('back', { ns: 'common' })}</Text>
      </Pressable>
    </View>;
  }

  return (
    <View style={styles.section}>
      {/* Companion Mascot sticker + Speech bubble */}
      <Animated.View entering={FadeInLeft.duration(350)} style={styles.mascotRow}>
        <Image
          source={asinuChatSticker}
          style={styles.mascotSticker}
          resizeMode="contain"
        />
        <View style={styles.mascotBubble}>
          <Text style={styles.mascotBubbleText}>
            {t('checkinLocationMascotBubble')}
          </Text>
        </View>
      </Animated.View>

      {/* Question section: Pulse icon + Title */}
      <Animated.View entering={FadeInLeft.duration(400)} style={styles.questionSection}>
        <View style={styles.questionHeaderRow}>
          <MaterialCommunityIcons name="pulse" size={26} color="#08b8a2" style={styles.questionPulseIcon} />
          <Text allowFontScaling style={[styles.questionHeaderTitle, practice && { fontSize: 22, lineHeight: 30 }]}>
            {t('checkinLocationTitle')}
          </Text>
        </View>
      </Animated.View>

      {/* Body location options */}
      <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.triageOptionsList}>
        {BODY_LOCATION_OPTIONS.map((opt, optionIndex) => {
          const isSelected = selected.has(opt.key);
          return (
            <GuideTarget key={opt.key} step="checkin.location" enabled={practice && optionIndex === 0 && !loading}>
              <Pressable
                key={opt.key}
                testID={`checkin-location-region-${opt.key}`}
                onPress={() => !loading && toggle(opt.key)}
                disabled={loading || readOnly}
                style={({ pressed }) => [
                  styles.triageOptionCard,
                  isSelected && styles.triageOptionCardSelected,
                  (pressed || loading) && { opacity: 0.85 },
                ]}
              >
                <View style={[styles.triageCheckbox, isSelected && styles.triageCheckboxSelected]}>
                  {isSelected && <Ionicons name="checkmark" size={13} color="#ffffff" />}
                </View>
                <View style={styles.locationOptionIcon}>
                  <MaterialCommunityIcons
                    name={opt.icon}
                    size={24}
                    color={isSelected ? '#08b8a2' : '#64748b'}
                  />
                </View>
                <Text allowFontScaling style={[styles.triageOptionTitle, styles.locationOptionLabel, isSelected && styles.triageOptionTitleSelected]}>
                  {t(opt.labelKey)}
                </Text>
              </Pressable>
            </GuideTarget>
          );
        })}
      </Animated.View>

      {/* Free-text "Khác" / voice input */}
      <GuideTarget step="checkin.location_other" enabled={practice && !loading}>
        <Animated.View entering={FadeInDown.delay(160).duration(400)}>
          {practice ? (
            <Text allowFontScaling style={{ color: colors.textPrimary, marginBottom: spacing.xs, fontSize: 18, fontWeight: '700' }}>
              {tg('guidance.otherAnswer')}
            </Text>
          ) : null}
          <VoiceAnswerInput value={other} onChangeText={setOther}
            onRecognized={() => acknowledgeGuide('checkin.voice')}
            onBeforeAi={onBeforeAi} onProcessingChange={setIsTranscribing}
            disabled={loading} readOnly={readOnly} practice={practice}
            placeholder={t('checkinLocationOtherPlaceholder')} maxLength={200}
            style={styles.triageInputCard}
            inputStyle={[styles.triageTextInput, practice && { fontSize: 20 }]} />
        </Animated.View>
      </GuideTarget>

      {/* Action / Continue button */}
      <GuideTarget step="checkin.location_confirm" enabled={practice && canConfirm}>
        <Animated.View entering={FadeInDown.delay(200).duration(400)}>
          <Pressable
            testID="checkin-location-continue"
            onPress={advance}
            disabled={!canConfirm || readOnly}
            style={({ pressed }) => [
              styles.triagePillBtn,
              !canConfirm && styles.triagePillBtnDisabled,
              pressed && canConfirm && { opacity: 0.88, transform: [{ scale: 0.98 }] },
            ]}
          >
            <Text allowFontScaling style={[styles.triagePillBtnText, !canConfirm && styles.triagePillBtnTextDisabled, practice && { fontSize: 20 }]}>
              {confirmLabel}
            </Text>
            <Ionicons
              name="arrow-forward"
              size={18}
              color={canConfirm ? '#ffffff' : '#94a3b8'}
              style={{ marginLeft: 6 }}
            />
          </Pressable>
        </Animated.View>
      </GuideTarget>

      {/* Bottom watermark decoration */}
      <View style={styles.bottomWatermarkWrap} pointerEvents="none">
        <Svg width={200} height={160} viewBox="0 0 200 160" fill="none">
          <Path d="M0 110 C60 75 120 95 200 55 L200 160 L0 160 Z" fill="#e6faf8" opacity={0.5} />
          <Path d="M25 130 C85 100 145 115 200 95 L200 160 L25 160 Z" fill="#d8f6f1" opacity={0.4} />
          <Path d="M165 95 H177 V83 C177 81 178.8 79.5 181 79.5 C183.2 79.5 185 81 185 83 V95 H197 C199 95 200.5 96.8 200.5 99 C200.5 101.2 199 103 197 103 H185 V115 C185 117 183.2 118.5 181 118.5 C178.8 118.5 177 117 177 115 V103 H165 C163 103 161.5 101.2 161.5 99 C161.5 96.8 163 95 165 95 Z" fill="#08b8a2" opacity={0.2} />
          <Path d="M173 124 C160 129 157 142 163 152 C174 150 182 138 173 124 Z" fill="#08b8a2" opacity={0.2} />
          <Path d="M185 120 C192 128 194 144 186 151 C177 146 177 133 185 120 Z" fill="#08b8a2" opacity={0.16} />
        </Svg>
      </View>
    </View>
  );
}
