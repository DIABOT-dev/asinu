import { useEffect, useMemo, useRef, useState } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useTranslation } from "react-i18next";
import { ScaledText as Text } from "../../components/ScaledText";
import { useThemeColors } from "../../hooks/useThemeColors";
import { showToast } from "../../stores/toast.store";
import { AssistantMessageContent } from "./AssistantMessageContent";
import { parseAssistantMessage } from "./assistant-message-format";
import type { AssistantMessage } from "./assistant-conversation.storage";
import type { AssistantRating } from "./useAssistantMessageFeedback";

const mascot = require("../../../assets/asinu_assistant_listening_v1.png");
type Props = {
  message: AssistantMessage;
  rating?: AssistantRating;
  ratingBusy?: boolean;
  ratingError?: string;
  onRate?: (rating: AssistantRating) => void;
  allowCollapse?: boolean;
  avatar?: "mascot" | "signal";
};
export function AssistantChatMessage({
  message,
  rating,
  ratingBusy,
  ratingError,
  onRate,
  allowCollapse = true,
  avatar = "mascot",
}: Props) {
  const { t } = useTranslation("settings");
  const { colors, isDark } = useThemeColors();
  const [collapsed, setCollapsed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const active = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
  const summary = useMemo(
    () =>
      parseAssistantMessage(message.text)
        .map((block) =>
          block.kind === "list"
            ? block.items
                .map((item) => `${item.marker} ${item.text}`)
                .join("\n")
            : block.kind === "details"
            ? block.items
                .map((item) => `${item.label}: ${item.value}`)
                .join("\n")
            : block.text
        )
        .join("\n\n"),
    [message.text]
  );
  const long =
    allowCollapse &&
    (message.text.length > 360 || message.text.split("\n").length > 6);
  const copy = async () => {
    try {
      if (!(await Clipboard.setStringAsync(message.text)))
        throw new Error("Clipboard write failed");
      if (!active.current) return;
      setCopied(true);
      setCopyError(false);
      showToast(t("appAssistant.copied"));
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        if (active.current) setCopied(false);
      }, 1800);
    } catch {
      if (active.current) {
        setCopied(false);
        setCopyError(true);
      }
    }
  };
  if (message.role === "user")
    return (
      <View
        testID="assistant-user-message"
        style={[styles.userBubble, { backgroundColor: colors.primaryLight }]}
      >
        <Text
          selectable
          style={[styles.userText, { color: colors.textPrimary }]}
        >
          {message.text}
        </Text>
      </View>
    );
  return (
    <View testID="assistant-chat-message" style={styles.row}>
      <View
        style={[styles.avatar, { backgroundColor: colors.surface }]}
        accessible={false}
        importantForAccessibility="no-hide-descendants"
      >
        {avatar === "signal" ? (
          <Ionicons name="pulse-outline" size={24} color={colors.primaryText} />
        ) : (
          <Image
            source={mascot}
            resizeMode="contain"
            resizeMethod="resize"
            style={styles.avatarImage}
          />
        )}
      </View>
      <View style={styles.answerColumn}>
        <View
          style={[
            styles.bubble,
            { backgroundColor: isDark ? "#1A302E" : "#FDFFFE" },
          ]}
        >
          {long && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t(
                collapsed
                  ? "appAssistant.expandMessage"
                  : "appAssistant.collapseMessage"
              )}
              accessibilityState={{ expanded: !collapsed }}
              onPress={() => setCollapsed((value) => !value)}
              style={styles.collapse}
            >
              <Text
                style={[styles.collapseText, { color: colors.primaryText }]}
              >
                {t(
                  collapsed
                    ? "appAssistant.expandMessage"
                    : "appAssistant.collapseMessage"
                )}
              </Text>
              <Ionicons
                name={collapsed ? "chevron-down" : "chevron-up"}
                size={18}
                color={colors.primaryText}
              />
            </Pressable>
          )}
          {collapsed ? (
            <Text
              selectable
              numberOfLines={4}
              style={[styles.userText, { color: colors.textPrimary }]}
            >
              {summary}
            </Text>
          ) : (
            <AssistantMessageContent text={message.text} />
          )}
        </View>
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t(
              copied ? "appAssistant.copied" : "appAssistant.copyMessage"
            )}
            onPress={() => void copy()}
            style={styles.action}
            testID="assistant-copy-message"
          >
            <Ionicons
              name={copied ? "checkmark" : "copy-outline"}
              size={22}
              color={copied ? colors.primaryText : colors.textSecondary}
            />
          </Pressable>
          {onRate &&
            (["like", "dislike"] as const).map((value) => (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityLabel={t(
                  value === "like"
                    ? "appAssistant.likeMessage"
                    : "appAssistant.dislikeMessage"
                )}
                accessibilityState={{
                  selected: rating === value,
                  disabled: !!ratingBusy,
                  busy: !!ratingBusy,
                }}
                disabled={ratingBusy}
                onPress={() => onRate(value)}
                style={styles.action}
              >
                <Ionicons
                  name={
                    value === "like"
                      ? rating === value
                        ? "thumbs-up"
                        : "thumbs-up-outline"
                      : rating === value
                      ? "thumbs-down"
                      : "thumbs-down-outline"
                  }
                  size={22}
                  color={
                    rating === value ? colors.primaryText : colors.textSecondary
                  }
                />
              </Pressable>
            ))}
        </View>
        {(copyError || ratingError) && (
          <Text
            accessibilityRole="alert"
            style={[styles.error, { color: colors.danger }]}
          >
            {copyError ? t("appAssistant.copyError") : ratingError}
          </Text>
        )}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImage: { width: 38, height: 38 },
  answerColumn: { flex: 1, minWidth: 0 },
  bubble: { padding: 16, borderRadius: 22, borderTopLeftRadius: 6 },
  userBubble: {
    alignSelf: "flex-end",
    maxWidth: "88%",
    padding: 14,
    borderRadius: 20,
    borderBottomRightRadius: 6,
  },
  userText: { fontSize: 16, lineHeight: 25 },
  collapse: {
    alignSelf: "flex-end",
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: -8,
    marginBottom: 4,
  },
  collapseText: { fontSize: 13, fontWeight: "600" },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingTop: 4,
  },
  action: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  error: { fontSize: 13, paddingHorizontal: 4, paddingBottom: 8 },
});
