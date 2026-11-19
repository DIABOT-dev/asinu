import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Share, StyleSheet } from "react-native";
import { Redirect, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { Screen } from "../../src/components/Screen";
import { ScaledText as Text } from "../../src/components/ScaledText";
import { ScreenBackButton } from "../../src/components/ScreenHeaderButton";
import { apiClient } from "../../src/lib/apiClient";
import { useGuardedRouter } from "@/hooks/useGuardedRouter";
import { useAuthStore } from "../../src/features/auth/auth.store";
import { useThemeColors } from "../../src/hooks/useThemeColors";
import { showToast } from "../../src/stores/toast.store";
import { HealthArticleReading } from "../../src/features/health-feed/HealthArticleReading";
import {
  articleShareText,
  bundledHealthArticle,
  normalizeHealthArticle,
  type HealthArticle,
} from "../../src/features/health-feed/article-format";

export default function ArticleDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  const token = useAuthStore((state) => state.token);
  const hydrated = useAuthStore((state) => state.hydrated);
  const userId = useAuthStore((state) => state.profile?.id);
  const { colors } = useThemeColors();
  if (!hydrated)
    return (
      <Screen style={styles.center}>
        <ActivityIndicator color={colors.primaryText} />
      </Screen>
    );
  if (!token || !userId) return <Redirect href="/login" />;
  const articleId = (Array.isArray(id) ? id[0] : id) || "";
  return (
    <ArticleDetailScreen
      key={`${userId}:${articleId}`}
      articleId={articleId}
      userId={String(userId)}
    />
  );
}

export function ArticleDetailScreen({
  articleId,
  userId,
}: {
  articleId: string;
  userId: string;
}) {
  const router = useGuardedRouter();
  const { t, i18n } = useTranslation("common");
  const { colors } = useThemeColors();
  const [content, setContent] = useState<HealthArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);
  const mounted = useRef(true);
  const generation = useRef(0);
  const saveLock = useRef(false);
  const shareLock = useRef(false);
  const translate = useRef(t);
  translate.current = t;
  const current = useCallback(
    () =>
      mounted.current &&
      Boolean(useAuthStore.getState().token) &&
      String(useAuthStore.getState().profile?.id) === userId,
    [userId]
  );
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    generation.current++;
    const local = bundledHealthArticle(articleId, translate.current);
    setContent(local);
    setLoading(!local);
    setFailed(false);
    if (local || !current())
      return () => {
        active = false;
        controller.abort();
      };
    void (async () => {
      try {
        const response = await apiClient<{ ok: boolean; content?: unknown }>(
          `/api/health-feed/content/${encodeURIComponent(articleId)}`,
          { signal: controller.signal }
        );
        if (!active || !current()) return;
        const article = response.ok
          ? normalizeHealthArticle(response.content)
          : null;
        setContent(article?.id === articleId ? article : null);
        if (article?.id === articleId)
          void apiClient("/api/health-feed/event", {
            method: "POST",
            body: { content_id: articleId, event_type: "viewed" },
          }).catch(() => {});
      } catch (error) {
        if (active && current())
          setFailed(
            !(
              error &&
              typeof error === "object" &&
              "statusCode" in error &&
              error.statusCode === 404
            )
          );
      } finally {
        if (active && current()) setLoading(false);
      }
    })();
    return () => {
      active = false;
      controller.abort();
    };
  }, [articleId, userId, current, i18n.language, retry]);

  const track = (event: string) => {
    if (content && !content.localOnly && current())
      void apiClient("/api/health-feed/event", {
        method: "POST",
        body: { content_id: articleId, event_type: event },
      }).catch(() => {});
  };
  const handleSave = async () => {
    if (!content?.saveable || saveLock.current || !current()) return;
    saveLock.current = true;
    setSaving(true);
    const wanted = !content.is_saved,
      version = generation.current;
    try {
      const response = await apiClient<{ ok: boolean }>(
        `/api/health-feed/content/${encodeURIComponent(articleId)}/${
          wanted ? "save" : "unsave"
        }`,
        { method: "POST" }
      );
      if (!current() || version !== generation.current) return;
      if (!response.ok) throw new Error("ARTICLE_SAVE_FAILED");
      setContent((previous) =>
        previous ? { ...previous, is_saved: wanted } : previous
      );
      showToast(
        translate.current(wanted ? "feedSaved" : "feedUnsaved"),
        "success"
      );
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
        () => {}
      );
    } catch {
      if (current() && version === generation.current)
        showToast(translate.current("feedActionFailed"), "error");
    } finally {
      saveLock.current = false;
      if (current()) setSaving(false);
    }
  };
  const handleCopy = async () => {
    if (!content?.shareable || !current()) return;
    const version = generation.current;
    try {
      await Clipboard.setStringAsync(
        articleShareText(content, translate.current)
      );
      if (!current() || version !== generation.current) return;
      showToast(translate.current("contentCopied"), "success");
      track("copied");
    } catch {
      if (current() && version === generation.current)
        showToast(translate.current("contentCopyFailed"), "error");
    }
  };
  const handleShare = async () => {
    if (!content?.shareable || shareLock.current || !current()) return;
    shareLock.current = true;
    setSharing(true);
    const version = generation.current;
    try {
      const result = await Share.share({
        message: `${articleShareText(
          content,
          translate.current
        )}\n\n${translate.current("feedShareMore")}`,
      });
      if (!current() || version !== generation.current) return;
      if (result.action === Share.sharedAction) {
        showToast(translate.current("contentShared"), "success");
        track("shared");
      }
    } catch {
      if (current() && version === generation.current)
        showToast(translate.current("contentShareFailed"), "error");
    } finally {
      shareLock.current = false;
      if (current()) setSharing(false);
    }
  };

  if (loading)
    return (
      <Screen style={styles.center}>
        <ActivityIndicator color={colors.primaryText} />
      </Screen>
    );
  if (!content)
    return (
      <Screen style={styles.center}>
        <Text style={[styles.error, { color: colors.textSecondary }]}>
          {t(failed ? "feedArticleLoadFailed" : "feedNotFound")}
        </Text>
        {failed && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("retry")}
            onPress={() => setRetry((value) => value + 1)}
            style={styles.retry}
          >
            <Text style={{ color: colors.primaryText }}>{t("retry")}</Text>
          </Pressable>
        )}
        <ScreenBackButton onPress={() => router.back()} />
      </Screen>
    );
  return (
    <HealthArticleReading
      article={content}
      saving={saving}
      sharing={sharing}
      onBack={() => router.back()}
      onSave={() => void handleSave()}
      onCopy={() => void handleCopy()}
      onShare={() => void handleShare()}
      onSources={() => router.push("/legal/sources")}
    />
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    gap: 16,
  },
  error: { fontSize: 17, lineHeight: 27, textAlign: "center" },
  retry: { minHeight: 48, padding: 12, justifyContent: "center" },
});
