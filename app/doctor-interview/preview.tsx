import { Redirect } from "expo-router";
import { isCheckinUiGalleryEnabled } from "../../src/lib/appEnv";
import { DoctorIvrPreview } from "../../src/features/doctor-ivr/DoctorIvrPreview";

export default function DoctorIvrPreviewScreen() {
  if (!__DEV__ || !isCheckinUiGalleryEnabled)
    return <Redirect href="/(tabs)/profile" />;
  return <DoctorIvrPreview />;
}
