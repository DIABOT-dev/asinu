import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { ScaledText as Text } from "../../components/ScaledText";
import { useAuthStore } from "../auth/auth.store";
import { useThemeColors } from "../../hooks/useThemeColors";
import { subscribeHealthAction } from "../../lib/health-action-events";
import { v21Api } from "./v21.api";
export function CoinEarnedHost() {
  const token = useAuthStore((s) => s.token),
    user = useAuthStore((s) => s.profile?.id),
    { colors } = useThemeColors(),
    { t } = useTranslation("v21");
  const opacity = useRef(new Animated.Value(0)).current,
    [earned, setEarned] = useState(0);
  useEffect(() => {
    setEarned(0);
    let active = true,
      enabled = false,
      balance: number | null = null,
      queue = Promise.resolve();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const read = async (announce: boolean) => {
      if (!active || !enabled || useAuthStore.getState().token !== token)
        return;
      try {
        const r = await v21Api.coins();
        if (!active || useAuthStore.getState().token !== token) return;
        const delta = balance === null ? 0 : r.balance - balance;
        balance = r.balance;
        if (announce && delta > 0) {
          setEarned(delta);
          opacity.stopAnimation();
          opacity.setValue(0);
          Animated.timing(opacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }).start();
          if (timer) clearTimeout(timer);
          timer = setTimeout(
            () =>
              Animated.timing(opacity, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
              }).start(),
            2200,
          );
        }
      } catch {}
    };
    queue = v21Api
      .flags()
      .then(async (f) => {
        enabled = f.coins;
        await read(false);
      })
      .catch(() => {});
    const unsubscribe = subscribeHealthAction(() => {
      queue = queue.then(() => read(true));
    });
    return () => {
      active = false;
      unsubscribe();
      if (timer) clearTimeout(timer);
      opacity.stopAnimation();
      opacity.setValue(0);
    };
  }, [token, user, opacity]);
  if (!earned) return null;
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={[
        styles.toast,
        {
          backgroundColor: colors.primaryText,
          opacity,
          transform: [
            {
              translateY: opacity.interpolate({
                inputRange: [0, 1],
                outputRange: [-12, 0],
              }),
            },
          ],
        },
      ]}
    >
      <Text
        style={{
          fontSize: 21,
          fontWeight: "700",
          textAlign: "center",
          color: colors.surface,
        }}
      >
        {t("coinsEarned", { count: earned })}
      </Text>
    </Animated.View>
  );
}
const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    top: 66,
    alignSelf: "center",
    maxWidth: "90%",
    paddingHorizontal: 22,
    paddingVertical: 18,
    borderRadius: 22,
    zIndex: 10000,
    elevation: 20,
  },
});
