import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ScaledText as Text } from '../../components/ScaledText';
import type { CheckinCallContact as Contact } from './checkin-call.api';

export function CheckinCallContact({ subject }: { subject?: Contact | null }) {
  const { t } = useTranslation('checkinCall');
  return (
    <View style={styles.details}>
      <Text style={styles.label}>{t('contact.personToCheck')}</Text>
      {subject ? (
        <>
          <Text style={styles.name}>{subject.name}</Text>
          <Text style={styles.relationship}>{subject.relationship}</Text>
          <Text style={styles.label}>{t('contact.phone')}</Text>
          <Text selectable style={styles.phone}>{subject.phone_number || t('contact.phoneUnavailable')}</Text>
        </>
      ) : <Text style={styles.relationship}>{t('contact.unavailable')}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  details: { width: '100%', alignItems: 'center', gap: 5, marginVertical: 16 },
  label: { color: '#475569', fontSize: 13, textAlign: 'center' },
  name: { color: '#134e4a', fontSize: 22, fontWeight: '800', textAlign: 'center', flexShrink: 1 },
  relationship: { color: '#334155', fontSize: 16, fontWeight: '600', textAlign: 'center' },
  phone: { color: '#134e4a', fontSize: 19, fontWeight: '700', textAlign: 'center', flexShrink: 1 },
});
