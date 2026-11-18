import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Avatar } from '../../../components/Avatar';
import { ScaledText as Text } from '../../../components/ScaledText';
import { useThemeColors } from '../../../hooks/useThemeColors';

export type CircleMember = { id: string; name: string; avatarUrl?: string; relationship: string };

export function CareCircleMemberStrip({ members, selectedId, onSelect, onAdd }: {
  members: CircleMember[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
}) {
  const { t } = useTranslation('careCircle');
  const { colors, isDark } = useThemeColors();
  const selectedFill = isDark ? colors.primary : colors.primaryDark;
  const selectedInitials = isDark ? colors.background : colors.surface;
  return (
    <View testID="care-circle-member-strip" style={styles.section}>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.textPrimary }]}>{t('familyConnectionsTitle')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.members}>
        {members.map(member => {
          const selected = member.id === selectedId;
          return (
            <Pressable key={member.id} testID={`care-circle-select-${member.id}`} accessibilityRole="button"
              accessibilityLabel={`${member.name}, ${member.relationship}`} accessibilityState={{ selected }}
              onPress={() => onSelect(member.id)} style={styles.member}>
              <View style={[styles.avatarRing, { borderColor: selected ? colors.primary : colors.border }]}>
                <Avatar name={member.name} imageUrl={member.avatarUrl} size={76}
                  containerStyle={{ backgroundColor: selected ? selectedFill : colors.primaryLight, borderWidth: 0 }}
                  initialsStyle={{ fontSize: 26, color: selected ? selectedInitials : colors.primaryText }} />
              </View>
              <Text style={[styles.name, { color: colors.textPrimary }]}>{member.name}</Text>
              <Text style={[styles.relationship, { color: colors.textSecondary }]}>{member.relationship}</Text>
            </Pressable>
          );
        })}
        <Pressable testID="care-circle-strip-add" accessibilityRole="button" accessibilityLabel={t('addRelative')}
          onPress={onAdd} style={styles.member}>
          <View style={[styles.add, { borderColor: colors.primary }]}>
            <Ionicons name="add" size={36} color={colors.primary} accessible={false} />
          </View>
          <Text style={[styles.name, { color: colors.primaryText }]}>{t('addRelativeShort')}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: 8, paddingBottom: 16, gap: 20 },
  title: { fontSize: 24, fontWeight: '700', paddingHorizontal: 16 },
  members: { paddingHorizontal: 16, gap: 16, alignItems: 'flex-start' },
  member: { width: 104, alignItems: 'center', gap: 6, paddingBottom: 4, minHeight: 120 },
  avatarRing: { width: 88, height: 88, borderRadius: 44, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  name: { fontSize: 15, fontWeight: '700', textAlign: 'center', width: '100%' },
  relationship: { fontSize: 13, textAlign: 'center', width: '100%' },
  add: { width: 88, height: 88, borderRadius: 44, borderWidth: 2, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
});
