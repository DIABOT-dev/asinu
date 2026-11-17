import { useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useIsFocused } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { ScaledText as Text } from "../../components/ScaledText";
import { QueuedModal } from "../../components/QueuedModal";
import { EarlySignalCard } from "../../components/EarlySignalCard";
import { ProfileHealthcareBackground } from "../profile/ProfileHealthcareBackground";
import { useThemeColors } from "../../hooks/useThemeColors";
import { useAuthStore } from "../auth/auth.store";
import type { HealthScoreData } from "../checkin/checkin.api";

export function EarlySignalDialog({
  healthScore,
  onClose,
}: {
  healthScore?: HealthScoreData | null;
  onClose: () => void;
}) {
  const { t } = useTranslation("tree");
  const { t: tc } = useTranslation("common");
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const token = useAuthStore((state) => state.token);
  const [callFailed, setCallFailed] = useState(false);
  useEffect(() => {
    setCallFailed(false);
  }, [token]);
  return (
    <QueuedModal
      visible={focused && !!token}
      transparent
      animationType="fade"
      interruptible
      priority={10}
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={[styles.root, { backgroundColor: colors.overlay }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel={tc("close")}
          onPress={onClose}
        />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              paddingBottom: Math.max(insets.bottom, 12),
            },
          ]}
          accessibilityViewIsModal
          testID="early-signal-dialog"
        >
          <ProfileHealthcareBackground />
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <View
            style={[
              styles.header,
              {
                paddingTop: 4,
                backgroundColor: colors.surface,
                borderBottomColor: colors.border,
              },
            ]}
          >
            <MaterialCommunityIcons
              name="radar"
              size={30}
              color={colors.primaryText}
            />
            <View style={styles.heading}>
              <Text
                style={[styles.title, { color: colors.textPrimary }]}
                accessibilityRole="header"
              >
                {t("earlyTitle")}
              </Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                {t("earlyReviewSubtitle")}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={tc("close")}
              onPress={onClose}
              style={styles.back}
            >
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </Pressable>
          </View>
          <ScrollView
            style={{ flexGrow: 0, flexShrink: 1 }}
            contentContainerStyle={[styles.content, { paddingBottom: 12 }]}
          >
            <EarlySignalCard
              conversation
              healthScore={healthScore}
              onEmergency={() => {
                if (useAuthStore.getState().token !== token) return;
                void Linking.openURL("tel:115").catch(() => {
                  if (useAuthStore.getState().token === token)
                    setCallFailed(true);
                });
              }}
            />
            {callFailed && (
              <Text accessibilityRole="alert" style={{ color: colors.danger }}>
                {t("earlyCallError")}
              </Text>
            )}
          </ScrollView>
        </View>
      </View>
    </QueuedModal>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    width: "100%",
    maxHeight: "85%",
    minHeight: 220,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
    paddingTop: 10,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  back: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  heading: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontSize: 20, fontWeight: "700" },
  subtitle: { fontSize: 13 },
  content: {
    padding: 16,
    gap: 16,
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
  },
});
