import catalog from "./data/vietnam-administrative-units.json";

export type AdministrativeWard = { code: string; name: string };
export type AdministrativeProvince = {
  code: string;
  name: string;
  wards: AdministrativeWard[];
};
export const administrativeProvinces: AdministrativeProvince[] =
  catalog.provinces;
export const provinceDisplayName = (name: string) =>
  name.replace(/^(Tỉnh|Thành phố)\s+/, "");
export const alphabeticProvinces = [...administrativeProvinces].sort((a, b) =>
  provinceDisplayName(a.name).localeCompare(provinceDisplayName(b.name), "vi")
);
const fold = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
const shortName = (value: string) =>
  fold(value).replace(/^(tinh|thanh pho|phuong|xa|dac khu)\s+/, "");
export function findProvince(code?: string, name?: string) {
  if (code)
    return administrativeProvinces.find((province) => province.code === code);
  return (
    administrativeProvinces.find(
      (province) => fold(province.name) === fold(name ?? "")
    ) ??
    administrativeProvinces.find(
      (province) => shortName(province.name) === shortName(name ?? "")
    )
  );
}
export function findWard(
  province: AdministrativeProvince | undefined,
  code?: string,
  name?: string
) {
  if (!province) return undefined;
  if (code) return province.wards.find((ward) => ward.code === code);
  const exact = province.wards.find(
    (ward) => fold(ward.name) === fold(name ?? "")
  );
  if (exact) return exact;
  const candidates = province.wards.filter(
    (ward) => shortName(ward.name) === shortName(name ?? "")
  );
  return candidates.length === 1 ? candidates[0] : undefined;
}
export const filterAdministrativeUnits = <T extends { name: string }>(
  items: T[],
  query: string
) => items.filter((item) => fold(item.name).includes(fold(query)));
