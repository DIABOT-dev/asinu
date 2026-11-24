type AppEnv = "dev" | "staging" | "prod";

const rawEnv = (process.env.EXPO_PUBLIC_APP_ENV || "dev").toLowerCase();
const appEnv: AppEnv =
  rawEnv === "staging" || rawEnv === "prod" ? (rawEnv as AppEnv) : "dev";

export const isDevBuild = appEnv === "dev";
export const isStagingBuild = appEnv === "staging";
export const isProdBuild = appEnv === "prod";
// Automated interview calls and the preview gallery stay in local development.
export const isDoctorFeaturesEnabled: boolean =
  typeof __DEV__ !== "undefined" && __DEV__ && isDevBuild;
// Expert consultations and their in-app questionnaires are available in every build.
export const isExpertConsultationEnabled: boolean = true;
export const isAsinuAssistantEnabled: boolean = false;
// Temporarily hide the UI catalogue in every build, including development.
export const isCheckinUiGalleryEnabled: boolean = false;
// Hide test-only gift reopening in every build, even with an old local opt-in.
export const isCheckinGiftReplayEnabled: boolean = false;
export { appEnv };
