import type { ReactNode } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScaledText as Text } from "../../components/ScaledText";
import { useThemeColors } from "../../hooks/useThemeColors";

export function CoinDetailsModal({
  visible,
  onClose,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation("v21");
  const { colors, isDark } = useThemeColors();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={[styles.root, { paddingTop: insets.top + 16 }]}>
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]}
          accessibilityRole="button"
          accessibilityLabel={t("close")}
          onPress={onClose}
        />
        <View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            {
              backgroundColor: isDark ? "#142e29" : "#f1faf7",
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}
        >
          <View style={styles.header}>
            <Text
              accessibilityRole="header"
              style={[styles.title, { color: colors.textPrimary }]}
            >
              {t("rules")}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("close")}
              onPress={onClose}
              style={styles.close}
            >
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </Pressable>
          </View>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    width: "100%",
    maxWidth: 560,
    maxHeight: "85%",
    alignSelf: "center",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingBottom: 8,
  },
  title: { flex: 1, fontSize: 20, fontWeight: "700" },
  close: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: { flexGrow: 0, flexShrink: 1 },
  content: { gap: 18, paddingBottom: 8 },
});
