import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NotificationIcon } from '../../../src/components/NotificationIcon';
import { ScaledText as Text } from '../../../src/components/ScaledText';
import { Screen } from '../../../src/components/Screen';
import { ScreenBackButton } from '../../../src/components/ScreenHeaderButton';
import { useAuthStore } from '../../../src/features/auth/auth.store';
import { careCircleApi, type MemberNotifications } from '../../../src/features/care-circle/care-circle.api';
import { useGuardedRouter } from '../../../src/hooks/useGuardedRouter';
import { useThemeColors } from '../../../src/hooks/useThemeColors';
import { ApiError } from '../../../src/lib/apiClient';
import { spacing } from '../../../src/styles';

type Inbox = { token: string; memberId: string; data: MemberNotifications };
type Failure = 'access' | 'loading' | 'pagination';

export default function MemberNotificationsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const token = useAuthStore(state => state.token);
  const router = useGuardedRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useThemeColors();
  const { t, i18n } = useTranslation('careCircle');
  const { t: tc } = useTranslation('common');
  const [inbox, setInbox] = useState<Inbox>();
  const [failure, setFailure] = useState<Failure>();
  const [busy, setBusy] = useState<'initial' | 'more'>();
  const request = useRef<AbortController>(null);
  const focused = useRef(false);

  const load = useCallback(async (before: number | null) => {
    if (!focused.current) return;
    if (!token || !id) {
      setFailure('access');
      return;
    }
    if (before !== null && request.current) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const isCurrent = () => request.current === controller && useAuthStore.getState().token === token;
    setFailure(undefined);
    setBusy(before === null ? 'initial' : 'more');
    if (before === null) setInbox(undefined);
    try {
      const data = await careCircleApi.getMemberNotifications(id, before, controller.signal);
      if (!isCurrent()) return;
      setInbox(previous => ({
        token, memberId: id,
        data: before !== null && previous?.token === token && previous.memberId === id
          ? { ...data, notifications: [...previous.data.notifications, ...data.notifications] } : data,
      }));
    } catch (error) {
      if (!isCurrent()) return;
      const inaccessible = error instanceof ApiError && [401, 403, 404].includes(error.statusCode);
      if (inaccessible) setInbox(undefined);
      setFailure(inaccessible ? 'access' : before === null ? 'loading' : 'pagination');
    } finally {
      if (isCurrent()) {
        request.current = null;
        setBusy(undefined);
      }
    }
  }, [id, token]);

  useFocusEffect(useCallback(() => {
    focused.current = true;
    void load(null);
    return () => {
      focused.current = false;
      request.current?.abort();
      request.current = null;
      setInbox(undefined);
      setBusy(undefined);
      setFailure(undefined);
    };
  }, [load]));

  const data = inbox && inbox.token === token && inbox.memberId === id ? inbox.data : undefined;
  const firstLoad = busy === 'initial' || (!data && !failure);
  const locale = i18n.language === 'en' ? 'en-US' : 'vi-VN';
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen style={{ paddingTop: insets.top }}>
        <View style={styles.header}>
          <ScreenBackButton onPress={() => router.back()} />
          <Text accessibilityRole="header" style={[styles.title, { color: colors.textPrimary }]}>
            {data?.memberName ? t('familyNotificationsOf', { name: data.memberName }) : t('familyNotifications')}
          </Text>
        </View>
        <FlatList
          data={data?.notifications ?? []}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + spacing.lg }]}
          refreshing={busy === 'initial'}
          onRefresh={() => void load(null)}
          renderItem={({ item }) => (
            <View style={[styles.item, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <NotificationIcon type={item.type} size={26} />
              <View style={styles.copy}>
                <Text style={[styles.itemTitle, { color: colors.textPrimary }]}>{item.title}</Text>
                <Text style={[styles.body, { color: colors.textSecondary }]}>{item.message}</Text>
                <Text style={[styles.timestamp, { color: colors.textSecondary }]}>
                  {new Date(item.created_at).toLocaleString(locale, {
                    day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
                  })}
                </Text>
              </View>
            </View>
          )}
          ListEmptyComponent={!firstLoad ? (
            <View style={[styles.notice, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.body, { color: colors.textSecondary }]}>
                {failure === 'access' ? t('familyNotificationsAccessRequired')
                  : failure === 'loading' ? tc('notificationLoadFailed') : t('familyNotificationsEmpty')}
              </Text>
              {failure === 'loading' && <Pressable accessibilityRole="button" style={styles.button}
                onPress={() => void load(null)}>
                <Text style={{ color: colors.primaryText }}>{tc('retry')}</Text>
              </Pressable>}
            </View>
          ) : null}
          ListFooterComponent={data?.nextBefore != null ? (
            <Pressable accessibilityRole="button" style={styles.button}
              disabled={busy === 'more'} accessibilityState={{ busy: busy === 'more', disabled: busy === 'more' }}
              onPress={() => void load(data.nextBefore)}>
              {busy === 'more' ? <ActivityIndicator color={colors.primaryText} /> : (
                <Text style={{ color: colors.primaryText }}>
                  {failure === 'pagination' ? tc('retry') : t('familyNotificationsMore')}
                </Text>
              )}
            </Pressable>
          ) : null}
        />
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  header: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginHorizontal: spacing.lg, paddingVertical: spacing.sm },
  title: { flex: 1, fontSize: 21, fontWeight: '700' },
  list: { flexGrow: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.sm },
  item: { flexDirection: 'row', alignItems: 'flex-start', borderRadius: 18, borderWidth: 1, padding: spacing.md, gap: spacing.md },
  copy: { flex: 1, minWidth: 0, gap: spacing.xs },
  itemTitle: { fontSize: 16, fontWeight: '700' },
  body: { fontSize: 14 },
  timestamp: { fontSize: 12 },
  notice: { borderRadius: 18, borderWidth: 1, padding: spacing.lg },
  button: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
});
