import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Linking, Modal, Pressable, StyleSheet, TurboModuleRegistry, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type WebView from "react-native-webview";
import type { WebViewMessageEvent } from "react-native-webview";
import { ScaledText as Text } from "../../components/ScaledText";
import { useThemeColors } from "../../hooks/useThemeColors";
import { showToast } from "../../stores/toast.store";
import {
  consultationBrowserUrl,
  consultationCallHtml,
  type ConsultationCall,
} from "./consultation-call";

type Props = {
  call: ConsultationCall;
  doctorName?: string;
  onClose: () => void;
};

function loadEmbeddedWebView(): typeof WebView | null {
  if (!TurboModuleRegistry.get("RNCWebViewModule")) return null;

  // Older development clients can load this screen from Metro before the native library is installed.
  return (require("react-native-webview") as typeof import("react-native-webview")).default;
}

export function ConsultationCallScreen({ call, doctorName, onClose }: Props) {
  const { t, i18n } = useTranslation("home");
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const [EmbeddedWebView] = useState(loadEmbeddedWebView);
  const webView = useRef<WebView>(null);
  const closingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const [attempt, setAttempt] = useState(0);
  const language = i18n.resolvedLanguage ?? i18n.language;
  const source = useMemo(() => ({
    html: consultationCallHtml(call, language),
    baseUrl: call.url.origin + "/",
  }), [call, language]);

  useEffect(() => {
    if (!EmbeddedWebView || status !== "loading") return;
    const timer = setTimeout(() => setStatus("failed"), 25000);
    return () => clearTimeout(timer);
  }, [EmbeddedWebView, status, attempt]);

  useEffect(() => () => {
    if (closingTimer.current) clearTimeout(closingTimer.current);
  }, []);

  const endCall = () => {
    if (closingTimer.current) return;
    if (status !== "ready" || !webView.current) {
      onClose();
      return;
    }
    webView.current.injectJavaScript("window.endConsultationCall?.(); true;");
    closingTimer.current = setTimeout(onClose, 1500);
  };

  const onMessage = ({ nativeEvent }: WebViewMessageEvent) => {
    if (nativeEvent.data === "closed") onClose();
    if (nativeEvent.data === "loaded") setStatus("ready");
    if (nativeEvent.data === "error") setStatus("failed");
  };

  const openInBrowser = async () => {
    try {
      await Linking.openURL(consultationBrowserUrl(call));
      onClose();
    } catch {
      showToast(t("doctorConsultationCallError"), "error");
    }
  };

  const title = t(call.mode === "voice" ? "doctorConsultationVoiceCall" : "doctorConsultationVideoCall");
  const endLabel = t("doctorConsultationEndCall");

  return (
    <Modal animationType="slide" presentationStyle="fullScreen" onRequestClose={endCall}>
      <View style={[
        styles.screen,
        { backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Ionicons name={call.mode === "voice" ? "call-outline" : "videocam-outline"} size={23} color={colors.primaryText} />
          <View style={styles.headerText}>
            <Text numberOfLines={1} style={[styles.title, { color: colors.textPrimary }]}>
              {doctorName || title}
            </Text>
            {doctorName ? (
              <Text style={{ color: colors.textSecondary }}>{title}</Text>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={endLabel}
            onPress={endCall}
            style={({ pressed }) => [
              styles.endButton,
              { borderColor: colors.border, backgroundColor: pressed ? colors.surfaceMuted : colors.surface },
            ]}
          >
            <Ionicons name="call" size={21} color={colors.danger} style={styles.endIcon} />
          </Pressable>
        </View>
        {!EmbeddedWebView || status === "failed" ? (
          <View style={styles.center}>
            <Ionicons name="alert-circle-outline" size={30} color={colors.textSecondary} />
            <Text style={[styles.centerText, { color: colors.textPrimary }]}>
              {t(EmbeddedWebView ? "doctorConsultationCallError" : "doctorConsultationCallUpdateRequired")}
            </Text>
            {EmbeddedWebView ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setStatus("loading");
                  setAttempt((value) => value + 1);
                }}
                style={[styles.action, { backgroundColor: colors.surfaceMuted }]}
              >
                <Text style={[styles.actionText, { color: colors.primaryText }]}>{t("common:retry")}</Text>
              </Pressable>
            ) : null}
            <Pressable accessibilityRole="button" onPress={() => void openInBrowser()} style={styles.action}>
              <Text style={{ color: colors.primaryText }}>{t("doctorConsultationCallOpenBrowser")}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.room}>
            <EmbeddedWebView
              key={attempt}
              ref={webView}
              source={source}
              style={{ backgroundColor: colors.background }}
              originWhitelist={["*"]}
              onShouldStartLoadWithRequest={({ url }) =>
                url === "about:blank" || url.startsWith(call.url.origin + "/")
              }
              onOpenWindow={() => {}}
              onMessage={onMessage}
              onError={() => setStatus("failed")}
              onContentProcessDidTerminate={() => setStatus("failed")}
              onRenderProcessGone={() => setStatus("failed")}
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
              mediaCapturePermissionGrantType="grantIfSameHostElseDeny"
              mixedContentMode="never"
              allowFileAccess={false}
            />
            {status === "loading" ? (
              <View pointerEvents="none" style={[styles.loading, { backgroundColor: colors.background }]}>
                <ActivityIndicator color={colors.primary} />
                <Text style={{ color: colors.textSecondary }}>{t("doctorConsultationCallConnecting")}</Text>
              </View>
            ) : null}
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  headerText: { flex: 1, minWidth: 0 },
  title: { fontSize: 17, fontWeight: "700" },
  endButton: {
    alignItems: "center",
    borderRadius: 22,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  endIcon: { transform: [{ rotate: "135deg" }] },
  room: { flex: 1 },
  center: { alignItems: "center", flex: 1, gap: 12, justifyContent: "center", padding: 24 },
  centerText: { textAlign: "center" },
  action: { borderRadius: 12, justifyContent: "center", minHeight: 44, paddingHorizontal: 18 },
  actionText: { fontWeight: "600" },
  loading: { ...StyleSheet.absoluteFill, alignItems: "center", gap: 10, justifyContent: "center" },
});
