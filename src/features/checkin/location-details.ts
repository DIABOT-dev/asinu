export type BodyLocation =
  | 'head'
  | 'chest'
  | 'abdomen'
  | 'limbs'
  | 'skin'
  | 'whole_body'
  | 'mental';
export type LocationDetails = Partial<Record<BodyLocation, string[]>>;
export type LocationDetailGroup = {
  location: BodyLocation;
  labelKey: string;
  positionKeys: string[];
};

export const LOCATION_DETAIL_GROUPS: LocationDetailGroup[] = [
  {
    location: 'head',
    labelKey: 'checkinLocationHead',
    positionKeys: [
      'forehead',
      'left_temple',
      'right_temple',
      'top_head',
      'back_head',
      'face_eyes_ears',
      'whole_head',
    ],
  },
  {
    location: 'chest',
    labelKey: 'checkinLocationChest',
    positionKeys: ['left_chest', 'right_chest', 'middle_chest', 'whole_chest'],
  },
  {
    location: 'abdomen',
    labelKey: 'checkinLocationAbdomen',
    positionKeys: [
      'upper_abdomen',
      'lower_abdomen',
      'left_abdomen',
      'right_abdomen',
      'whole_abdomen',
    ],
  },
  {
    location: 'limbs',
    labelKey: 'checkinLocationLimbs',
    positionKeys: [
      'left_arm',
      'right_arm',
      'left_elbow',
      'right_elbow',
      'left_wrist',
      'right_wrist',
      'left_hand',
      'right_hand',
      'left_leg_knee',
      'right_leg_knee',
      'left_ankle_foot',
      'right_ankle_foot',
    ],
  },
  {
    location: 'skin',
    labelKey: 'checkinLocationSkin',
    positionKeys: [
      'face_neck',
      'chest_abdomen_skin',
      'back_skin',
      'left_arm_skin',
      'right_arm_skin',
      'left_leg_skin',
      'right_leg_skin',
      'widespread_skin',
    ],
  },
].map((group) => ({
  ...group,
  location: group.location as BodyLocation,
  positionKeys: [...group.positionKeys, 'other_detail', 'uncertain'],
}));

export const locationDetailLabel = (key: string) =>
  `checkinLocationDetail_${key}`;

export function toggleLocationDetail(
  details: LocationDetails,
  location: BodyLocation,
  option: string
): LocationDetails {
  const group = LOCATION_DETAIL_GROUPS.find(
    (item) => item.location === location
  );
  if (!group?.positionKeys.includes(option)) {return details;}
  const current = details[location] || [];
  const exclusive = (value: string) =>
    [
      'uncertain',
      'other_detail',
      'whole_head',
      'whole_chest',
      'whole_abdomen',
      'widespread_skin',
    ].includes(value);
  const selected = current.includes(option)
    ? current.filter((item) => item !== option)
    : exclusive(option)
    ? [option]
    : [...current.filter((item) => !exclusive(item)), option];
  return { ...details, [location]: selected };
}

export function missingLocationDetails(
  locations: BodyLocation[],
  details: LocationDetails,
  other: string
): BodyLocation[] {
  return locations.filter((location) => {
    const group = LOCATION_DETAIL_GROUPS.find(
      (item) => item.location === location
    );
    if (!group) {return false;}
    const chosen = (details[location] || []).filter((key) =>
      group.positionKeys.includes(key)
    );
    return !chosen.length || (chosen.includes('other_detail') && !other.trim());
  });
}

export function formatLocationNotes(
  locations: BodyLocation[],
  details: LocationDetails,
  other: string,
  translate: (key: string) => string
): string {
  const notes = locations.flatMap((location) => {
    const group = LOCATION_DETAIL_GROUPS.find(
      (item) => item.location === location
    );
    if (!group) {return [];}
    const chosen = (details[location] || []).filter((key) =>
      group.positionKeys.includes(key)
    );
    return chosen.length
      ? [
          `${translate(group.labelKey)}: ${chosen
            .map((key) => translate(locationDetailLabel(key)))
            .join(', ')}`,
        ]
      : [];
  });
  return [...notes, other.trim()].filter(Boolean).join('; ');
}
