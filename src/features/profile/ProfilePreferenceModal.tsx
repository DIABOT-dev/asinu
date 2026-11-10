import type { ReactNode } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScaledText as Text } from "../../components/ScaledText";
import { useThemeColors } from "../../hooks/useThemeColors";

type Props = {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  headerContent?: ReactNode;
  footer?: ReactNode;
};

export function ProfilePreferenceModal({
  visible,
  title,
  onClose,
  children,
  headerContent,
  footer,
}: Props) {
  const { t } = useTranslation("common");
  const { colors, isDark } = useThemeColors();
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.root,
          { paddingVertical: Math.max(insets.top, insets.bottom, 16) },
        ]}
      >
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]}
          accessibilityRole="button"
          accessibilityLabel={t("close")}
          onPress={onClose}
        />
        <View
          accessibilityViewIsModal
          style={[
            styles.dialog,
            {
              backgroundColor: isDark ? "#142e29" : "#f1faf7",
            },
          ]}
        >
          <View style={styles.header}>
            <Text
              accessibilityRole="header"
              style={[styles.title, { color: colors.textPrimary }]}
            >
              {title}
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
          {headerContent && <View style={styles.headerContent}>{headerContent}</View>}
          <ScrollView
            showsVerticalScrollIndicator
            bounces={false}
            style={styles.scroll}
          >
            {children}
          </ScrollView>
          {footer && <View style={styles.footer}>{footer}</View>}
        </View>
      </View>
    </Modal>
  );
}

export const preferenceStyles = StyleSheet.create({
  option: {
    minHeight: 56,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  copy: { flex: 1, minWidth: 0, gap: 4 },
  label: { fontSize: 18 },
  preview: { fontFamily: "Inter_400Regular" },
  flag: { fontSize: 30 },
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  dialog: {
    width: "100%",
    maxWidth: 560,
    maxHeight: "85%",
    alignSelf: "center",
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 16,
  },
  header: {
    flexShrink: 0,
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
  headerContent: { flexShrink: 0, paddingBottom: 12 },
  footer: { flexShrink: 0, paddingTop: 12 },
});
