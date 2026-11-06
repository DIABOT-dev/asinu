import React, { useState, useCallback, useMemo, useRef } from "react";
import {
  StyleSheet,
  View,
  Image,
  Pressable,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";

import { Screen } from "../../src/components/Screen";
import { ScaledText as Text } from "../../src/components/ScaledText";
import { ScreenBackButton } from "../../src/components/ScreenHeaderButton";
import { apiClient } from "../../src/lib/apiClient";
import { spacing } from "../../src/styles";
import { useThemeColors } from "../../src/hooks/useThemeColors";
import { useGuardedRouter as useRouter } from "@/hooks/useGuardedRouter";
import { HealthFeedThumbnail } from "../../src/features/health-feed/HealthFeedThumbnail";
import { useHealthFeedDismissals } from "../../src/features/health-feed/useHealthFeedDismissals";
import { useAuthStore } from "../../src/features/auth/auth.store";

async function healthFeedApi<T>(path: string, options?: any) {
  return apiClient<T>(`/api/health-feed${path}`, options);
}

type CuratedFeedItem = {
  id: string;
  titleKey: string;
  categoryKey: string;
  summaryKey: string;
  iconType: "family" | "checklist" | "chat" | "schedule" | "shield";
};

const CURATED_FEED_ITEMS: CuratedFeedItem[] = [
  {
    id: "curated-1",
    titleKey: "feedCurated1Title",
    categoryKey: "feedCurated1Category",
    summaryKey: "feedCurated1Summary",
    iconType: "family",
  },
  {
    id: "curated-2",
    titleKey: "feedCurated2Title",
    categoryKey: "feedCurated2Category",
    summaryKey: "feedCurated2Summary",
    iconType: "checklist",
  },
  {
    id: "curated-3",
    titleKey: "feedCurated3Title",
    categoryKey: "feedCurated3Category",
    summaryKey: "feedCurated3Summary",
    iconType: "chat",
  },
  {
    id: "curated-4",
    titleKey: "feedCurated4Title",
    categoryKey: "feedCurated4Category",
    summaryKey: "feedCurated4Summary",
    iconType: "schedule",
  },
  {
    id: "curated-5",
    titleKey: "feedCurated5Title",
    categoryKey: "feedCurated5Category",
    summaryKey: "feedCurated5Summary",
    iconType: "shield",
  },
];

export default function FeedListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t: tc } = useTranslation("common");
  const { isDark, colors: themeColors } = useThemeColors();
  const styles = useMemo(
    () => createStyles(isDark, themeColors),
    [isDark, themeColors],
  );
  const profileId = useAuthStore((state) => state.profile?.id);
  const token = useAuthStore((state) => state.token);
  const userId = String(profileId ?? "");
  const { hiddenIds, hydrated, canShowCurated } =
    useHealthFeedDismissals();
  const requestVersion = useRef(0);
  const dataOwner = useRef<{ userId: string; token: string | null } | null>(
    null,
  );
  const ownsData =
    dataOwner.current?.userId === userId && dataOwner.current?.token === token;

  const [activeTab, setActiveTab] = useState<"feed" | "saved">("feed");
  const [feedItems, setFeedItems] = useState<any[]>([]);
  const [savedItems, setSavedItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [enabled, setEnabled] = useState(true);

  const brandGreen = isDark ? "#2DD4BF" : "#0D9488";
  const isCurrentSession = useCallback(() => {
    const auth = useAuthStore.getState();
    return String(auth.profile?.id ?? "") === userId && auth.token === token;
  }, [userId, token]);

  const loadData = useCallback(async () => {
    if (!userId || !token) return;
    const version = ++requestVersion.current;
    const current = () =>
      version === requestVersion.current && isCurrentSession();
    if (
      dataOwner.current?.userId !== userId ||
      dataOwner.current?.token !== token
    ) {
      setFeedItems([]);
      setSavedItems([]);
      setEnabled(true);
    }
    dataOwner.current = { userId, token };
    setLoading(true);
    try {
      const feedRes = await healthFeedApi<any>("/feed");
      if (!current()) return;
      if (feedRes.ok && feedRes.enabled === false) {
        setEnabled(false);
        setFeedItems([]);
        setSavedItems([]);
        return;
      }
      setEnabled(true);
      if (feedRes.ok && Array.isArray(feedRes.feed)) {
        setFeedItems(feedRes.feed);
      }
      const savedRes = await healthFeedApi<any>("/saved");
      if (!current()) return;
      if (savedRes.ok && Array.isArray(savedRes.saved)) {
        setSavedItems(savedRes.saved);
      }
    } catch (err) {
      if (current()) console.warn("[Feed] Content unavailable");
    } finally {
      if (current()) setLoading(false);
    }
  }, [userId, token, isCurrentSession]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
      return () => {
        requestVersion.current += 1;
      };
    }, [loadData]),
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleItemPress = async (item: any) => {
    if (!isCurrentSession()) return;
    try {
      if (item.content_id) {
        await healthFeedApi(`/feed/${item.id}/read`, { method: "POST" });
        if (!isCurrentSession()) return;
        setFeedItems((prev) =>
          prev.map((i) =>
            i.id === item.id ? { ...i, read_at: new Date().toISOString() } : i,
          ),
        );
        healthFeedApi(`/event`, {
          method: "POST",
          body: { content_id: item.content_id, event_type: "viewed" },
        }).catch(() => {});
        router.push(`/feed/${item.content_id}` as any);
        return;
      }
    } catch {
      // Fallback
    }

    if (isCurrentSession() && (item.content_id || item.id)) {
      router.push(`/feed/${item.content_id || item.id}` as any);
    }
  };

  const getFeedTypeLabel = useCallback(
    (type: string) => {
      switch (type) {
        case "checklist":
          return tc("feedTypeChecklist");
        case "warning":
          return tc("feedTypeWarning");
        case "family_note":
          return tc("feedTypeFamilyNote");
        case "weekly_summary":
          return tc("feedTypeWeeklySummary");
        default:
          return tc("feedTypeAdvice");
      }
    },
    [tc],
  );

  // Determine items to display in the feed tab
  const displayFeedItems = useMemo(() => {
    if (!ownsData || !hydrated) return [];
    if (feedItems.length > 0) {
      return feedItems
        .filter((item) => !hiddenIds.has(String(item.id)))
        .map((item) => ({
          ...item,
          id: item.id,
          content_id: item.content_id,
          title: item.title,
          category: getFeedTypeLabel(item.feed_type),
          message: item.message,
          iconType: item.feed_type || "article",
          read_at: item.read_at,
          severity_level: item.severity_level,
        }));
    }
    if (!canShowCurated || loading) return [];
    return CURATED_FEED_ITEMS.filter((item) => !hiddenIds.has(item.id)).map(
      (curated) => ({
        id: curated.id,
        title: tc(curated.titleKey),
        category: tc(curated.categoryKey),
        message: tc(curated.summaryKey),
        iconType: curated.iconType,
        read_at: null,
      }),
    );
  }, [
    feedItems,
    tc,
    getFeedTypeLabel,
    hiddenIds,
    hydrated,
    canShowCurated,
    ownsData,
    loading,
  ]);
  const visibleSavedItems = ownsData ? savedItems : [];

  return (
    <Screen style={styles.screen}>
      {/* Header matching user design with app brand green */}
      <View
        style={[
          styles.headerContainer,
          { paddingTop: insets.top + spacing.xs },
        ]}
      >
        <View style={styles.headerRow}>
          <ScreenBackButton onPress={() => router.back()} />
          <View style={styles.headerTextWrap}>
            <Text style={styles.headerTitle}>{tc("feedHeader")}</Text>
          </View>
          <View style={styles.headerDecoWrap}>
            <Image
              source={require("../../assets/asinu_chat_sticker.png")}
              style={styles.headerSticker}
              resizeMode="contain"
            />
          </View>
        </View>
      </View>

      {/* Segmented Tabs: "Bản tin" & "Ghi nhớ" */}
      <View style={styles.tabs}>
        <Pressable
          style={styles.tab}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === "feed" }}
          onPress={() => setActiveTab("feed")}
        >
          <Ionicons
            name={activeTab === "feed" ? "newspaper" : "newspaper-outline"}
            size={18}
            color={
              activeTab === "feed" ? brandGreen : themeColors.textSecondary
            }
          />
          <Text
            style={[
              styles.tabText,
              activeTab === "feed" && styles.activeTabText,
            ]}
          >
            {tc("feedTab")}
          </Text>
          {activeTab === "feed" && <View style={styles.activeIndicator} />}
        </Pressable>

        <Pressable
          style={styles.tab}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === "saved" }}
          onPress={() => setActiveTab("saved")}
        >
          <Ionicons
            name={activeTab === "saved" ? "bookmark" : "bookmark-outline"}
            size={18}
            color={
              activeTab === "saved" ? brandGreen : themeColors.textSecondary
            }
          />
          <Text
            style={[
              styles.tabText,
              activeTab === "saved" && styles.activeTabText,
            ]}
          >
            {tc("savedTab")}
          </Text>
          {activeTab === "saved" && <View style={styles.activeIndicator} />}
        </Pressable>
      </View>

      {/* Main Content List */}
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + spacing.xl },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing || loading}
            onRefresh={handleRefresh}
            colors={[brandGreen]}
            tintColor={brandGreen}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {!enabled && ownsData ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconBadge}>
              <Ionicons name="newspaper-outline" size={32} color={brandGreen} />
            </View>
            <Text style={styles.emptyTitle}>{tc("feedDisabledTitle")}</Text>
            <Text style={styles.emptySub}>{tc("feedDisabledDescription")}</Text>
          </View>
        ) : activeTab === "feed" ? (
          displayFeedItems.length === 0 ? (
            <View style={styles.emptyContainer}>
              {loading || !hydrated || !ownsData ? (
                <ActivityIndicator color={brandGreen} />
              ) : (
                <>
                  <Ionicons
                    name="newspaper-outline"
                    size={32}
                    color={brandGreen}
                  />
                  <Text style={styles.emptyTitle}>{tc("feedEmptyTitle")}</Text>
                  <Text style={styles.emptySub}>
                    {tc("feedEmptyDescription")}
                  </Text>
                </>
              )}
            </View>
          ) : (
            displayFeedItems.map((item) => {
              const isRead = !!item.read_at;
              return (
                <View key={item.id} style={styles.articleRow}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={item.title}
                    accessibilityHint={tc("feedReadDetails")}
                    style={({ pressed }) => [
                      pressed && {
                        opacity: 0.94,
                        transform: [{ scale: 0.995 }],
                      },
                    ]}
                    onPress={() => handleItemPress(item)}
                  >
                    <View style={styles.cardHeaderRow}>
                      <HealthFeedThumbnail
                        item={item}
                        style={styles.articleThumbnail}
                      />
                      <View style={styles.cardHeaderInfo}>
                        <Text
                          style={[
                            styles.cardTitle,
                            isRead && styles.cardTitleRead,
                          ]}
                        >
                          {item.title}
                        </Text>
                        <Text style={styles.cardCategory}>{item.category}</Text>
                      </View>
                    </View>

                    {/* Excerpt / Summary */}
                    <Text
                      style={[
                        styles.cardSummary,
                        isRead && styles.cardSummaryRead,
                      ]}
                      numberOfLines={3}
                    >
                      {item.message}
                    </Text>
                  </Pressable>
                </View>
              );
            })
          )
        ) : visibleSavedItems.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconBadge}>
              <Ionicons name="bookmark-outline" size={32} color={brandGreen} />
            </View>
            <Text style={styles.emptyTitle}>{tc("savedEmptyTitle")}</Text>
            <Text style={styles.emptySub}>{tc("savedEmptyDescription")}</Text>
          </View>
        ) : (
          visibleSavedItems.map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityLabel={item.title}
              accessibilityHint={tc("feedReadAgain")}
              style={({ pressed }) => [
                styles.articleRow,
                pressed && { opacity: 0.94, transform: [{ scale: 0.995 }] },
              ]}
              onPress={() => router.push(`/feed/${item.id}` as any)}
            >
              <View style={styles.cardHeaderRow}>
                <HealthFeedThumbnail
                  item={item}
                  style={styles.articleThumbnail}
                />
                <View style={styles.cardHeaderInfo}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.cardCategory}>
                    {tc("savedItemLabel")}
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color="#94A3B8"
                  style={styles.chevron}
                />
              </View>

              <Text style={styles.cardSummary} numberOfLines={3}>
                {item.summary}
              </Text>
            </Pressable>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

