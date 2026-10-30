type AppEnv = "dev" | "staging" | "prod";

const rawEnv = (process.env.EXPO_PUBLIC_APP_ENV || "dev").toLowerCase();
const appEnv: AppEnv =
  rawEnv === "staging" || rawEnv === "prod" ? (rawEnv as AppEnv) : "dev";

export const isDevBuild = appEnv === "dev";
export const isStagingBuild = appEnv === "staging";
export const isProdBuild = appEnv === "prod";
// Legacy IVR/interview stays in local development; consultation has its own flag.
export const isDoctorFeaturesEnabled: boolean =
  typeof __DEV__ !== "undefined" && __DEV__ && isDevBuild;
// The SRS check-in conclusion links to real expert consultation in every build.
// Keep the separate IVR/interview rollout behind the existing development flag.
export const isExpertConsultationEnabled: boolean = true;
// Temporarily hide the UI catalogue in every build, including development.
export const isCheckinUiGalleryEnabled: boolean = false;
// Hide test-only gift reopening in every build, even with an old local opt-in.
export const isCheckinGiftReplayEnabled: boolean = false;
export { appEnv };
