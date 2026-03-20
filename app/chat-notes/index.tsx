/**
 * Chat Notes — AI chat notes history
 */
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
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

type FilterMode = 'all' | '7days' | '30days' | 'custom';

/** Parse dd/mm/yyyy string into a Date (start of day) or null */
function parseDDMMYYYY(text: string): Date | null {
  const parts = text.trim().split('/');
  if (parts.length !== 3) return null;
  const [dd, mm, yyyy] = parts.map(Number);
  if (!dd || !mm || !yyyy || dd < 1 || dd > 31 || mm < 1 || mm > 12 || yyyy < 1900) return null;
  const d = new Date(yyyy, mm - 1, dd);
  if (isNaN(d.getTime())) return null;
  return d;
}

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

  // ── Date filter state ──────────────────────────────────
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [fromText, setFromText] = useState('');
  const [toText, setToText] = useState('');

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

  // ── Filtered notes ─────────────────────────────────────
  const filteredNotes = useMemo(() => {
    if (filterMode === 'all') return notes;

    let fromDate: Date | null = null;
    let toDate: Date | null = null;

    if (filterMode === '7days') {
      fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - 7);
      fromDate.setHours(0, 0, 0, 0);
    } else if (filterMode === '30days') {
      fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - 30);
      fromDate.setHours(0, 0, 0, 0);
    } else if (filterMode === 'custom') {
      fromDate = parseDDMMYYYY(fromText);
      toDate = parseDDMMYYYY(toText);
      if (toDate) {
        // Include the entire "to" day
        toDate.setHours(23, 59, 59, 999);
      }
      // If both are empty, show all
      if (!fromDate && !toDate) return notes;
    }

    return notes.filter((note) => {
      const noteDate = new Date(note.created_at);
      if (fromDate && noteDate < fromDate) return false;
      if (toDate && noteDate > toDate) return false;
      return true;
    });
  }, [notes, filterMode, fromText, toText]);

  const handleFilterChange = (mode: FilterMode) => {
    setFilterMode(mode);
    if (mode !== 'custom') {
      setFromText('');
      setToText('');
    }
  };

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

  const FILTERS: { key: FilterMode; label: string }[] = [
    { key: 'all', label: t('filterAll') },
    { key: '7days', label: t('filter7Days') },
    { key: '30days', label: t('filter30Days') },
    { key: 'custom', label: t('filterCustom') },
  ];

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
        data={filteredNotes}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={
          <View style={styles.filterContainer}>
            {/* ── Filter chips row ────────────────────────── */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
            >
              {FILTERS.map((f) => {
                const active = filterMode === f.key;
                return (
                  <Pressable
                    key={f.key}
                    style={[styles.filterChip, active && styles.filterChipActive]}
                    onPress={() => handleFilterChange(f.key)}
                  >
                    <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                      {f.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* ── Custom date inputs ─────────────────────── */}
            {filterMode === 'custom' && (
              <View style={styles.customDateRow}>
                <View style={styles.dateInputWrap}>
                  <Text style={styles.dateLabel}>{t('filterFrom')}</Text>
                  <TextInput
                    style={styles.dateInput}
                    placeholder={t('filterDateFormat')}
                    placeholderTextColor={colors.border}
                    value={fromText}
                    onChangeText={setFromText}
                    keyboardType="number-pad"
                    maxLength={10}
                  />
                </View>
                <View style={styles.dateSeparator}>
                  <Ionicons name="arrow-forward" size={16} color={colors.textSecondary} />
                </View>
                <View style={styles.dateInputWrap}>
                  <Text style={styles.dateLabel}>{t('filterTo')}</Text>
                  <TextInput
                    style={styles.dateInput}
                    placeholder={t('filterDateFormat')}
                    placeholderTextColor={colors.border}
                    value={toText}
                    onChangeText={setToText}
                    keyboardType="number-pad"
                    maxLength={10}
                  />
                </View>
              </View>
            )}
          </View>
        }
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
    /* ── Filter styles ────────────────────────────────── */
    filterContainer: {
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    filterRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    filterChip: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: radius.full,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    filterChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    filterChipText: {
      fontSize: typography.size.xs,
      color: colors.textSecondary,
      fontWeight: '600',
    },
    filterChipTextActive: {
      color: '#ffffff',
    },
    customDateRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: spacing.sm,
    },
    dateInputWrap: {
      flex: 1,
      gap: 4,
    },
    dateLabel: {
      fontSize: typography.size.xs,
      color: colors.textSecondary,
      fontWeight: '600',
    },
    dateInput: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      fontSize: typography.size.sm,
      color: colors.textPrimary,
    },
    dateSeparator: {
      paddingBottom: spacing.sm + 2,
    },
    /* ── Existing styles ──────────────────────────────── */
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