function createStyles(
  isDark: boolean,
  themeColors: ReturnType<typeof useThemeColors>["colors"],
) {
  const brandGreen = isDark ? "#2DD4BF" : "#0D9488";

  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: isDark ? themeColors.background : "#F3FBF9",
    },
    headerContainer: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.sm,
      backgroundColor: isDark ? themeColors.background : "#F3FBF9",
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    headerTextWrap: {
      flex: 1,
      paddingLeft: spacing.xs,
    },
    headerTitle: {
      fontSize: 22,
      fontWeight: "800",
      color: themeColors.textPrimary,
      letterSpacing: -0.3,
    },
    headerDecoWrap: {
      alignItems: "center",
      justifyContent: "center",
      marginLeft: spacing.xs,
    },
    headerSticker: {
      width: 44,
      height: 44,
    },
    tabs: {
      flexDirection: "row",
      marginHorizontal: spacing.lg,
      marginTop: spacing.xs,
      marginBottom: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: themeColors.border,
    },
    tab: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 14,
      gap: 8,
      position: "relative",
    },
    tabText: {
      fontSize: 14.5,
      fontWeight: "600",
      color: themeColors.textSecondary,
    },
    activeTabText: {
      fontWeight: "700",
      color: brandGreen,
    },
    activeIndicator: {
      position: "absolute",
      bottom: 0,
      left: 12,
      right: 12,
      height: 3,
      borderRadius: 2,
      backgroundColor: brandGreen,
    },
    scrollContent: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xs,
    },
    articleRow: {
      paddingVertical: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: themeColors.border,
    },
    cardHeaderRow: {
      flexDirection: "row",
      alignItems: "flex-start",
    },
    articleThumbnail: {
      width: 88,
      height: 104,
      borderRadius: 12,
    },
    cardHeaderInfo: {
      flex: 1,
      marginLeft: 10,
      marginRight: 6,
    },
    cardTitle: {
      fontSize: 19,
      fontWeight: "700",
      color: themeColors.textPrimary,
      lineHeight: 28,
    },
    cardTitleRead: {
      color: themeColors.textSecondary,
    },
    cardCategory: {
      fontSize: 15,
      color: themeColors.textSecondary,
      marginTop: 3,
      fontWeight: "500",
    },
    chevron: {
      marginTop: 4,
    },
    cardSummary: {
      fontSize: 17,
      color: themeColors.textSecondary,
      lineHeight: 26,
      marginTop: 10,
    },
    cardSummaryRead: {
      opacity: 0.9,
    },
    emptyContainer: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 70,
      paddingHorizontal: 32,
      gap: spacing.md,
    },
    emptyIconBadge: {
      width: 50,
      height: 50,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 6,
    },
    emptyTitle: {
      fontSize: 17,
      fontWeight: "700",
      color: themeColors.textPrimary,
      textAlign: "center",
    },
    emptySub: {
      fontSize: 14,
      color: themeColors.textSecondary,
      textAlign: "center",
      lineHeight: 21,
    },
  });
}
