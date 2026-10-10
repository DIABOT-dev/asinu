import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Image,
  Pressable,
  ScrollView,
  RefreshControl,
  Share,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';

import { Screen } from '../../src/components/Screen';
import { ScaledText as Text } from '../../src/components/ScaledText';
import { ScreenBackButton } from '../../src/components/ScreenHeaderButton';
import { apiClient } from '../../src/lib/apiClient';
import { colors, spacing } from '../../src/styles';
import { useThemeColors } from '../../src/hooks/useThemeColors';
import { useGuardedRouter as useRouter } from '@/hooks/useGuardedRouter';
import { showToast } from '../../src/stores/toast.store';

async function healthFeedApi<T>(path: string, options?: any) {
  return apiClient<T>(`/api/health-feed${path}`, options);
}


type CuratedFeedItem = {
  id: string;
  titleKey: string;
  categoryKey: string;
  summaryKey: string;
  actionKey?: string;
  actionType: 'care_circle' | 'copy_questions' | 'share_family' | 'checkin' | 'details';
  iconType: 'family' | 'checklist' | 'chat' | 'schedule' | 'shield';
};

const CURATED_FEED_ITEMS: CuratedFeedItem[] = [
  {
    id: 'curated-1',
    titleKey: 'feedCurated1Title',
    categoryKey: 'feedCurated1Category',
    summaryKey: 'feedCurated1Summary',
    actionKey: 'feedOpenCareCircle',
    actionType: 'care_circle',
    iconType: 'family',
  },
  {
    id: 'curated-2',
    titleKey: 'feedCurated2Title',
    categoryKey: 'feedCurated2Category',
    summaryKey: 'feedCurated2Summary',
    actionKey: 'feedCopyQuestions',
    actionType: 'copy_questions',
    iconType: 'checklist',
  },
  {
    id: 'curated-3',
    titleKey: 'feedCurated3Title',
    categoryKey: 'feedCurated3Category',
    summaryKey: 'feedCurated3Summary',
    actionKey: 'feedShareFamilyAction',
    actionType: 'share_family',
    iconType: 'chat',
  },
  {
    id: 'curated-4',
    titleKey: 'feedCurated4Title',
    categoryKey: 'feedCurated4Category',
    summaryKey: 'feedCurated4Summary',
    actionKey: 'feedStartTracking',
    actionType: 'checkin',
    iconType: 'schedule',
  },
  {
    id: 'curated-5',
    titleKey: 'feedCurated5Title',
    categoryKey: 'feedCurated5Category',
    summaryKey: 'feedCurated5Summary',
    actionType: 'details',
    iconType: 'shield',
  },
];

