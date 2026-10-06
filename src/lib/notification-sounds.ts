import manifest from '../config/notification-sounds.json';

export { manifest as notificationSoundManifest };
export type NotificationSoundGroup = keyof typeof manifest.groups;

/** Classify audio only: this does not change delivery, escalation or permissions. */
export function notificationSoundGroup(
  data: Record<string, unknown> = {}
): NotificationSoundGroup {
  const severity = String(data.severity || '').toUpperCase();
  if (data.type === 'checkin_call') {
    if (severity === 'URGENT' || data.kind === 'URGENT_REPEAT') {
      return 'alert';
    }
    if (['FALLBACK', 'MISSED_CALL'].includes(String(data.kind))) {
      return 'missed';
    }
    return 'incoming';
  }
  if (
    (data.type === 'early_signal' && severity === 'URGENT') ||
    data.alertType === 'emergency' ||
    data.requiresImmediate === true
  ) {
    return 'alert';
  }
  const types = manifest.types as Record<string, NotificationSoundGroup>;
  const type = String(data.type || '');
  return Object.hasOwn(types, type) ? types[type] : 'reminder';
}

export function notificationSoundConfig(
  data: Record<string, unknown> = {},
  platform = 'ios'
) {
  const group = notificationSoundGroup(data);
  const config = manifest.groups[group];
  const sound = manifest.sounds[config.sound as keyof typeof manifest.sounds];
  return { ...config, group, sound: platform === 'android' ? sound.android : sound.ios };
}
