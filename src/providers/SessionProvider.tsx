import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AppState, Linking } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../features/auth/auth.store";
import { authApi } from "../features/auth/auth.api";
import * as Notifications from "expo-notifications";
import {
  addNotificationResponseReceivedListener,
  checkNotificationPermission,
  getExpoPushToken,
  getNativeFcmToken,
  requestNotificationPermissions,
  routeFromNotificationData,
  setBadgeCount,
  setupNotificationHandler,
} from "../lib/notifications";
import { checkinApi } from "../features/checkin/checkin.api";
import { showToast } from "../stores/toast.store";
import { dispatchRealtimeRefresh } from "../lib/realtimeSync";
import { CaregiverAlertModal } from "../components/CaregiverAlertModal";
import { AppAlertModal } from "../components/AppAlertModal";
import { apiClient } from "../lib/apiClient";
import { env } from "../lib/env";
import {
  addVoipCallAnsweredListener,
  addVoipTokenListener,
  consumePendingVoipCall,
  getVoipRegistration,
  type VoipCallPayload,
  type VoipRegistration,
} from "../lib/voip";

// ─── Session Context ──────────────────────────────────────────────────────────

const SessionContext = createContext<{ ready: boolean }>({ ready: false });

export const useSession = () => useContext(SessionContext);

type Props = { children: ReactNode };

const createClientMessageId = () => {
  const cryptoObject = (
    globalThis as typeof globalThis & {
      crypto?: { randomUUID?: () => string };
    }
  ).crypto;
  if (cryptoObject?.randomUUID) return cryptoObject.randomUUID();
  return `notification-reply:${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 14)}`;
};

