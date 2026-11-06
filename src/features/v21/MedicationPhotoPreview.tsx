import { useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { QueuedModal } from "../../components/QueuedModal";
import { ScaledText as Text } from "../../components/ScaledText";
import { useThemeColors } from "../../hooks/useThemeColors";

export function MedicationPhotoPreview({
  uri,
  label,
  compact = false,
}: {
  uri: string;
  label: string;
  compact?: boolean;
}) {
  const { t } = useTranslation("v21");
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [visible, setVisible] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
    setVisible(false);
  }, [uri]);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("medicationViewPhoto", { name: label })}
        accessibilityState={{ disabled: failed }}
        disabled={failed}
        onPress={() => setVisible(true)}
        style={[
          compact ? styles.thumbnail : styles.preview,
          { backgroundColor: colors.surfaceMuted },
        ]}
      >
        {failed ? (
          <View style={styles.placeholder}>
            <Ionicons
              name="image-outline"
              size={24}
              color={colors.textSecondary}
            />
            {!compact && (
              <Text style={{ color: colors.textSecondary }}>
                {t("medicationPhotoUnavailable")}
              </Text>
            )}
          </View>
        ) : (
          <Image
            source={{ uri }}
            accessibilityLabel={label}
            resizeMode="contain"
            style={styles.image}
            onError={() => setFailed(true)}
          />
        )}
      </Pressable>
      <QueuedModal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <View
          accessibilityViewIsModal
          style={[
            styles.viewer,
            {
              backgroundColor: colors.background,
              paddingTop: insets.top,
              paddingBottom: insets.bottom,
            },
          ]}
        >
          <View style={styles.header}>
            <Text style={[styles.label, { color: colors.textPrimary }]}>
              {label}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("close")}
              onPress={() => setVisible(false)}
              style={styles.close}
            >
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </Pressable>
          </View>
          <ScrollView
            maximumZoomScale={3}
            minimumZoomScale={1}
            centerContent
            contentContainerStyle={styles.viewerContent}
          >
            {failed ? (
              <View style={styles.placeholder}>
                <Ionicons
                  name="image-outline"
                  size={32}
                  color={colors.textSecondary}
                />
                <Text style={{ color: colors.textSecondary }}>
                  {t("medicationPhotoUnavailable")}
                </Text>
              </View>
            ) : (
              <Image
                source={{ uri }}
                accessibilityLabel={label}
                resizeMode="contain"
                onError={() => setFailed(true)}
                style={{
                  width: "100%",
                  height: Math.max(
                    240,
                    height - insets.top - insets.bottom - 100
                  ),
                }}
              />
            )}
          </ScrollView>
        </View>
      </QueuedModal>
    </>
  );
}

const styles = StyleSheet.create({
  preview: { width: "100%", height: 170, borderRadius: 14, overflow: "hidden" },
  thumbnail: {
    width: 52,
    height: 52,
    borderRadius: 10,
    overflow: "hidden",
    flexShrink: 0,
  },
  image: { width: "100%", height: "100%" },
  placeholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 8,
  },
  viewer: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  label: { flex: 1, minWidth: 0, fontSize: 17, fontWeight: "600" },
  close: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  viewerContent: { flexGrow: 1, justifyContent: "center" },
});
