import { useEffect, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { MedicationDraft } from "./useMedicationSetup";
import { v21Api, type MedPurposeLookup } from "./v21.api";

export function validatedMedicationPurposeResult(
  value: MedPurposeLookup,
): MedPurposeLookup {
  const unavailable: MedPurposeLookup = { status: "unavailable", tags: [] };
  const codes = new Set([
    "fever_reduction",
    "pain_relief",
    "blood_pressure",
    "diabetes",
    "lipids",
    "antibiotic",
    "allergy",
    "cough",
    "stomach",
  ]);
  if (
    !value ||
    ![
      "matched",
      "not_found",
      "ambiguous",
      "unavailable",
      "not_applicable",
    ].includes(value.status) ||
    !Array.isArray(value.tags) ||
    value.tags.some((code) => !codes.has(code))
  )
    return unavailable;
  if (value.status !== "matched") return { status: value.status, tags: [] };
  if (
    value.tags.length &&
    (typeof value.token !== "string" ||
      !value.token ||
      value.token.length > 4096 ||
      typeof value.productName !== "string" ||
      !value.productName ||
      typeof value.source?.name !== "string" ||
      !value.source.name)
  )
    return unavailable;
  if (value.source) {
    try {
      const url = new URL(value.source.url);
      if (url.protocol !== "https:" || url.username || url.password)
        return unavailable;
    } catch {
      return unavailable;
    }
  } else if (value.tags.length) return unavailable;
  // The HTTP response also has transport fields such as `ok`. Keep only the
  // domain fields accepted by the encrypted draft schema, including in source.
  return {
    status: value.status,
    tags: [...new Set(value.tags)],
    ...(value.productName !== undefined
      ? { productName: value.productName }
      : {}),
    ...(value.source
      ? { source: { name: value.source.name, url: value.source.url } }
      : {}),
    ...(value.checkedAt !== undefined ? { checkedAt: value.checkedAt } : {}),
    ...(value.token !== undefined ? { token: value.token } : {}),
  };
}

export const medicationPurposeKey = (
  item: Pick<MedicationDraft, "display_name" | "kind">,
) =>
  `${item.kind}:${item.display_name
    .trim()
    .normalize("NFC")
    .toLocaleLowerCase("vi")}`;

export function useMedicationPurposeLookup({
  enabled,
  patient,
  scopeKey,
  version,
  current,
  draft,
  setDraft,
}: {
  enabled: boolean;
  patient: number;
  scopeKey: string;
  version: number;
  current: (version: number) => boolean;
  draft: MedicationDraft[];
  setDraft: Dispatch<SetStateAction<MedicationDraft[]>>;
}) {
  const cache = useRef(new Map<string, Promise<MedPurposeLookup>>());
  useEffect(() => {
    cache.current.clear();
  }, [scopeKey]);
  useEffect(() => {
    if (!enabled || !current(version)) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const item of draft) {
      const name = item.display_name.trim();
      if (item.kind !== "MEDICINE" || name.length < 2 || !item.clientId)
        continue;
      const key = medicationPurposeKey(item);
      if (
        item.purposeLookup?.key === key &&
        (!item.purposeLookup.loading || item.purposeLookup.version === version)
      )
        continue;
      timers.push(
        setTimeout(() => {
          if (!current(version)) return;
          let request = cache.current.get(key);
          if (!request) {
            request = v21Api
              .lookupPurpose(patient, name, "MEDICINE")
              .then(validatedMedicationPurposeResult)
              .catch(() => ({ status: "unavailable" as const, tags: [] }));
            if (cache.current.size >= 60)
              cache.current.delete(cache.current.keys().next().value!);
            cache.current.set(key, request);
          }
          const update = (change: Partial<MedicationDraft>) => {
            if (current(version))
              setDraft((items) =>
                items.map((next) =>
                  next.clientId === item.clientId &&
                  medicationPurposeKey(next) === key
                    ? { ...next, ...change }
                    : next,
                ),
              );
          };
          update({
            purposeLookup: { key, loading: true, version },
            selectedPurposeCodes: [],
          });
          void request.then((result) =>
            update({
              purposeLookup: { key, loading: false, version, result },
              selectedPurposeCodes: result.tags,
              ...(result.tags.length ? { confirmed: false } : {}),
            }),
          );
        }, 450),
      );
    }
    return () => timers.forEach(clearTimeout);
  }, [enabled, patient, version, current, draft, setDraft]);
  return {
    pending:
      enabled &&
      draft.some(
        (item) =>
          item.kind === "MEDICINE" &&
          item.display_name.trim().length >= 2 &&
          (!item.purposeLookup?.result || item.purposeLookup.loading),
      ),
    retry: (item: MedicationDraft) => {
      if (!current(version)) return;
      cache.current.delete(medicationPurposeKey(item));
      setDraft((items) =>
        items.map((next) =>
          next.clientId === item.clientId
            ? {
                ...next,
                purposeLookup: undefined,
                selectedPurposeCodes: [],
                confirmed: false,
              }
            : next,
        ),
      );
    },
  };
}
