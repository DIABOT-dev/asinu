import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState, Linking } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useGlobalSearchParams, usePathname, useRootNavigationState } from "expo-router";
import { useGuardedRouter, useNavigationGuardObserver } from "../hooks/useGuardedRouter";
import { useGuidanceStore } from '../features/guidance/guidance.store';
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
  getNotificationPreferences,
  updateNotificationPreferences,
} from "../features/notifications/notifications.api";
import {
  addVoipCallAnsweredListener,
  addVoipCallEndedListener,
  addVoipTokenListener,
  getPendingVoipCall,
  getVoipRegistration,
  type VoipCallPayload,
  type VoipRegistration,
} from "../lib/voip";
import { CheckinCallHandoff } from "../features/checkin-call/checkin-call.handoff";
import { acceptCheckinCallOnce } from "../features/checkin-call/checkin-call.accept";

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
  useNavigationGuardObserver();
  const router = useGuardedRouter({ external: true });
  const { t } = useTranslation("settings");
  const bootstrap = useAuthStore((state) => state.bootstrap);
  const loading = useAuthStore((state) => state.loading);
  const hydrated = useAuthStore((state) => state.hydrated);
  const authToken = useAuthStore((state) => state.token);
  const profile = useAuthStore((state) => state.profile);
  const guidanceWelcomed = useGuidanceStore(state => state.account === String(profile?.id) && state.ready && state.progress.welcomeSeen);
  const pathname = usePathname();
  const navigationState = useRootNavigationState();
  const callParams = useGlobalSearchParams<{ attemptId?: string; nativeAnswered?: string }>();
  const callHandoff = useRef(new CheckinCallHandoff());
  const callRecoveryRevision = useRef(0);
  const callContext = useRef({ hydrated, authToken, loading, pathname, navigationState, callParams });
  callContext.current = { hydrated, authToken, loading, pathname, navigationState, callParams };
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
    if (!granted) {
      setExpoPushToken(null);
      setNativeFcmToken(null);
      if (authToken) {
        await authApi
          .updatePushToken(null, null, null, null, false, true)
          .catch(() => {});
      }
      return;
    }

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
  }, [authToken]);

  const enableNotifications = useCallback(async () => {
    let granted: boolean;
    try {
      granted = await requestNotificationPermissions();
    } catch {
      showToast(t("scheduleSaveError"), "error");
      return;
    }
    if (!granted) {
      showToast(t("notificationPermDesc"), "info");
      return;
    }

    // The OS sheet is closed now. Do not hold the modal queue during network
    // registration; urgent caregiver alerts must still be able to appear.
    void Promise.all([
      syncExistingPushToken(),
      updateNotificationPreferences({ reminders_enabled: true }),
    ])
      .then(() => showToast(t("scheduleSaved"), "success"))
      .catch(() => showToast(t("scheduleSaveError"), "error"));
  }, [syncExistingPushToken, t]);

  // Bootstrap belongs at the root so every entry route shares one session startup.
  useEffect(() => {
    setupNotificationHandler();
    void bootstrap();
  }, [bootstrap]);

  // Push registration needs the restored auth session, so run it after hydration.
  useEffect(() => {
    if (!hydrated) return;
    void syncExistingPushToken();
  }, [hydrated, syncExistingPushToken]);

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

  const flushVoipHandoff = useCallback(() => {
    const current = callContext.current;
    const action = callHandoff.current.route({
      ready: current.hydrated && !current.loading && Boolean(current.authToken && current.navigationState?.key),
      active: AppState.currentState === "active",
      pathname: current.pathname,
      attemptId: typeof current.callParams.attemptId === "string" ? current.callParams.attemptId : undefined,
      nativeAnswered: typeof current.callParams.nativeAnswered === "string" ? current.callParams.nativeAnswered : undefined,
    });
    if (!action) return;
    const params = { attemptId: action.call.attemptId, nativeAnswered: "1" };
    if (action.kind === "params") router.setParams(params);
    else {
      const route = { pathname: "/checkin-call/[episodeId]", params: { ...params, episodeId: action.call.episodeId } };
      if (action.kind === "replace") router.replace(route as any);
      else router.navigate(route as any);
    }
  }, [router]);

  const openVoipCall = useCallback((call: VoipCallPayload) => {
    callHandoff.current.receive(call);
    // Accept immediately after session recovery, even while the lock-screen
    // UI is still visible. Neither accepting nor opening the app is check-in.
    if (callContext.current.hydrated && callContext.current.authToken) {
      void acceptCheckinCallOnce(call.attemptId).catch(() => {});
    }
    flushVoipHandoff();
  }, [flushVoipHandoff]);

  useEffect(() => {
    flushVoipHandoff();
  }, [hydrated, authToken, loading, pathname, navigationState?.key, callParams.attemptId, callParams.nativeAnswered, flushVoipHandoff]);

  // Preserve events before hydration, retry the handoff on foreground, and
  // ignore a getter that completes after its call has ended or been replaced.
  useEffect(() => {
    let live = true;
    const recover = async () => {
      const requestRevision = callRecoveryRevision.current;
      const call = await getPendingVoipCall();
      if (live && requestRevision === callRecoveryRevision.current && call) openVoipCall(call);
    };
    const removeAnswer = addVoipCallAnsweredListener(call => {
      callRecoveryRevision.current++;
      openVoipCall(call);
    });
    const removeEnded = addVoipCallEndedListener(call => {
      callRecoveryRevision.current++;
      callHandoff.current.clear(call.attemptId);
    });
    const foreground = AppState.addEventListener("change", state => {
      if (state !== "active") return;
      callHandoff.current.foreground();
      void recover();
      flushVoipHandoff();
    });
    void recover();
    return () => { live = false; removeAnswer(); removeEnded(); foreground.remove(); };
  }, [openVoipCall, flushVoipHandoff]);

  // PushKit registration is independent from the regular notification prompt.
  // Token registration is independent of native call navigation.
  useEffect(() => {
    const removeToken = addVoipTokenListener((registration) => {
      setVoipRegistration(registration);
      if (!registration && authToken) {
        void authApi.updatePushToken(null, null, null, null, true).catch(() => {});
      }
    });
    return () => {
      removeToken();
    };
  }, [authToken, openVoipCall]);

  useEffect(() => {
    if (!hydrated || !authToken) return;
    let live = true;
    const requestRevision = callRecoveryRevision.current;
    void getPendingVoipCall().then((call) => {
      if (live && requestRevision === callRecoveryRevision.current
        && useAuthStore.getState().token === authToken && call) openVoipCall(call);
    });
    return () => { live = false; };
  }, [authToken, hydrated, openVoipCall]);

  // Ask once after sign-in, profile onboarding and the welcome role choice,
  // with an in-app explanation first.
  // This keeps push registration discoverable for care-circle alerts while
  // avoiding a native permission prompt on the login or onboarding screens.
  useEffect(() => {
    setNotificationPromptVisible(false);
    if (!hydrated || !authToken || profile?.onboardingCompleted !== true || !guidanceWelcomed) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Version the prompt because older builds only requested the OS permission
    // and forgot to opt the user into backend reminder delivery.
    const promptKey = `@asinu/notification_permission_prompted:v2:${profile.id}`;

    const prepareNotificationAccess = async () => {
      const [permissionGranted, preferences] = await Promise.all([
        checkNotificationPermission(),
        getNotificationPreferences().catch(() => null),
      ]);
      if (cancelled) return;

      if (permissionGranted) {
        await syncExistingPushToken();
        if (preferences?.reminders_enabled) return;
      }

      if (await AsyncStorage.getItem(promptKey)) return;
      if (cancelled) return;

      timer = setTimeout(() => {
        if (!cancelled) setNotificationPromptVisible(true);
      }, 1800);
    };

    void prepareNotificationAccess().catch(() => {});
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [
    authToken,
    hydrated,
    profile?.id,
    profile?.onboardingCompleted,
    guidanceWelcomed,
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

        // Refresh backing data before handling a route. Incoming check-in calls
        // return early below, so dispatching afterwards would leave the inbox
        // and health state stale while the app is open.
        dispatchRealtimeRefresh(type);

        if (data?.checkinCall === true && data?.kind === 'INCOMING_CALL') {
          const route = routeFromNotificationData(data);
          if (route) router.navigate(route as any);
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
        // ── TOAST in-app cho events quan trọng (không phải mọi type đều show
        // toast — tránh spam reminder routines).
        if (
          type === "care_circle_invitation" ||
          type === "care_circle_accepted" ||
          type === "care_circle_rejected" ||
          type === "care_circle_removed" ||
          type === "care_circle_permission_changed" ||
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
                  type === "wallet_topup_success" ||
                  type === "caregiver_confirmed"
                ? "success"
                : "info";
          showToast(body || title, toastType, 4000);
        }
      },
    );
    return () => sub.remove();
  }, [router]);

  // ── Notification deep link routing ──
  // Logic dùng chung ở src/lib/notifications.ts (routeFromNotificationData)
  // để in-app NotificationBell và push handler luôn route nhất quán.
  const handleNotificationRoute = useCallback(
    (data: Record<string, unknown>) => {
      const route = routeFromNotificationData(data);
      if (!route) {
        router.navigate("/(tabs)/home");
        return;
      }
      router.navigate(route as any);
    },
    [router],
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
        queued
        visible={notificationPromptVisible && pathname === "/home"}
        onShow={() => {
          // Mark only a presented prompt, never one merely waiting in the queue.
          void AsyncStorage.setItem(
            `@asinu/notification_permission_prompted:v2:${profile?.id}`,
            "1",
          ).catch(() => {});
        }}
        title={t("pushPermissionTitle")}
        message={t("pushPermissionDesc")}
        buttons={[
          { text: t("later"), style: "cancel" },
          {
            text: t("enableNotifications"),
            onPress: enableNotifications,
          },
        ]}
        onDismiss={() => setNotificationPromptVisible(false)}
      />
      {/* Hiện modal xác nhận alert cho người thân (chỉ khi đã đăng nhập) */}
      {profile && <CaregiverAlertModal />}
    </SessionContext.Provider>
  );
};
