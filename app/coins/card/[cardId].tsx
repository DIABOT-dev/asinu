import { useCallback, useRef, useState } from "react";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { ActivityIndicator } from "react-native";
import { GreetingCard } from "../../../src/features/v21/GreetingCard";
import {
  v21Api,
  type FamilyGreetingCard,
} from "../../../src/features/v21/v21.api";
import { V21Layout, Note, Action } from "../../../src/features/v21/V21Layout";
import { useAuthStore } from "../../../src/features/auth/auth.store";
import { tokenStore } from "../../../src/lib/tokenStore";
import { useThemeColors } from "../../../src/hooks/useThemeColors";

export default function FamilyGreetingScreen() {
  const { cardId } = useLocalSearchParams<{ cardId: string }>();
  const { t } = useTranslation("v21");
  const { colors } = useThemeColors();
  const owner = useAuthStore((state) => state.profile?.id);
  const [snapshot, setSnapshot] = useState<{
    owner?: string;
    id: string;
    card: FamilyGreetingCard;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const generation = useRef(0);
  const load = useCallback(() => {
    const revision = ++generation.current;
    const token = tokenStore.getToken();
    let active = true;
    const current = () =>
      active &&
      revision === generation.current &&
      useAuthStore.getState().profile?.id === owner &&
      tokenStore.getToken() === token;
    setLoading(true);
    setSnapshot(null);
    if (!owner || !/^[0-9a-f-]{36}$/iu.test(cardId || "")) {
      setLoading(false);
      return () => {
        active = false;
      };
    }
    void v21Api
      .openCard(cardId)
      .then(({ card }) => {
        if (current()) setSnapshot({ owner, id: cardId, card });
      })
      .catch(() => {})
      .finally(() => {
        if (current()) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [owner, cardId]);
  useFocusEffect(
    useCallback(() => {
      const cleanup = load();
      return () => {
        cleanup();
        generation.current++;
      };
    }, [load]),
  );
  const card =
    snapshot && snapshot.owner === owner && snapshot.id === cardId
      ? snapshot.card
      : null;
  return (
    <V21Layout title={t("greetingTitle")}>
      {card ? (
        <>
          <GreetingCard template={card.template} senderName={card.senderName} />
          <Note>
            {t(
              card.status === "REFUNDED"
                ? "greetingRefunded"
                : card.isSender && card.status === "PENDING"
                  ? "greetingPending"
                  : "greetingReceived",
            )}
          </Note>
        </>
      ) : loading ? (
        <ActivityIndicator
          color={colors.primaryText}
          accessibilityLabel={t("loading")}
        />
      ) : (
        <>
          <Note>{t("greetingUnavailable")}</Note>
          <Action
            secondary
            label={t("retry")}
            onPress={() => {
              load();
            }}
          />
        </>
      )}
    </V21Layout>
  );
}
