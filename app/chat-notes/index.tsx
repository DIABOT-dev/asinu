import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScaledText as Text } from '../../src/components/ScaledText';
import { useModal } from '../../src/hooks/useModal';
import { chatApi } from '../../src/features/chat/chat.api';
import { useScaledTypography } from '../../src/hooks/useScaledTypography';
import { colors, radius, spacing } from '../../src/styles';

type Note = { id: number; message_text: string; created_at: string };

export default function ChatNotesScreen() {
  const { t } = useTranslation('chat');
  const { t: tc } = useTranslation('common');
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const typography = useScaledTypography();
  const styles = useMemo(() => createStyles(typography), [typography]);

  const { showConfirm, modal } = useModal();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadNotes = useCallback(async () => {
    try {
      const data = await chatApi.getNotes();
      setNotes(data);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadNotes(); }, [loadNotes]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadNotes();
  }, [loadNotes]);

  const handleDelete = useCallback((note: Note) => {
    showConfirm({
      title: t('noteDelete'),
      message: note.message_text.slice(0, 80) + (note.message_text.length > 80 ? '...' : ''),
      confirmLabel: t('noteDelete'),
      cancelLabel: tc('cancel'),
      destructive: true,
      onConfirm: async () => {
        setNotes(prev => prev.filter(n => n.id !== note.id));
        await chatApi.deleteNote(note.id).catch(() => {});
      },
    });
  }, [t, tc, showConfirm]);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <>
      {modal}
      <Stack.Screen options={{
        headerShown: true,
        title: t('notesTitle'),
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { color: colors.textPrimary, fontWeight: '700' },
        headerShadowVisible: false,
        headerLeft: () => (
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 10 }}>
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        ),
      }} />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={notes}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={[
            styles.list,
            notes.length === 0 && styles.emptyList,
            { paddingBottom: insets.bottom + 32 },
          ]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="bookmark-outline" size={52} color={colors.border} />
              <Text style={styles.emptyText}>{t('notesEmpty')}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <Ionicons name="bookmark" size={16} color={colors.primary} />
                <Text style={styles.cardDate}>{formatDate(item.created_at)}</Text>
                <Pressable
                  onPress={() => handleDelete(item)}
                  hitSlop={8}
                  style={styles.deleteBtn}
                >
                  <Ionicons name="trash-outline" size={18} color={colors.danger} />
                </Pressable>
              </View>
              <Text style={styles.cardText}>{item.message_text}</Text>
            </View>
          )}
        />
      )}
    </>
  );
}

function createStyles(typography: ReturnType<typeof useScaledTypography>) {
  return StyleSheet.create({
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
    list: { padding: spacing.lg, gap: spacing.md, backgroundColor: colors.background },
    emptyList: { flex: 1, justifyContent: 'center' },
    emptyWrap: { alignItems: 'center', gap: spacing.md },
    emptyText: {
      fontSize: typography.size.sm,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
      gap: spacing.sm,
    },
    cardTop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    cardDate: {
      flex: 1,
      fontSize: typography.size.xs,
      color: colors.textSecondary,
    },
    deleteBtn: {
      padding: 2,
    },
    cardText: {
      fontSize: typography.size.sm,
      color: colors.textPrimary,
      lineHeight: 22,
    },
  });
}
