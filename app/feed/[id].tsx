import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Pressable, ScrollView, ActivityIndicator, Share } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '../../src/components/Screen';
import { ScaledText as Text } from '../../src/components/ScaledText';
import { apiClient } from '../../src/lib/apiClient';
import { colors, spacing } from '../../src/styles';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useGuardedRouter as useRouter } from '@/hooks/useGuardedRouter';
import { showToast } from '../../src/stores/toast.store';
import { ScreenBackButton } from '../../src/components/ScreenHeaderButton';

async function healthFeedApi<T>(path: string, options?: any) {
  return apiClient<T>(`/api/health-feed${path}`, options);
}

function buildShareText(content: any) {
  let text = `${content.title}\n\n`;
  if (content.summary) text += `${content.summary}\n\n`;
  if (content.checklist && content.checklist.length > 0) {
    text += `Những việc cần lưu ý:\n`;
    content.checklist.forEach((item: string) => {
      text += `- ${item}\n`;
    });
    text += `\n`;
  }
  text += `(Chia sẻ từ ứng dụng sức khỏe Asinu)`;
  return text;
}

export default function ArticleDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { t: tc } = useTranslation('common');
  const [content, setContent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchArticle = async () => {
    try {
      const res = await healthFeedApi<any>(`/content/${id}`);
      if (res.ok && res.content) {
        setContent(res.content);
        healthFeedApi('/event', {
          method: 'POST',
          body: { content_id: String(id), event_type: 'viewed' }
        }).catch(() => {});
      }
    } catch (err) {
      console.error('[ArticleDetail] Failed to load:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArticle();
  }, [id]);

  const handleToggleSave = async () => {
    if (!content || saving) return;
    setSaving(true);
    const action = content.is_saved ? 'unsave' : 'save';
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const res = await healthFeedApi<any>(`/content/${id}/${action}`, { method: 'POST' });
      if (res.ok) {
        setContent((prev: any) => ({ ...prev, is_saved: !prev.is_saved }));
        showToast(content.is_saved ? tc('feedUnsaved') : tc('feedSaved'), 'success');
      } else {
        showToast(tc('feedActionFailed'), 'error');
      }
    } catch (err) {
      console.error('[ArticleDetail] Failed to toggle save:', err);
      showToast(tc('feedActionFailed'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = async () => {
    if (!content) return;
    const text = buildShareText(content);

    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await Clipboard.setStringAsync(text);
      showToast(tc('contentCopied'), 'success');
      // Track copy event
      healthFeedApi('/event', {
        method: 'POST',
        body: { content_id: String(id), event_type: 'copied' }
      }).catch(() => {});
    } catch (err) {
      console.error('[ArticleDetail] Copy failed:', err);
      showToast(tc('contentCopyFailed'), 'error');
    }
  };

  const handleShare = async () => {
    if (!content) return;
    let text = buildShareText(content);
    text += `\nTìm hiểu thêm trên Asinu: https://asinu.vn/`;

    try {
      const result = await Share.share({ message: text });
      if (result.action === Share.sharedAction) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showToast(tc('contentShared'), 'success');
        // Track share event
        healthFeedApi('/event', {
          method: 'POST',
          body: { content_id: String(id), event_type: 'shared' }
        }).catch(() => {});
      }
    } catch (err) {
      console.error('[ArticleDetail] Share failed:', err);
      showToast(tc('contentShareFailed'), 'error');
    }
  };

  if (loading) {
    return (
      <Screen style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </Screen>
    );
  }

  if (!content) {
    return (
      <Screen style={styles.loadingContainer}>
        <Text style={styles.errorText}>Không tìm thấy bài viết</Text>
        <ScreenBackButton onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <ScreenBackButton onPress={() => router.back()} />
        <Text style={styles.headerTitle} numberOfLines={1}>Chi tiết bản tin</Text>
        <Pressable onPress={handleToggleSave} style={styles.headerBtn} disabled={saving} hitSlop={12}>
          <Ionicons 
            name={content.is_saved ? "bookmark" : "bookmark-outline"} 
            size={24} 
            color={content.is_saved ? colors.primary : colors.textPrimary} 
          />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + spacing.xl }]} showsVerticalScrollIndicator={false}>
        {/* Article Type Badge */}
        <View style={[styles.badge, content.severity_level === 'warning' && styles.badgeHigh]}>
          <MaterialCommunityIcons
            name={content.content_type === 'warning' ? 'alert-circle-outline' : 'stethoscope'}
            size={16}
            color={content.content_type === 'warning' ? colors.danger : colors.primary}
          />
          <Text style={[styles.badgeText, content.severity_level === 'warning' && styles.badgeTextHigh]}>
            {content.content_type === 'warning' ? 'Cảnh báo khẩn' : 'Lời khuyên sức khỏe'}
          </Text>
        </View>

        {/* Title */}
        <Text style={styles.title}>{content.title}</Text>

        {/* Summary */}
        {content.summary && (
          <View style={styles.summaryContainer}>
            <Text style={styles.summaryText}>{content.summary}</Text>
          </View>
        )}

        {/* Body Text */}
        <Text style={styles.body}>{content.body}</Text>

        {/* Checklist Section */}
        {content.checklist && content.checklist.length > 0 && (
          <View style={styles.checklistSection}>
            <Text style={styles.checklistHeading}>Những việc cần thực hiện:</Text>
            {content.checklist.map((item: string, idx: number) => (
              <View key={idx} style={styles.checkItem}>
                <Ionicons name="checkmark-circle-outline" size={20} color={colors.primary} style={{ marginTop: 2 }} />
                <Text style={styles.checkText}>{item}</Text>
              </View>
            ))}
          </View>
        )}

        <Pressable
          style={styles.sourcesLink}
          onPress={() => router.push('/legal/sources' as any)}
        >
          <Ionicons name="book-outline" size={20} color={colors.primary} />
          <View style={styles.sourcesCopy}>
            <Text style={styles.sourcesTitle}>{tc('healthSourcesOpen')}</Text>
            <Text style={styles.sourcesHint}>{tc('healthSourcesArticleHint')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.primary} />
        </Pressable>

        {/* Actions Row */}
        <View style={styles.actionsRow}>
          <Pressable style={styles.actionButton} onPress={handleCopy}>
            <MaterialCommunityIcons name="content-copy" size={20} color={colors.primary} />
            <Text style={styles.actionBtnText}>Sao chép nội dung</Text>
          </Pressable>
          <Pressable style={[styles.actionButton, styles.shareBtn]} onPress={handleShare}>
            <Ionicons name="share-social-outline" size={20} color="#fff" />
            <Text style={[styles.actionBtnText, { color: '#fff' }]}>Chia sẻ gia đình</Text>
          </Pressable>
        </View>

      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
  },
  errorText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerBtn: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 12,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.md,
  },
  badgeHigh: {
    backgroundColor: 'transparent',
  },
  badgeText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  badgeTextHigh: {
    color: '#ef4444',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
    lineHeight: 28,
    marginBottom: spacing.md,
  },
  summaryContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  summaryText: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
    fontStyle: 'italic',
  },
  body: {
    fontSize: 15,
    color: colors.textPrimary,
    lineHeight: 24,
    marginBottom: spacing.lg,
  },
  checklistSection: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xl,
  },
  checklistHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: 12,
  },
  checkText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    flex: 1,
  },
  sourcesLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: '#f8fafc',
  },
  sourcesCopy: {
    flex: 1,
    gap: 2,
  },
  sourcesTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  sourcesHint: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 12,
  },
  shareBtn: {
    backgroundColor: colors.primary,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
});
