/**
 * Chat Notes — AI chat notes history
 */
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppAlertModal, useAppAlert } from '../../src/components/AppAlertModal';
import { ScaledText as Text } from '../../src/components/ScaledText';
import { chatApi } from '../../src/features/chat/chat.api';
import { useScaledTypography } from '../../src/hooks/useScaledTypography';
import { useLanguageStore } from '../../src/stores/language.store';
import { colors, radius, spacing } from '../../src/styles';

type Note = { id: number; message_text: string; created_at: string };

export default function ChatNotesScreen() {
  const { t } = useTranslation('common');
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { language } = useLanguageStore();
  const scaledTypography = useScaledTypography();
  const styles = useMemo(() => createStyles(scaledTypography), [scaledTypography]);

  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const { alertState, showAlert, dismissAlert } = useAppAlert();

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    try {
      const data = await chatApi.fetchNotes();
      setNotes(data);
    } catch {}
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchNotes();
    }, [fetchNotes])
  );

  const handleDelete = (note: Note) => {
    showAlert(
      t('deleteNoteTitle'),
      t('deleteNoteMsg'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await chatApi.deleteNote(note.id);
              setNotes((prev) => prev.filter((n) => n.id !== note.id));
            } catch {}
          },
        },
      ]
    );
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const locale = language === 'vi' ? 'vi-VN' : 'en-US';
    return d.toLocaleDateString(locale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <>
      <AppAlertModal {...alertState} onDismiss={dismissAlert} />
      <Stack.Screen
        options={{
          headerShown: true,
          title: t('chatNotesTitle'),
          headerStyle: { backgroundColor: colors.background },
          headerTitleStyle: { color: colors.textPrimary, fontWeight: '700' },
          headerShadowVisible: false,
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ padding: 10 }}>
              <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          ),
        }}
      />

      <FlatList
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 32 }]}
        data={notes}
        keyExtractor={(item) => String(item.id)}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyWrap}>
              <Ionicons name="bookmark-outline" size={48} color={colors.border} />
              <Text style={styles.emptyTitle}>{t('chatNotesEmpty')}</Text>
              <Text style={styles.emptyDesc}>{t('chatNotesEmptyHint')}</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={styles.noteCard}>
            <View style={styles.noteHeader}>
              <Ionicons name="bookmark" size={16} color={colors.premium} />
              <Text style={styles.noteDate}>{formatDate(item.created_at)}</Text>
              <Pressable
                style={styles.deleteBtn}
                onPress={() => handleDelete(item)}
                hitSlop={8}
              >
                <Ionicons name="trash-outline" size={16} color={colors.danger} />
              </Pressable>
            </View>
            <Text style={styles.noteText}>{item.message_text}</Text>
          </View>
        )}
      />
    </>
  );
}

function createStyles(typography: ReturnType<typeof useScaledTypography>) {
  return StyleSheet.create({
    list: {
      padding: spacing.lg,
      gap: spacing.md,
    },
    emptyWrap: {
      alignItems: 'center',
      paddingTop: 80,
      gap: spacing.sm,
    },
    emptyTitle: {
      fontSize: typography.size.md,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    emptyDesc: {
      fontSize: typography.size.sm,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 21,
      paddingHorizontal: spacing.xxl,
    },
    noteCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
      gap: spacing.sm,
    },
    noteHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    noteDate: {
      fontSize: typography.size.xs,
      color: colors.textSecondary,
      flex: 1,
    },
    deleteBtn: {
      padding: 4,
    },
    noteText: {
      fontSize: typography.size.sm,
      color: colors.textPrimary,
      lineHeight: 22,
    },
  });
}