export const SessionProvider = ({ children }: Props) => {
  const { t } = useTranslation("settings");
  const bootstrap = useAuthStore((state) => state.bootstrap);
  const loading = useAuthStore((state) => state.loading);
  const hydrated = useAuthStore((state) => state.hydrated);
  const authToken = useAuthStore((state) => state.token);
  const profile = useAuthStore((state) => state.profile);
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [nativeFcmToken, setNativeFcmToken] = useState<string | null>(null);
  const [voipRegistration, setVoipRegistration] =
    useState<VoipRegistration | null>(null);
  const [notificationPromptVisible, setNotificationPromptVisible] =
    useState(false);

  const syncExistingPushToken = useCallback(async () => {
    const voip = await getVoipRegistration();
    if (voip) setVoipRegistration(voip);

    const granted = await checkNotificationPermission();
    if (!granted) return;

    const [token, fcmToken] = await Promise.all([
      getExpoPushToken(),
      getNativeFcmToken(),
    ]);
    if (__DEV__)
      console.log(
        "[Session] Push token result:",
        token ? token.substring(0, 30) + "..." : "NULL",
      );
    if (token) setExpoPushToken(token);
    else
      console.warn(
        "[Session] No push token obtained — notifications will not work remotely",
      );
    if (fcmToken) setNativeFcmToken(fcmToken);
  }, []);

  const enableNotifications = useCallback(async () => {
    const granted = await requestNotificationPermissions();
    if (granted) await syncExistingPushToken();
  }, [syncExistingPushToken]);

  // Initial setup: bootstrap + non-prompting notification setup.
  useEffect(() => {
    if (!hydrated) return;

    bootstrap();
    setupNotificationHandler();
    syncExistingPushToken();
  }, [bootstrap, hydrated, syncExistingPushToken]);

  // Save all platform-specific tokens whenever registration or login changes.
  useEffect(() => {
    if (!authToken || (!expoPushToken && !nativeFcmToken && !voipRegistration?.token)) return;
    authApi
      .updatePushToken(
        expoPushToken,
        nativeFcmToken,
        voipRegistration?.token || null,
        voipRegistration?.environment || null,
      )
      .then(() => {
        if (__DEV__) console.log("[Session] Push token saved to server");
      })
      .catch(() => {});
  }, [authToken, expoPushToken, nativeFcmToken, voipRegistration]);

  const openVoipCall = useCallback((call: VoipCallPayload) => {
    router.push({
      pathname: "/checkin-call/[episodeId]",
      params: {
        episodeId: call.episodeId,
        attemptId: call.attemptId,
        nativeAnswered: "1",
      },
    } as any);
  }, []);

  // PushKit registration is independent from the regular notification prompt.
  // Answer events open the in-app 1/2/3 screen; a persisted pending call covers
  // the cold-start window before React Native has finished bootstrapping.
  useEffect(() => {
    const removeToken = addVoipTokenListener((registration) => {
      setVoipRegistration(registration);
      if (!registration && authToken) {
        void authApi.updatePushToken(null, null, null, null, true).catch(() => {});
      }
    });
    const removeAnswer = addVoipCallAnsweredListener((call) => {
      if (authToken) openVoipCall(call);
    });
    return () => {
      removeToken();
      removeAnswer();
    };
  }, [authToken, openVoipCall]);

  useEffect(() => {
    if (!hydrated || !authToken) return;
    void consumePendingVoipCall().then((call) => {
      if (call) openVoipCall(call);
    });
  }, [authToken, hydrated, openVoipCall]);

  // Ask once after a completed sign-in, with an in-app explanation first.
  // This keeps push registration discoverable for care-circle alerts while
  // avoiding a native permission prompt on the login or onboarding screens.
  useEffect(() => {
    if (!hydrated || !authToken || !profile?.onboardingCompleted) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const promptKey = `@asinu/notification_permission_prompted:${profile.id}`;

    const prepareNotificationAccess = async () => {
      if (await checkNotificationPermission()) {
        await syncExistingPushToken();
        return;
      }

      if (await AsyncStorage.getItem(promptKey)) return;
      await AsyncStorage.setItem(promptKey, "1");
      if (cancelled) return;

      timer = setTimeout(() => {
        if (!cancelled) setNotificationPromptVisible(true);
      }, 1800);
    };

    void prepareNotificationAccess();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [
    authToken,
    hydrated,
    profile?.id,
    profile?.onboardingCompleted,
    syncExistingPushToken,
  ]);

  // When a caregiver_alert / emergency push arrives in foreground, re-display it
  // as a local notification so that ACKNOWLEDGE / CALL action buttons appear.
  // Đồng thời: tự refresh các store + show toast cho care-circle / payment events
  // → user thấy update real-time mà không phải pull-refresh.
  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener(
      (notification) => {
        const data = notification.request.content.data as Record<
          string,
          unknown
        >;
        const type = data?.type as string | undefined;
        const title = notification.request.content.title || "";
        const body = notification.request.content.body || "";

        if (data?.checkinCall === true && data?.kind === 'INCOMING_CALL') {
          const route = routeFromNotificationData(data);
          if (route) router.push(route as any);
          return;
        }

        // KHÔNG re-emit local cho caregiver_alert/emergency — backend đã gửi push
        // với categoryIdentifier='health_alert' (push.notification.service.js)
        // → action buttons "Đã xem" tự xuất hiện ngay trên server push. Re-emit
        // sẽ tạo notification thứ 2 trùng nội dung trong tray.

        // ── REAL-TIME SYNC ──
        // Mọi notification → dispatch refresh các store liên quan.
        // Map type → stores ở src/lib/realtimeSync.ts (cover 30+ types).
        // App tự cập nhật mà không cần reload / pull-refresh.
        dispatchRealtimeRefresh(type);

        // ── TOAST in-app cho events quan trọng (không phải mọi type đều show
        // toast — tránh spam reminder routines).
        if (
          type === "care_circle_invitation" ||
          type === "care_circle_accepted" ||
          type === "care_circle_rejected" ||
          type === "care_circle_removed" ||
          type === "care_circle_permission_changed" ||
          type === "subscription_activated" ||
          type === "wallet_topup_success" ||
          type === "payment_failed" ||
          type === "wallet_low_balance" ||
          type === "caregiver_confirmed" ||
          type === "health_alert" ||
          type === "doctor_message"
        ) {
          const toastType: "success" | "info" | "error" =
            type === "payment_failed" || type === "health_alert"
              ? "error"
              : type === "care_circle_accepted" ||
                  type === "subscription_activated" ||
                  type === "wallet_topup_success" ||
                  type === "caregiver_confirmed"
                ? "success"
                : "info";
          showToast(body || title, toastType, 4000);
        }
      },
    );
    return () => sub.remove();
  }, []);

  // ── Notification deep link routing ──
  // Logic dùng chung ở src/lib/notifications.ts (routeFromNotificationData)
  // để in-app NotificationBell và push handler luôn route nhất quán.
  const handleNotificationRoute = useCallback(
    (data: Record<string, unknown>) => {
      const route = routeFromNotificationData(data);
      if (!route) {
        router.push("/(tabs)/home");
        return;
      }
      if (typeof route === "string") router.push(route as any);
      else router.push(route as any);
    },
    [],
  );

  // Handle notification taps: deep link + action buttons (warm start)
  useEffect(() => {
    const sub = addNotificationResponseReceivedListener((response) => {
      const { actionIdentifier, notification } = response;
      const data = notification.request.content.data as Record<string, unknown>;

      if (data?.checkinCall === true) {
        if (actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) handleNotificationRoute(data);
        return;
      }

      // Action buttons on caregiver alert push notification
      if (actionIdentifier === "ACKNOWLEDGE") {
        const alertId = data?.alertId ? Number(data.alertId) : null;
        if (alertId) checkinApi.confirmAlert(alertId, "seen").catch(() => {});
        return;
      }
      if (actionIdentifier === "ON_MY_WAY") {
        const alertId = data?.alertId ? Number(data.alertId) : null;
        if (alertId)
          checkinApi.confirmAlert(alertId, "on_my_way").catch(() => {});
        return;
      }
      if (actionIdentifier === "CALL") {
        const alertId = data?.alertId ? Number(data.alertId) : null;
        if (alertId) checkinApi.confirmAlert(alertId, "called").catch(() => {});
        const phone = data?.patientPhone as string;
        if (phone) Linking.openURL(`tel:${phone}`).catch(() => {});
        return;
      }

      // Quick reply from the specialist notification. Expo exposes the submitted
      // text as response.userText; the same authenticated endpoint used by
      // the consultation screen keeps this path subject to lifecycle checks,
      // follow-up windows and idempotency.
      if (actionIdentifier === "REPLY_DOCTOR_MESSAGE") {
        const taskId =
          typeof data?.task_id === "string" ? data.task_id.trim() : "";
        const userText =
          typeof response.userText === "string" ? response.userText.trim() : "";
        if (taskId && userText) {
          void apiClient(
            `/api/doctor/tasks/${encodeURIComponent(taskId)}/messages`,
            {
              method: "POST",
              body: {
                tenant_id:
                  typeof data?.tenant_id === "string" && data.tenant_id.trim()
                    ? data.tenant_id
                    : env.doctorTenantId,
                content: userText,
                // `follow_up` is accepted both during an active consultation
                // and inside the explicitly opened post-consultation window.
                message_type: "follow_up",
                client_message_id: createClientMessageId(),
              },
            },
          ).catch(() => {
            // The notification action has no reliable foreground surface for
            // an error. The conversation remains available from the push tap.
          });
        }
        return;
      }

      // Default tap → deep link
      if (actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) {
        handleNotificationRoute(data);
      }
    });
    return () => sub.remove();
  }, [handleNotificationRoute]);

  // Cold-start deep link is handled in app/index.tsx (splash) — splash đã đợi
  // bootstrap xong rồi mới redirect, nên check notification ở đó tránh
  // race-condition với router.replace('/(tabs)/home') của splash.

  // Re-check silently when user returns from Settings.
  useEffect(() => {
    if (!hydrated) return;

    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") syncExistingPushToken();
    });
    return () => sub.remove();
  }, [hydrated, syncExistingPushToken]);

  // Clear app icon badge mỗi khi app vào foreground hoặc start.
  // Tránh tích luỹ badge counter (đã từng thấy 100+ do shouldSetBadge=true cũ).
  useEffect(() => {
    setBadgeCount(0);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") setBadgeCount(0);
    });
    return () => sub.remove();
  }, []);

  const value = useMemo(
    () => ({ ready: !loading && hydrated }),
    [loading, hydrated],
  );

  return (
    <SessionContext.Provider value={value}>
      {children}
      <AppAlertModal
        visible={notificationPromptVisible}
        title={t("pushPermissionTitle")}
        message={t("pushPermissionDesc")}
        buttons={[
          { text: t("later"), style: "cancel" },
          {
            text: t("enableNotifications"),
            onPress: () => {
              void enableNotifications();
            },
          },
        ]}
        onDismiss={() => setNotificationPromptVisible(false)}
      />
      {/* Hiện modal xác nhận alert cho người thân (chỉ khi đã đăng nhập) */}
      {profile && <CaregiverAlertModal />}
    </SessionContext.Provider>
  );
};
