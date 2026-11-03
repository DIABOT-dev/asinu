import { Platform } from "react-native";
import { File, Paths } from "expo-file-system";
import { randomUUID } from "expo-crypto";
import type { ImagePickerAsset } from "expo-image-picker";

const MAX_BYTES = 10 * 1024 * 1024;
export class MedicationPhotoError extends Error {
  constructor(
    public readonly code:
      | "MED_LOCAL_PHOTO_UNREADABLE"
      | "MED_LOCAL_PHOTO_TOO_LARGE"
      | "MED_LOCAL_PHOTO_UNSUPPORTED"
  ) {
    super(code);
    this.name = "MedicationPhotoError";
  }
}
export type MedicationPhotoUpload = { body: FormData; dispose: () => void };

/** Keep an app-owned upload file until the request finishes, then remove it. */
export async function prepareMedicationPhoto(
  asset: ImagePickerAsset
): Promise<MedicationPhotoUpload> {
  if (Platform.OS === "web") {
    const response = asset.file ? null : await fetch(asset.uri);
    if (response && !response.ok)
      throw new MedicationPhotoError("MED_LOCAL_PHOTO_UNREADABLE");
    const blob = asset.file || (await response!.blob());
    if (!blob.size)
      throw new MedicationPhotoError("MED_LOCAL_PHOTO_UNREADABLE");
    if (blob.size > MAX_BYTES)
      throw new MedicationPhotoError("MED_LOCAL_PHOTO_TOO_LARGE");
    const extension = ({
      "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
    } as Record<string, string>)[blob.type.toLowerCase()];
    if (!extension)
      throw new MedicationPhotoError("MED_LOCAL_PHOTO_UNSUPPORTED");
    const body = new FormData();
    (body as any).append("image", blob, `medicine.${extension}`);
    return { body, dispose: () => {} };
  }
  // ImagePicker's native base64 export is JPEG. Also accept PNG/WebP from
  // compatible native clients; never label arbitrary bytes as a JPEG.
  const encoded = asset.base64;
  const format = encoded?.startsWith("/9j/")
    ? ["jpg", "image/jpeg"]
    : encoded?.startsWith("iVBORw0KGgo")
    ? ["png", "image/png"]
    : encoded?.startsWith("UklGR")
    ? ["webp", "image/webp"]
    : null;
  if (!encoded || !format)
    throw new MedicationPhotoError("MED_LOCAL_PHOTO_UNREADABLE");
  const padding = encoded.endsWith("==") ? 2 : encoded.endsWith("=") ? 1 : 0;
  if ((encoded.length * 3) / 4 - padding > MAX_BYTES)
    throw new MedicationPhotoError("MED_LOCAL_PHOTO_TOO_LARGE");
  const file = new File(
    Paths.cache,
    `asinu-medication-${randomUUID()}.${format[0]}`
  );
  const dispose = () => {
    try {
      if (file.exists) file.delete();
    } catch {
      /* Do not mask the upload result. */
    }
  };
  try {
    file.write(encoded, { encoding: "base64" });
    if (!file.exists || !file.size)
      throw new MedicationPhotoError("MED_LOCAL_PHOTO_UNREADABLE");
    if (file.size > MAX_BYTES)
      throw new MedicationPhotoError("MED_LOCAL_PHOTO_TOO_LARGE");
    const body = new FormData();
    body.append("image", {
      uri: file.uri,
      name: `medicine.${format[0]}`,
      type: format[1],
    } as any);
    return { body, dispose };
  } catch (error) {
    dispose();
    if (error instanceof MedicationPhotoError) throw error;
    throw new MedicationPhotoError("MED_LOCAL_PHOTO_UNREADABLE");
  }
}
