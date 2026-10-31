import AsyncStorage from "@react-native-async-storage/async-storage";
import { secureStorage } from "../../lib/secureStorage";

export type PendingMedicationAnswer = { button: number; id: string };
const legacyKey = (user: string, dose: string) => `@v21/answer/${user}/${dose}`;
const key = (user: string, dose: string) =>
  `v21_answer_${user}_${dose}`.replace(/[^a-zA-Z0-9_.-]/g, "_");
function parse(value: string | null): PendingMedicationAnswer | null {
  try {
    const x = JSON.parse(value || "null");
    return x &&
      [1, 2, 3].includes(x.button) &&
      typeof x.id === "string" &&
      /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(x.id)
      ? { button: x.button, id: x.id }
      : null;
  } catch {
    return null;
  }
}
export async function savePendingAnswer(
  user: string,
  dose: string,
  value: PendingMedicationAnswer
) {
  // A locked/unavailable keychain must not prevent a response. The backend also
  // enforces first-valid-answer semantics; never fall back to plaintext storage.
  await secureStorage
    .setItem(key(user, dose), JSON.stringify(value))
    .catch(() => {});
}
export async function loadPendingAnswer(user: string, dose: string) {
  const saved = parse(
    await secureStorage.getItem(key(user, dose)).catch(() => null)
  );
  const legacy = parse(
    await AsyncStorage.getItem(legacyKey(user, dose)).catch(() => null)
  );
  if (!saved && legacy) await savePendingAnswer(user, dose, legacy);
  await AsyncStorage.removeItem(legacyKey(user, dose)).catch(() => {});
  return saved || legacy;
}
export async function clearPendingAnswer(user: string, dose: string) {
  await Promise.allSettled([
    secureStorage.removeItem(key(user, dose)),
    AsyncStorage.removeItem(legacyKey(user, dose)),
  ]);
}
