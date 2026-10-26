import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
export type PendingVoice = {
  owner: string;
  sessionId: string;
  uri: string;
  fields: Record<string, string>;
  createdAt: number;
};
const prefix = "@asinu/doctor-ivr-voice/";
const folder = () => `${FileSystem.documentDirectory}doctor-ivr-voice/`;
const key = (owner: string, id: string) =>
  `${prefix}${encodeURIComponent(owner)}/${id}`;
export async function savePendingVoice(
  owner: string,
  sessionId: string,
  source: string,
  fields: Record<string, string>
): Promise<PendingVoice> {
  await FileSystem.makeDirectoryAsync(folder(), { intermediates: true });
  const uri = `${folder()}${encodeURIComponent(owner)}-${fields.request_id}.${
    source.endsWith(".webm") ? "webm" : "m4a"
  }`;
  await FileSystem.copyAsync({ from: source, to: uri });
  const value = { owner, sessionId, uri, fields, createdAt: Date.now() };
  try {
    await AsyncStorage.setItem(
      key(owner, fields.request_id),
      JSON.stringify(value)
    );
  } catch (error) {
    await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
    throw error;
  }
  return value;
}
export async function listPendingVoices(owner: string, sessionId: string) {
  const keys = (await AsyncStorage.getAllKeys()).filter((v) =>
    v.startsWith(`${prefix}${encodeURIComponent(owner)}/`)
  );
  const values = await AsyncStorage.multiGet(keys),
    result: PendingVoice[] = [];
  for (const [, text] of values) {
    try {
      const value = JSON.parse(text || "null") as PendingVoice;
      if (value?.owner === owner && value.sessionId === sessionId)
        result.push(value);
    } catch {}
  }
  return result.sort((a, b) => a.createdAt - b.createdAt);
}
export async function removePendingVoice(value: PendingVoice) {
  await FileSystem.deleteAsync(value.uri, { idempotent: true });
  await AsyncStorage.removeItem(key(value.owner, value.fields.request_id));
}
export async function clearIvrVoiceQueue() {
  const keys = (await AsyncStorage.getAllKeys()).filter((v) =>
    v.startsWith(prefix)
  );
  if (keys.length) await AsyncStorage.multiRemove(keys);
  await FileSystem.deleteAsync(folder(), { idempotent: true });
}