export default function FeedListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t: tc } = useTranslation('common');
  const { isDark, colors: themeColors } = useThemeColors();
  const styles = useMemo(() => createStyles(isDark, themeColors), [isDark, themeColors]);

  const [activeTab, setActiveTab] = useState<'feed' | 'saved'>('feed');
  const [feedItems, setFeedItems] = useState<any[]>([]);
  const [savedItems, setSavedItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [enabled, setEnabled] = useState(true);

  const brandGreen = isDark ? '#2DD4BF' : '#0D9488';

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const feedRes = await healthFeedApi<any>('/feed');
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
      const savedRes = await healthFeedApi<any>('/saved');
      if (savedRes.ok && Array.isArray(savedRes.saved)) {
        setSavedItems(savedRes.saved);
      }
    } catch (err) {
      console.error('[Feed] Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleItemPress = async (item: any) => {
    try {
      if (item.content_id) {
        await healthFeedApi(`/feed/${item.id}/read`, { method: 'POST' });
        setFeedItems(prev =>
          prev.map(i => (i.id === item.id ? { ...i, read_at: new Date().toISOString() } : i))
        );
        healthFeedApi(`/event`, {
          method: 'POST',
          body: { content_id: item.content_id, event_type: 'viewed' },
        }).catch(() => {});
        router.push(`/feed/${item.content_id}` as any);
        return;
      }
    } catch {
      // Fallback
    }

    if (item.actionType === 'care_circle') {
      router.push('/care-circle' as any);
    } else if (item.actionType === 'checkin') {
      router.push('/checkin' as any);
    } else if (item.content_id || item.id) {
      router.push(`/feed/${item.content_id || item.id}` as any);
    }
  };

  const handleActionPress = async (item: any) => {
    if (item.actionType === 'care_circle') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      router.push('/care-circle' as any);
      return;
    }

    if (item.actionType === 'copy_questions') {
      const questionsText = [
        `📋 ${tc(item.titleKey)}`,
        '1. Hôm nay bố/mẹ ăn uống có ngon miệng không?',
        '2. Đêm qua bố/mẹ ngủ có tròn giấc không, có bị thức giấc giữa đêm không?',
        '3. Bố/mẹ có thấy mệt mỏi, hụt hơi hay đau nhức ở đâu không?',
        '4. Bố/mẹ đã uống thuốc đúng giờ theo đơn bác sĩ chưa?',
        '5. Hôm nay bố/mẹ có đi dạo hoặc vận động nhẹ nhàng không?',
        '',
        tc('feedShareFooter'),
      ].join('\n');

      try {
        await Clipboard.setStringAsync(questionsText);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showToast(tc('feedQuestionsCopied'), 'success');
      } catch {
        showToast(tc('contentCopyFailed'), 'error');
      }
      return;
    }

    if (item.actionType === 'share_family') {
      const shareMsg = `${tc(item.titleKey)}\n\n${tc('feedShareFamilyMessage')}\n\n${tc('feedShareFooter')}`;
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        await Share.share({ message: shareMsg });
      } catch {
        // Ignored
      }
      return;
    }

    if (item.actionType === 'checkin') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      router.push('/checkin' as any);
      return;
    }

    // Default: read details
    handleItemPress(item);
  };

  const getCardIcon = (type: string) => {
    switch (type) {
      case 'family':
      case 'family_note':
        return <MaterialCommunityIcons name="account-heart" size={26} color={brandGreen} />;
      case 'checklist':
        return <MaterialCommunityIcons name="calendar-check" size={25} color={brandGreen} />;
      case 'chat':
        return <Ionicons name="chatbubble-ellipses" size={24} color={brandGreen} />;
      case 'schedule':
      case 'weekly_summary':
        return <MaterialCommunityIcons name="calendar-clock" size={26} color={brandGreen} />;
      case 'shield':
      case 'warning':
        return <MaterialCommunityIcons name="shield-check" size={26} color={brandGreen} />;
      case 'article':
      default:
        return <MaterialCommunityIcons name="book-open-variant" size={25} color={brandGreen} />;
    }
  };

  const getFeedTypeLabel = (type: string) => {
    switch (type) {
      case 'checklist':
        return tc('feedTypeChecklist');
      case 'warning':
        return tc('feedTypeWarning');
      case 'family_note':
        return tc('feedTypeFamilyNote');
      case 'weekly_summary':
        return tc('feedTypeWeeklySummary');
      default:
        return tc('feedTypeAdvice');
    }
  };

  // Determine items to display in the feed tab
  const displayFeedItems = useMemo(() => {
    if (feedItems.length > 0) {
      return feedItems.map((item) => ({
        id: item.id,
        content_id: item.content_id,
        title: item.title,
        category: getFeedTypeLabel(item.feed_type),
        message: item.message,
        action_label: item.action_label || tc('feedReadDetails'),
        actionType: 'details',
        iconType: item.feed_type || 'article',
        read_at: item.read_at,
        severity_level: item.severity_level,
      }));
    }
    // Fallback to rich curated items from the design
    return CURATED_FEED_ITEMS.map((curated) => ({
      id: curated.id,
      title: tc(curated.titleKey),
      category: tc(curated.categoryKey),
      message: tc(curated.summaryKey),
      action_label: curated.actionKey ? tc(curated.actionKey) : undefined,
      actionType: curated.actionType,
      iconType: curated.iconType,
      read_at: null,
      titleKey: curated.titleKey,
    }));
  }, [feedItems, tc]);

  return (
    <Screen style={styles.screen}>
      {/* Header matching user design with app brand green */}
      <View style={[styles.headerContainer, { paddingTop: insets.top + spacing.xs }]}>
        <View style={styles.headerRow}>
          <ScreenBackButton onPress={() => router.back()} />
          <View style={styles.headerTextWrap}>
            <Text style={styles.headerTitle}>{tc('feedHeader')}</Text>
            <Text style={styles.headerSubtitle}>{tc('feedSubtitle')}</Text>
          </View>
          <View style={styles.headerDecoWrap}>
            <Image
              source={require('../../assets/asinu_chat_sticker.png')}
              style={styles.headerSticker}
              resizeMode="contain"
            />
          </View>
        </View>
      </View>

      {/* Segmented Tabs: "Bản tin" & "Ghi nhớ" */}
      <View style={styles.tabsCard}>
        <Pressable
          style={[styles.tab, activeTab === 'feed' && styles.activeTab]}
          onPress={() => setActiveTab('feed')}
        >
          <Ionicons
            name={activeTab === 'feed' ? 'newspaper' : 'newspaper-outline'}
            size={18}
            color={activeTab === 'feed' ? brandGreen : colors.textSecondary}
          />
          <Text style={[styles.tabText, activeTab === 'feed' && styles.activeTabText]}>
            {tc('feedTab')}
          </Text>
          {activeTab === 'feed' && <View style={styles.activeIndicator} />}
        </Pressable>

        <Pressable
          style={[styles.tab, activeTab === 'saved' && styles.activeTab]}
          onPress={() => setActiveTab('saved')}
        >
          <Ionicons
            name={activeTab === 'saved' ? 'bookmark' : 'bookmark-outline'}
            size={18}
            color={activeTab === 'saved' ? brandGreen : colors.textSecondary}
          />
          <Text style={[styles.tabText, activeTab === 'saved' && styles.activeTabText]}>
            {tc('savedTab')}
          </Text>
          {activeTab === 'saved' && <View style={styles.activeIndicator} />}
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
        {!enabled ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconBadge}>
              <Ionicons name="newspaper-outline" size={32} color={brandGreen} />
            </View>
            <Text style={styles.emptyTitle}>{tc('feedDisabledTitle')}</Text>
            <Text style={styles.emptySub}>{tc('feedDisabledDescription')}</Text>
          </View>
        ) : activeTab === 'feed' ? (
          displayFeedItems.map((item) => {
            const isRead = !!item.read_at;
            return (
              <Pressable
                key={item.id}
                style={({ pressed }) => [
                  styles.feedCard,
                  isRead && styles.feedCardRead,
                  pressed && { opacity: 0.94, transform: [{ scale: 0.995 }] },
                ]}
                onPress={() => handleItemPress(item)}
              >
                {/* Header row: Circular Icon Badge + (Title & Category) + Chevron */}
                <View style={styles.cardHeaderRow}>
                  <View style={styles.cardBadge}>{getCardIcon(item.iconType)}</View>
                  <View style={styles.cardHeaderInfo}>
                    <Text
                      style={[styles.cardTitle, isRead && styles.cardTitleRead]}
                      numberOfLines={2}
                    >
                      {item.title}
                    </Text>
                    <Text style={styles.cardCategory}>{item.category}</Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color="#94A3B8"
                    style={styles.chevron}
                  />
                </View>

                {/* Excerpt / Summary */}
                <Text
                  style={[styles.cardSummary, isRead && styles.cardSummaryRead]}
                  numberOfLines={3}
                >
                  {item.message}
                </Text>

                {/* Bottom Action Pill Button */}
                {item.action_label ? (
                  <Pressable
                    style={({ pressed }) => [
                      styles.actionPill,
                      pressed && { opacity: 0.8 },
                    ]}
                    onPress={() => handleActionPress(item)}
                  >
                    <Text style={styles.actionPillText}>{item.action_label}</Text>
                    <Ionicons name="chevron-forward" size={13} color={brandGreen} />
                  </Pressable>
                ) : null}
              </Pressable>
            );
          })
        ) : savedItems.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconBadge}>
              <Ionicons name="bookmark-outline" size={32} color={brandGreen} />
            </View>
            <Text style={styles.emptyTitle}>{tc('savedEmptyTitle')}</Text>
            <Text style={styles.emptySub}>{tc('savedEmptyDescription')}</Text>
          </View>
        ) : (
          savedItems.map((item) => (
            <Pressable
              key={item.id}
              style={({ pressed }) => [
                styles.feedCard,
                pressed && { opacity: 0.94, transform: [{ scale: 0.995 }] },
              ]}
              onPress={() => router.push(`/feed/${item.id}` as any)}
            >
              <View style={styles.cardHeaderRow}>
                <View style={styles.cardBadge}>
                  {getCardIcon(item.content_type || 'article')}
                </View>
                <View style={styles.cardHeaderInfo}>
                  <Text style={styles.cardTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text style={styles.cardCategory}>{tc('savedItemLabel')}</Text>
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

              <Pressable
                style={({ pressed }) => [
                  styles.actionPill,
                  pressed && { opacity: 0.8 },
                ]}
                onPress={() => router.push(`/feed/${item.id}` as any)}
              >
                <Text style={styles.actionPillText}>{tc('feedReadAgain')}</Text>
                <Ionicons name="chevron-forward" size={13} color={brandGreen} />
              </Pressable>
            </Pressable>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

function createStyles(isDark: boolean, themeColors: ReturnType<typeof useThemeColors>['colors']) {
  const brandGreen = isDark ? '#2DD4BF' : '#0D9488';
  const lightBadge = isDark ? 'rgba(13, 148, 136, 0.22)' : '#E6F7F5';
  const cardBorder = isDark ? themeColors.border : '#EBF6F3';

  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: isDark ? themeColors.background : '#F3FBF9',
    },
    headerContainer: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.sm,
      backgroundColor: isDark ? themeColors.background : '#F3FBF9',
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    headerTextWrap: {
      flex: 1,
      paddingLeft: spacing.xs,
    },
    headerTitle: {
      fontSize: 22,
      fontWeight: '800',
      color: themeColors.textPrimary,
      letterSpacing: -0.3,
    },
    headerSubtitle: {
      fontSize: 12.5,
      color: themeColors.textSecondary,
      lineHeight: 17,
      marginTop: 3,
    },
    headerDecoWrap: {
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: spacing.xs,
    },
    headerSticker: {
      width: 44,
      height: 44,
    },
    tabsCard: {
      flexDirection: 'row',
      backgroundColor: isDark ? themeColors.surface : '#FFFFFF',
      marginHorizontal: spacing.lg,
      marginTop: spacing.xs,
      marginBottom: spacing.md,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: cardBorder,
      shadowColor: '#0f172a',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.03,
      shadowRadius: 6,
      elevation: 2,
      overflow: 'hidden',
    },
    tab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      gap: 8,
      position: 'relative',
    },
    activeTab: {},
    tabText: {
      fontSize: 14.5,
      fontWeight: '600',
      color: themeColors.textSecondary,
    },
    activeTabText: {
      fontWeight: '700',
      color: brandGreen,
    },
    activeIndicator: {
      position: 'absolute',
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
      gap: 12,
    },
    feedCard: {
      backgroundColor: isDark ? themeColors.surface : '#FFFFFF',
      borderRadius: 20,
      padding: 16,
      borderWidth: 1,
      borderColor: cardBorder,
      shadowColor: '#0f172a',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.04,
      shadowRadius: 8,
      elevation: 2,
      marginBottom: spacing.xs,
    },
    feedCardRead: {
      opacity: 0.88,
      backgroundColor: isDark ? themeColors.surface : '#FAFDFB',
    },
    cardHeaderRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    cardBadge: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 2,
    },
    cardHeaderInfo: {
      flex: 1,
      marginLeft: 10,
      marginRight: 6,
    },
    cardTitle: {
      fontSize: 15.5,
      fontWeight: '700',
      color: themeColors.textPrimary,
      lineHeight: 21,
    },
    cardTitleRead: {
      color: themeColors.textSecondary,
    },
    cardCategory: {
      fontSize: 12,
      color: themeColors.textSecondary,
      marginTop: 3,
      fontWeight: '500',
    },
    chevron: {
      marginTop: 4,
    },
    cardSummary: {
      fontSize: 13.5,
      color: themeColors.textSecondary,
      lineHeight: 19.5,
      marginTop: 10,
      marginBottom: 12,
    },
    cardSummaryRead: {
      opacity: 0.9,
    },
    actionPill: {
      alignSelf: 'flex-start',
      backgroundColor: lightBadge,
      borderRadius: 18,
      paddingHorizontal: 14,
      paddingVertical: 7,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
    },
    actionPillText: {
      fontSize: 12.5,
      fontWeight: '600',
      color: brandGreen,
    },
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 70,
      paddingHorizontal: 32,
      gap: spacing.md,
    },
    emptyIconBadge: {
      width: 50,
      height: 50,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 6,
    },
    emptyTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: themeColors.textPrimary,
      textAlign: 'center',
    },
    emptySub: {
      fontSize: 14,
      color: themeColors.textSecondary,
      textAlign: 'center',
      lineHeight: 21,
    },
  });
}
