import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Pressable, ScrollView, ActivityIndicator, Share, Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '../../src/components/Screen';
import { ScaledText as Text } from '../../src/components/ScaledText';
import { apiClient } from '../../src/lib/apiClient';
import { colors, spacing } from '../../src/styles';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useGuardedRouter as useRouter } from '@/hooks/useGuardedRouter';

async function healthFeedApi<T>(path: string, options?: any) {
  return apiClient<T>(`/api/health-feed${path}`, options);
}

export default function ArticleDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
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
        Alert.alert(
          'Thành công',
          content.is_saved ? 'Đã bỏ lưu bản tin này!' : 'Đã lưu bản tin vào mục Ghi nhớ!'
        );
      }
    } catch (err) {
      console.error('[ArticleDetail] Failed to toggle save:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = async () => {
    if (!content) return;
    
    // Construct nice text template to share
    let text = `📢 ${content.title}\n\n`;
    if (content.summary) text += `${content.summary}\n\n`;
    if (content.checklist && content.checklist.length > 0) {
      text += `📝 Những việc cần lưu ý:\n`;
      content.checklist.forEach((item: string, idx: number) => {
        text += `- ${item}\n`;
      });
      text += `\n`;
    }
    text += `(Chia sẻ từ ứng dụng sức khỏe Asinu)`;

    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await Clipboard.setStringAsync(text);
      Alert.alert('Thành công', 'Đã sao chép nội dung gửi gia đình!');
      // Track copy event
      await healthFeedApi('/event', {
        method: 'POST',
        body: { content_id: String(id), event_type: 'copied' }
      });
    } catch (err) {
      console.error('[ArticleDetail] Copy failed:', err);
    }
  };

  const handleShare = async () => {
    if (!content) return;
    
    let text = `📢 ${content.title}\n\n`;
    if (content.summary) text += `${content.summary}\n\n`;
    if (content.checklist && content.checklist.length > 0) {
      text += `📝 Những việc cần lưu ý:\n`;
      content.checklist.forEach((item: string, idx: number) => {
        text += `- ${item}\n`;
      });
      text += `\n`;
    }
    text += `Tìm hiểu thêm trên Asinu: https://asinu.vn/`;

    try {
      const result = await Share.share({ message: text });
      if (result.action === Share.sharedAction) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        // Track share event
        await healthFeedApi('/event', {
          method: 'POST',
          body: { content_id: String(id), event_type: 'shared' }
        });
      }
    } catch (err) {
      console.error('[ArticleDetail] Share failed:', err);
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
        <Pressable onPress={() => router.back()} style={styles.backLink}>
          <Text style={styles.backLinkText}>Quay lại</Text>
        </Pressable>
      </Screen>
    );
  }

  return (
    <Screen style={{ backgroundColor: '#fff' }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} style={styles.headerBtn} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </Pressable>
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
          <Text style={[styles.badgeText, content.severity_level === 'warning' && styles.badgeTextHigh]}>
            {content.content_type === 'warning' ? '⚠️ Cảnh báo khẩn' : '🩺 Lời khuyên sức khỏe'}
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

        {/* Dynamic CTA at the bottom */}
        {content.cta_target && (
          <Pressable 
            style={styles.ctaButton} 
            onPress={() => {
              // Track CTA click
              healthFeedApi('/event', {
                method: 'POST',
                body: { content_id: String(id), event_type: 'cta_clicked' }
              }).catch(() => {});
              router.push(content.cta_target as any);
            }}
          >
            <Text style={styles.ctaBtnText}>{content.cta_label || 'Thực hiện ngay'}</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </Pressable>
        )}
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
  backLink: {
    padding: spacing.sm,
  },
  backLinkText: {
    color: colors.primary,
    fontWeight: '700',
  },
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
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: spacing.md,
  },
  badgeHigh: {
    backgroundColor: '#fee2e2',
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
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
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
    borderColor: '#e2e8f0',
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
    borderWidth: 1.5,
    borderColor: colors.primary,
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
  ctaButton: {
    backgroundColor: '#0f172a', // Deep navy
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 16,
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  ctaBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
