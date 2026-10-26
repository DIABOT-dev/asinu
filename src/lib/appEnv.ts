type AppEnv = "dev" | "staging" | "prod";

const rawEnv = (process.env.EXPO_PUBLIC_APP_ENV || "dev").toLowerCase();
const appEnv: AppEnv =
  rawEnv === "staging" || rawEnv === "prod" ? (rawEnv as AppEnv) : "dev";

export const isDevBuild = appEnv === "dev";
export const isStagingBuild = appEnv === "staging";
export const isProdBuild = appEnv === "prod";
// Temporarily hide Dr.Asinu entry points in every build. Keep the flows/data
// intact; this single flag can restore the buttons when the service reopens.
export const isDoctorFeaturesEnabled: boolean = false;
// Native UI previews are available only in a development runtime and environment.
export const isCheckinUiGalleryEnabled =
  typeof __DEV__ !== "undefined" && __DEV__ && isDevBuild;
export { appEnv };
