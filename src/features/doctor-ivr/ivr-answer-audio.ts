import { Asset } from "expo-asset";

// Fixed VieNeu recordings using the Asinu Tuấn Anh voice.
export const ivrAnswerAudio = {
  vi: {
    often: require("../../../assets/sounds/ivr-confirmation/vi-often.mp3"),
    sometimes: require("../../../assets/sounds/ivr-confirmation/vi-sometimes.mp3"),
    no: require("../../../assets/sounds/ivr-confirmation/vi-no.mp3"),
    normal: require("../../../assets/sounds/ivr-confirmation/vi-normal.mp3"),
    rest: require("../../../assets/sounds/ivr-confirmation/vi-rest.mp3"),
    stopped: require("../../../assets/sounds/ivr-confirmation/vi-stopped.mp3"),
    yes: require("../../../assets/sounds/ivr-confirmation/vi-yes.mp3"),
  },
  en: {
    often: require("../../../assets/sounds/ivr-confirmation/en-often.mp3"),
    sometimes: require("../../../assets/sounds/ivr-confirmation/en-sometimes.mp3"),
    no: require("../../../assets/sounds/ivr-confirmation/en-no.mp3"),
    normal: require("../../../assets/sounds/ivr-confirmation/en-normal.mp3"),
    rest: require("../../../assets/sounds/ivr-confirmation/en-rest.mp3"),
    stopped: require("../../../assets/sounds/ivr-confirmation/en-stopped.mp3"),
    yes: require("../../../assets/sounds/ivr-confirmation/en-yes.mp3"),
  },
};

export const ivrPromptAudio = {
  vi: {
    instruction: require("../../../assets/sounds/ivr-confirmation/vi-instruction.mp3"),
    skipped: require("../../../assets/sounds/ivr-confirmation/vi-skipped.mp3"),
    closing: require("../../../assets/sounds/ivr-confirmation/vi-closing.mp3"),
  },
  en: {
    instruction: require("../../../assets/sounds/ivr-confirmation/en-instruction.mp3"),
    skipped: require("../../../assets/sounds/ivr-confirmation/en-skipped.mp3"),
    closing: require("../../../assets/sounds/ivr-confirmation/en-closing.mp3"),
  },
};

export async function loadIvrAnswerAudio(source: number) {
  const asset = Asset.fromModule(source);
  await asset.downloadAsync();
  return asset.localUri || asset.uri;
}
