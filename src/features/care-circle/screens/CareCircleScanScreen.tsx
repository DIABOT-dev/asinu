import { Ionicons } from "@expo/vector-icons";
import { CameraView } from "expo-camera";
import { Stack, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScaledText as Text } from "../../../components/ScaledText";
import { useGuardedRouter as useRouter } from "../../../hooks/useGuardedRouter";
import { spacing } from "../../../styles";
import { useCareCircleScanner } from "../useCareCircleScanner";
import { useQrCameraPermission } from "../useQrCameraPermission";

export default function CareCircleScanScreen() {
  const { t } = useTranslation("careCircle");
  const { t: tc } = useTranslation("common");
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const inboundToken = Array.isArray(params.token)
    ? params.token[0]
    : params.token;
  const insets = useSafeAreaInsets();
  const { permission, pending, change } = useQrCameraPermission(!inboundToken);
  const [torch, setTorch] = useState(false);
  const { scanning, pickingImage, error, scan, pickImage, retry } =
    useCareCircleScanner(inboundToken);
  const cameraAvailable = permission?.granted && !inboundToken;

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      {cameraAvailable && (
        <CameraView
          active={!pickingImage}
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          enableTorch={torch}
          facing="back"
          onBarcodeScanned={scanning ? undefined : scan}
          style={StyleSheet.absoluteFill}
        />
      )}
      <View style={styles.scrimTop} pointerEvents="none" />
      <View style={styles.scrimBottom} pointerEvents="none" />
      <View style={[styles.header, { paddingTop: insets.top + spacing.xs }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tc("back")}
          hitSlop={8}
          onPress={() => router.back()}
          style={styles.iconButton}
        >
          <Ionicons name="arrow-back" size={22} color="#f0fdfa" />
        </Pressable>
        <Text style={styles.title}>{t("scanQrTitle")}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={torch ? t("turnOffFlash") : t("turnOnFlash")}
          disabled={!cameraAvailable}
          onPress={() => setTorch((value) => !value)}
          style={styles.iconButton}
        >
          <Ionicons
            name={torch ? "flash" : "flash-off"}
            size={22}
            color={torch ? "#53e4d1" : "#f0fdfa"}
          />
        </Pressable>
      </View>

      <View
        style={styles.scanArea}
        pointerEvents={cameraAvailable ? "none" : "auto"}
      >
        {inboundToken ? (
          !error && (
            <>
              <ActivityIndicator size="large" color="#53e4d1" />
              <Text style={styles.message}>{t("qrChecking")}</Text>
            </>
          )
        ) : cameraAvailable ? (
          <View style={styles.viewfinder}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
            {scanning && !error && (
              <ActivityIndicator size="large" color="#53e4d1" />
            )}
          </View>
        ) : !permission || pending ? (
          <ActivityIndicator size="large" color="#53e4d1" />
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t(
              permission.canAskAgain ? "allowCamera" : "openSettings"
            )}
            onPress={() => void change(true)}
            style={styles.action}
          >
            <Ionicons name="camera-outline" size={24} color="#b9f4ea" />
            <Text style={styles.message}>
              {t(permission.canAskAgain ? "allowCamera" : "openSettings")}
            </Text>
          </Pressable>
        )}
      </View>

      <View
        style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg }]}
      >
        {error ? (
          <>
            <Text style={styles.error}>{error}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("scanAgain")}
              onPress={() =>
                inboundToken ? router.replace("/care-circle/scan") : retry()
              }
              style={styles.action}
            >
              <Text style={styles.message}>{t("scanAgain")}</Text>
            </Pressable>
          </>
        ) : !inboundToken && cameraAvailable ? (
          <Text style={styles.instruction}>{t("placeQrInFrame")}</Text>
        ) : null}
        {!inboundToken && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("qrChoosePhoto")}
            accessibilityState={{
              disabled: scanning && !error,
              busy: pickingImage,
            }}
            disabled={scanning && !error}
            onPress={() => void pickImage()}
            style={({ pressed }) => [
              styles.photoButton,
              pressed && { opacity: 0.65 },
            ]}
          >
            {pickingImage ? (
              <ActivityIndicator color="#f0fdfa" />
            ) : (
              <Ionicons name="images-outline" size={24} color="#f0fdfa" />
            )}
            <Text style={styles.photoText}>
              {t(pickingImage ? "qrReadingPhoto" : "qrChoosePhoto")}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#071a18" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: "700",
    color: "#f0fdfa",
    textAlign: "center",
  },
  iconButton: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  scrimTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "20%",
    backgroundColor: "rgba(4,20,18,0.55)",
  },
  scrimBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "28%",
    backgroundColor: "rgba(4,20,18,0.7)",
  },
  scanArea: {
    position: "absolute",
    top: "22%",
    bottom: "28%",
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  viewfinder: {
    width: 264,
    height: 264,
    alignItems: "center",
    justifyContent: "center",
  },
  corner: {
    position: "absolute",
    width: 46,
    height: 46,
    borderColor: "#53e4d1",
  },
  topLeft: {
    left: 0,
    top: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 18,
  },
  topRight: {
    right: 0,
    top: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 18,
  },
  bottomLeft: {
    left: 0,
    bottom: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 18,
  },
  bottomRight: {
    right: 0,
    bottom: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 18,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    gap: 8,
  },
  instruction: {
    color: "#f0fdfa",
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  action: {
    minHeight: 56,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  message: {
    color: "#b9f4ea",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  error: { color: "#fecaca", fontSize: 16, textAlign: "center" },
  photoButton: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 16,
  },
  photoText: {
    color: "#f0fdfa",
    fontSize: 18,
    fontWeight: "700",
    flexShrink: 1,
    textAlign: "center",
  },
});
