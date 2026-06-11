import React, { useState, useCallback, useRef } from 'react';
import { StyleSheet, View, Pressable, ScrollView, RefreshControl } from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '../../src/components/Screen';
import { ScaledText as Text } from '../../src/components/ScaledText';
import { apiClient } from '../../src/lib/apiClient';
import { colors, spacing } from '../../src/styles';
import { useFocusEffect } from '@react-navigation/native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import * as Haptics from 'expo-haptics';
import { useGuardedRouter as useRouter } from '@/hooks/useGuardedRouter';

async function healthFeedApi<T>(path: string, options?: any) {
  return apiClient<T>(`/api/health-feed${path}`, options);
}

export default function FeedListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<'feed' | 'saved'>('feed');
  const [feedItems, setFeedItems] = useState<any[]>([]);
  const [savedItems, setSavedItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const swipeableRefs = useRef<Map<string, Swipeable>>(new Map());

  const loadData = async () => {
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
      if (feedRes.ok && feedRes.feed) {
        // Feed is already sorted by priority DESC, created_at DESC in backend service
        setFeedItems(feedRes.feed);
      }
      const savedRes = await healthFeedApi<any>('/saved');
      if (savedRes.ok && savedRes.saved) {
        setSavedItems(savedRes.saved);
      }
    } catch (err) {
      console.error('[Feed] Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleDismiss = async (itemId: string) => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await healthFeedApi(`/feed/${itemId}/dismiss`, { method: 'POST' });
      setFeedItems(prev => prev.filter(item => item.id !== itemId));
      swipeableRefs.current.delete(itemId);
    } catch (err) {
      console.error('[Feed] Failed to dismiss item:', err);
    }
  };

  const handleItemPress = async (item: any) => {
    try {
      // Mark as read in backend
      await healthFeedApi(`/feed/${item.id}/read`, { method: 'POST' });
      // Update local state to show read (opacity 60%)
      setFeedItems(prev =>
        prev.map(i => (i.id === item.id ? { ...i, read_at: new Date().toISOString() } : i))
      );
      // Track event
      healthFeedApi(`/event`, {
        method: 'POST',
        body: { content_id: item.content_id, event_type: 'viewed' }
      }).catch(() => {});
    } catch {}
    router.push(`/feed/${item.content_id}` as any);
  };

  const filteredFeed = feedItems;

  const getFeedIcon = (type: string) => {
    switch (type) {
      case 'checklist':
        return <Ionicons name="checkbox" size={24} color={colors.primary} />;
      case 'warning':
        return <Ionicons name="warning" size={24} color="#ef4444" />;
      case 'family_note':
        return <Ionicons name="people" size={24} color="#f97316" />;
      case 'weekly_summary':
        return <Ionicons name="stats-chart" size={24} color="#8b5cf6" />;
      case 'article':
      default:
        return <Ionicons name="book" size={24} color="#06b6d4" />;
    }
  };

  const renderRightActions = (itemId: string) => {
    return (
      <Pressable
        style={styles.dismissAction}
        onPress={() => handleDismiss(itemId)}
      >
        <Ionicons name="eye-off-outline" size={24} color="#fff" />
        <Text style={styles.dismissActionText}>Ẩn bản tin</Text>
      </Pressable>
    );
  };

  return (
    <Screen style={{ backgroundColor: '#f8fafc' }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Bản tin sức khỏe</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <Pressable 
          style={[styles.tab, activeTab === 'feed' && styles.activeTab]} 
          onPress={() => setActiveTab('feed')}
        >
          <Text style={[styles.tabText, activeTab === 'feed' && styles.activeTabText]}>Bản tin</Text>
        </Pressable>
        <Pressable 
          style={[styles.tab, activeTab === 'saved' && styles.activeTab]} 
          onPress={() => setActiveTab('saved')}
        >
          <Text style={[styles.tabText, activeTab === 'saved' && styles.activeTabText]}>Ghi nhớ</Text>
        </Pressable>
      </View>

      {/* Content List */}
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + spacing.xl }]}
        refreshControl={<RefreshControl refreshing={refreshing || loading} onRefresh={handleRefresh} colors={[colors.primary]} />}
        showsVerticalScrollIndicator={false}
      >
        {!enabled ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="newspaper-outline" size={48} color={colors.textSecondary} />
            </View>
            <Text style={styles.emptyTitle}>Health Feed đang tắt</Text>
            <Text style={styles.emptySub}>Khi backend bật lại tính năng này, các bản tin sức khỏe sẽ xuất hiện tại đây.</Text>
          </View>
        ) : activeTab !== 'saved' ? (
          filteredFeed.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconContainer}>
                <Ionicons name="newspaper-outline" size={48} color={colors.textSecondary} />
              </View>
              <Text style={styles.emptyTitle}>Chưa có bản tin mới</Text>
              <Text style={styles.emptySub}>Asinu sẽ gửi bài viết hướng dẫn chăm sóc cá nhân hóa phù hợp với sức khỏe của bác tại đây.</Text>
            </View>
          ) : (
            filteredFeed.map(item => {
              const isRead = !!item.read_at;
              const isWarning = item.severity_level === 'warning' || item.priority >= 100;
              return (
                <Swipeable
                  key={item.id}
                  ref={ref => {
                    if (ref) swipeableRefs.current.set(item.id, ref);
                    else swipeableRefs.current.delete(item.id);
                  }}
                  renderRightActions={() => renderRightActions(item.id)}
                  onSwipeableOpen={(direction) => {
                    if (direction === 'right') {
                      handleDismiss(item.id);
                    }
                  }}
                >
                  <Pressable
                    style={[
                      styles.feedCard,
                      isRead && styles.feedCardRead,
                      isWarning && styles.feedCardWarning
                    ]}
                    onPress={() => handleItemPress(item)}
                  >
                    <View style={styles.cardHeader}>
                      <View style={styles.iconAndTitle}>
                        <View style={styles.iconWrapper}>
                          {getFeedIcon(item.feed_type)}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.cardTitle, isRead && styles.cardTitleRead]} numberOfLines={1}>
                            {item.title}
                          </Text>
                          <Text style={styles.cardTypeLabel}>
                            {item.feed_type === 'checklist' && '✅ Checklist tự chăm sóc'}
                            {item.feed_type === 'warning' && '⚠️ Cảnh báo quan trọng'}
                            {item.feed_type === 'family_note' && '👨‍👩‍👧 Ghi chú gửi gia đình'}
                            {item.feed_type === 'weekly_summary' && '📊 Báo cáo tuần'}
                            {item.feed_type === 'article' && '📖 Lời khuyên sức khỏe'}
                          </Text>
                        </View>
                      </View>
                      
                      {isWarning && !isRead && <View style={styles.warningDot} />}
                    </View>
 
                    <Text style={[styles.cardSummary, isRead && styles.cardSummaryRead]} numberOfLines={2}>
                      {item.message}
                    </Text>
 
                    <View style={styles.cardFooter}>
                      <Text style={styles.ctaText}>{item.action_label || 'Đọc chi tiết'}</Text>
                      <Ionicons name="chevron-forward" size={16} color={colors.primary} />
                    </View>
                  </Pressable>
                </Swipeable>
              );
            })
          )
        ) : (
          savedItems.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconContainer}>
                <Ionicons name="bookmark-outline" size={48} color={colors.textSecondary} />
              </View>
              <Text style={styles.emptyTitle}>Mục ghi nhớ trống</Text>
              <Text style={styles.emptySub}>Hãy bấm biểu tượng Lưu trong các bản tin để lưu giữ các hướng dẫn sức khỏe quan trọng của bác tại đây.</Text>
            </View>
          ) : (
            savedItems.map(item => (
              <Pressable
                key={item.id}
                style={styles.feedCard}
                onPress={() => router.push(`/feed/${item.id}` as any)}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.iconAndTitle}>
                    <View style={styles.iconWrapper}>
                      {getFeedIcon(item.content_type)}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <Text style={styles.cardTypeLabel}>⭐ Đã lưu vào ghi nhớ</Text>
                    </View>
                  </View>
                </View>
                <Text style={styles.cardSummary} numberOfLines={2}>
                  {item.summary}
                </Text>
                <View style={styles.cardFooter}>
                  <Text style={styles.ctaText}>Đọc lại hướng dẫn</Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.primary} />
                </View>
              </Pressable>
            ))
          )
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  activeTabText: {
    color: colors.primary,
    fontWeight: '700',
  },
  scrollContent: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  feedCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: spacing.xs,
  },
  feedCardRead: {
    opacity: 0.65,
    backgroundColor: '#f8fafc',
  },
  feedCardWarning: {
    borderColor: '#fee2e2',
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  iconAndTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    lineHeight: 20,
  },
  cardTitleRead: {
    fontWeight: '600',
  },
  cardTypeLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
    fontWeight: '500',
  },
  warningDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
    alignSelf: 'center',
    marginLeft: 6,
  },
  cardSummary: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 12,
  },
  cardSummaryRead: {
    fontStyle: 'italic',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 10,
  },
  ctaText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  dismissAction: {
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
    width: 100,
    borderRadius: 18,
    height: '92%',
    marginLeft: 10,
    gap: 6,
  },
  dismissActionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
    gap: spacing.md,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  emptySub: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
