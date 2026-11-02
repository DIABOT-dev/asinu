import { scanFromURLAsync } from 'expo-camera';
import { File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { runNativePermission } from '../../lib/native-permissions';

export type QrImage = { toDataURL: (callback: (base64: string) => void, options?: object) => void };
export type QrMediaFailure = 'unavailable' | 'permission' | 'noCode' | 'multipleCodes' | 'invalidCode';
export class QrMediaError extends Error {
  constructor(public readonly reason: QrMediaFailure) { super(reason); }
}

export function tokenFromQr(value: string): string | null {
  const trimmed = value.trim();
  const valid = (token: unknown): token is string => typeof token === 'string' && /^[A-Za-z0-9_-]{32,256}$/.test(token);
  try {
    const token = Linking.parse(trimmed).queryParams?.token;
    if (valid(token)) {return token;}
  } catch {}
  return valid(trimmed) ? trimmed : null;
}

/** The system picker grants access to just the selected image; no library-wide read permission. */
export async function pickQrToken(isCurrent: () => boolean): Promise<string | null> {
  const result = await runNativePermission(() => ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'], allowsEditing: false, quality: 1,
  }), { key: 'care-circle-qr-picker', canRun: isCurrent });
  if (!isCurrent() || result.canceled) {return null;}
  const uri = result.assets?.[0]?.uri;
  if (!uri) {throw new QrMediaError('noCode');}
  // Decode locally. The photo is never sent to the server.
  const codes = await scanFromURLAsync(uri, ['qr']);
  if (!isCurrent()) {return null;}
  if (!codes.length) {throw new QrMediaError('noCode');}
  const tokens = [...new Set(codes.map(code => tokenFromQr(code.data)).filter((token): token is string => !!token))];
  if (!tokens.length) {throw new QrMediaError('invalidCode');}
  if (tokens.length > 1) {throw new QrMediaError('multipleCodes');}
  return tokens[0];
}

function exportPng(image: QrImage): Promise<string> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('QR image export timed out')), 8000);
    try {
      image.toDataURL(base64 => {
        clearTimeout(timeout);
        if (base64) {resolve(base64);} else {reject(new Error('Empty QR image'));}
      }, { width: 1024, height: 1024 });
    } catch (error) { clearTimeout(timeout); reject(error); }
  });
}

/** Add-only photo permission; works with older development builds without crashing at import time. */
export async function saveQrToPhotos(image: QrImage, isCurrent: () => boolean): Promise<boolean> {
  if (!isCurrent()) {return false;}
  if (!requireOptionalNativeModule('ExpoMediaLibraryNext')) {throw new QrMediaError('unavailable');}
  const media = await import('expo-media-library');
  if (!isCurrent()) {return false;}
  const permission = await runNativePermission(() => media.requestPermissionsAsync(true, []), {
    key: 'care-circle-save-qr', canRun: isCurrent,
  });
  if (!isCurrent()) {return false;}
  if (!permission.granted) {throw new QrMediaError('permission');}
  const base64 = await exportPng(image);
  if (!isCurrent()) {return false;}
  const file = new File(Paths.cache, `asinu-qr-${Date.now()}.png`);
  try {
    file.write(base64, { encoding: 'base64' });
    if (!isCurrent()) {return false;}
    await media.Asset.create(file.uri);
    return isCurrent();
  } finally {
    // A cleanup failure must not turn a successful photo save into a failed save.
    try { if (file.exists) {file.delete();} } catch {}
  }
}
