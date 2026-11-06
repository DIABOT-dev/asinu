import { useCallback, useRef, useState } from "react";
import { useCameraPermissions } from "expo-camera";
import { useFocusEffect } from "expo-router";
import { AppState, Linking } from "react-native";
import { runNativePermission } from "../../lib/native-permissions";

export function useQrCameraPermission(requestOnFocus = false) {
  const [permission, requestPermission, getPermission] = useCameraPermissions();
  const [pending, setPending] = useState(false);
  const focused = useRef(false);
  const busy = useRef(false);
  const generation = useRef(0);

  const change = useCallback(
    async (enabled: boolean) => {
      if (busy.current || !focused.current) return;
      busy.current = true;
      setPending(true);
      const currentGeneration = generation.current;
      const canRun = () =>
        focused.current && generation.current === currentGeneration;
      try {
        const current = await getPermission();
        if (!canRun()) return;
        if (enabled && !current.granted && current.canAskAgain) {
          await runNativePermission(requestPermission, {
            key: "camera",
            canRun,
          });
        } else if (!enabled || !current.granted) {
          // The OS owns camera permission. Revoking it requires device Settings.
          await runNativePermission(() => Linking.openSettings(), {
            key: "app-settings",
            settings: true,
            canRun,
          });
        }
        if (canRun()) await getPermission();
      } catch {
        // Keep the actual OS permission value; the user can retry or select a photo.
      } finally {
        busy.current = false;
        if (canRun()) setPending(false);
      }
    },
    [getPermission, requestPermission]
  );

  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      const currentGeneration = ++generation.current;
      const isCurrent = () =>
        focused.current && generation.current === currentGeneration;
      setPending(false);
      void getPermission()
        .then((current) => {
          if (
            isCurrent() &&
            requestOnFocus &&
            !current.granted &&
            current.canAskAgain
          ) {
            void change(true);
          }
        })
        .catch(() => {});
      const subscription = AppState.addEventListener("change", (state) => {
        if (state === "active" && isCurrent())
          void getPermission().catch(() => {});
      });
      return () => {
        focused.current = false;
        generation.current++;
        subscription.remove();
      };
    }, [change, getPermission, requestOnFocus])
  );

  return { permission, pending, change };
}
