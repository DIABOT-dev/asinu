import { Ionicons } from "@expo/vector-icons";
import React, { type ComponentProps } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { ScaledText as Text } from "./ScaledText";
import { useThemeColors } from "../hooks/useThemeColors";
import { radius, spacing } from "../styles";

export type AppActionSheetAction = {
  key: string;
  label: string;
  icon: ComponentProps<typeof Ionicons>["name"];
  destructive?: boolean;
  onPress: () => void;
};

type Props = {
  visible: boolean;
  title: string;
  cancelLabel: string;
  actions: AppActionSheetAction[];
  onDismiss: () => void;
};

export function AppActionSheetModal({
  visible,
  title,
  cancelLabel,
  actions,
  onDismiss,
}: Props) {
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <Pressable
          style={[styles.backdrop, { backgroundColor: colors.overlay }]}
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel={cancelLabel}
        />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              paddingBottom: Math.max(insets.bottom, spacing.lg),
            },
          ]}
          accessibilityViewIsModal
        >
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {title}
          </Text>
          <ScrollView
            style={styles.actionList}
            contentContainerStyle={styles.actionListContent}
            showsVerticalScrollIndicator={false}
          >
            {actions.map((action) => {
              const tint = action.destructive ? colors.danger : colors.primary;
              return (
                <Pressable
                  key={action.key}
                  style={({ pressed }) => [
                    styles.action,
                    pressed && { backgroundColor: colors.surfaceMuted },
                  ]}
                  accessibilityRole="button"
                  onPress={() => {
                    onDismiss();
                    action.onPress();
                  }}
                >
                  <Ionicons name={action.icon} size={22} color={tint} />
                  <Text
                    style={[
                      styles.actionLabel,
                      { color: action.destructive ? colors.danger : colors.textPrimary },
                    ]}
                  >
                    {action.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <Pressable
            style={({ pressed }) => [
              styles.cancel,
              { backgroundColor: colors.surfaceMuted },
              pressed && { opacity: 0.75 },
            ]}
            accessibilityRole="button"
            onPress={onDismiss}
          >
            <Text style={[styles.cancelLabel, { color: colors.textPrimary }]}>
              {cancelLabel}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  sheet: {
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    maxHeight: "85%",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  handle: {
    alignSelf: "center",
    borderRadius: radius.full,
    height: 4,
    width: 38,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: spacing.md,
    marginTop: spacing.lg,
    textAlign: "center",
  },
  actionList: {
    flexGrow: 0,
    flexShrink: 1,
  },
  actionListContent: {
    gap: spacing.xs,
  },
  action: {
    alignItems: "center",
    borderRadius: radius.md,
    flexDirection: "row",
    gap: spacing.lg,
    minHeight: 56,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  actionLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
  },
  cancel: {
    alignItems: "center",
    borderRadius: radius.md,
    marginTop: spacing.md,
    minHeight: 52,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  cancelLabel: {
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
});
