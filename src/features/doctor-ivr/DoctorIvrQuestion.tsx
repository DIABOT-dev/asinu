import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { ScaledText as Text } from "../../components/ScaledText";
import { useThemeColors } from "../../hooks/useThemeColors";
import { radius, spacing } from "../../styles/theme";
import type { IvrOption, IvrQuestion } from "./ivr.api";

export function DoctorIvrQuestion({
  question,
  index,
  total,
  disabled,
  selectedOptionId,
  audioPhase,
  onSelect,
  onReplay,
  onStopAudio,
  recording = false,
  speechRate = 0.9,
  onSpeechRate,
  callMode = false,
}: {
  question: IvrQuestion;
  index: number;
  total: number;
  disabled: boolean;
  selectedOptionId: string | null;
  audioPhase: string;
  onSelect: (option: IvrOption) => void;
  onReplay: () => void;
  onStopAudio: () => void;
  recording?: boolean;
  speechRate?: number;
  onSpeechRate?: (value: number) => void;
  callMode?: boolean;
}) {
  const { t } = useTranslation("home");
  const { colors } = useThemeColors();
  const speaking = audioPhase === "playing" || audioPhase === "loading";
  const selectedAnswer = question.options.find(
    (o) => o.id === selectedOptionId
  );
  return (
    <View style={styles.layout}>
      <View style={styles.progressRow}>
        <Text style={[styles.progressLabel, { color: colors.primaryText }]}>
          {t("ivr.progress", { current: index + 1, total })}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(
            speaking && !callMode ? "ivr.stopAudio" : "ivr.replay"
          )}
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={speaking && !callMode ? onStopAudio : onReplay}
          style={({ pressed }) => [
            styles.audioButton,
            {
              backgroundColor: colors.primaryLight,
              opacity: pressed || disabled ? 0.6 : 1,
            },
          ]}
        >
          <Ionicons
            name={speaking ? "volume-high-outline" : "volume-medium-outline"}
            size={22}
            color={colors.primaryText}
          />
          <Text style={[styles.audioLabel, { color: colors.primaryText }]}>
            {callMode ? "9 · " : ""}
            {t(speaking && !callMode ? "ivr.stopAudio" : "ivr.replayShort")}
          </Text>
        </Pressable>
      </View>
      {onSpeechRate && !recording && (
        <View style={styles.speedRow}>
          <Text style={{ color: colors.textSecondary }}>
            {t("ivr.speechSpeed")}
          </Text>
          {[0.8, 0.9, 1].map((rate) => (
            <Pressable
              key={rate}
              disabled={disabled}
              onPress={() => onSpeechRate(rate)}
              accessibilityRole="button"
              accessibilityLabel={t("ivr.speechSpeedValue", { rate })}
              accessibilityState={{ selected: speechRate === rate, disabled }}
              style={({ pressed }) => [
                styles.speedButton,
                {
                  backgroundColor:
                    speechRate === rate ? colors.primaryLight : colors.surface,
                  borderColor:
                    speechRate === rate ? colors.primary : colors.border,
                  opacity: disabled || pressed ? 0.6 : 1,
                },
              ]}
            >
              <Text style={{ color: colors.primaryText, fontSize: 17 }}>
                {t("ivr.speechRateValue", { rate: rate.toFixed(1) })}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
      <View style={[styles.track, { backgroundColor: colors.border }]}>
        <View
          style={[
            styles.fill,
            {
              backgroundColor: colors.primary,
              width: `${((index + 1) / total) * 100}%`,
            },
          ]}
        />
      </View>
      <View style={styles.companionRow}>
        <Image
          source={require("../../../assets/asinu_chat_sticker.png")}
          resizeMode="contain"
          accessible={false}
          style={styles.mascot}
        />
        <View
          style={[
            styles.questionCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.primary + "20",
              shadowColor: colors.primaryText,
            },
          ]}
        >
          <Text
            accessibilityRole="header"
            style={[styles.question, { color: colors.textPrimary }]}
          >
            {question.text}
          </Text>
        </View>
      </View>
      {!recording && (
        <>
          <Text style={[styles.hint, { color: colors.textSecondary }]}>
            {selectedAnswer
              ? t("ivr.selected", { answer: selectedAnswer.label })
              : t("ivr.chooseNow")}
          </Text>
          <View style={styles.answers}>
            {question.options.map((option) => {
              const selected = option.id === selectedOptionId;
              const voice = option.type === "voice";
              return (
                <Pressable
                  key={option.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${option.key}. ${option.label}`}
                  accessibilityState={{ disabled, selected }}
                  disabled={disabled}
                  onPress={() => onSelect(option)}
                  style={({ pressed }) => [
                    styles.answer,
                    {
                      backgroundColor:
                        selected || voice
                          ? colors.primaryLight
                          : pressed
                          ? colors.surfaceMuted
                          : colors.surface,
                      borderColor: selected
                        ? colors.primary
                        : colors.primary + "25",
                      opacity: disabled && !selected ? 0.55 : 1,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.number,
                      {
                        backgroundColor: selected
                          ? colors.primaryDark
                          : colors.primaryLight,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.numberText,
                        {
                          color: selected ? colors.surface : colors.primaryText,
                        },
                      ]}
                    >
                      {option.key}
                    </Text>
                  </View>
                  <Text
                    style={[styles.answerText, { color: colors.textPrimary }]}
                  >
                    {option.label}
                  </Text>
                  {selected ? (
                    speaking ? (
                      <Ionicons
                        name="checkmark-circle"
                        size={24}
                        color={colors.primaryText}
                      />
                    ) : (
                      <ActivityIndicator
                        size="small"
                        color={colors.primaryText}
                      />
                    )
                  ) : (
                    <Ionicons
                      name={voice ? "mic-outline" : "chevron-forward"}
                      size={voice ? 24 : 20}
                      color={voice ? colors.primaryText : colors.textSecondary}
                    />
                  )}
                </Pressable>
              );
            })}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  speedRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  speedButton: {
    minHeight: 56,
    minWidth: 56,
    paddingHorizontal: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: radius.full,
  },
  layout: { gap: spacing.md },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  progressLabel: { fontSize: 15, fontWeight: "700", flexShrink: 1 },
  audioButton: {
    minHeight: 56,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  audioLabel: { fontSize: 18, fontWeight: "600", flexShrink: 1 },
  track: {
    height: 4,
    borderRadius: radius.full,
    overflow: "hidden",
    marginBottom: spacing.sm,
  },
  fill: { height: 4, borderRadius: radius.full },
  questionCard: {
    flex: 1,
    minWidth: 0,
    padding: spacing.lg,
    borderRadius: radius.xxl,
    borderTopLeftRadius: radius.sm,
    borderWidth: 1,
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  companionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  mascot: { width: 48, height: 60 },
  question: {
    fontSize: 24,
    lineHeight: 34,
    fontWeight: "700",
    letterSpacing: -0.4,
  },
  hint: { fontSize: 15, lineHeight: 22, marginTop: spacing.xs },
  answers: { gap: spacing.md },
  answer: {
    minHeight: 72,
    borderRadius: radius.xl,
    borderWidth: 1,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  number: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  numberText: { fontSize: 18, fontWeight: "700" },
  answerText: { flex: 1, fontSize: 22, lineHeight: 30, fontWeight: "500" },
});
