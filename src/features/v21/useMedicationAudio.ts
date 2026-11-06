import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";
import { Audio } from "../../lib/audio";
import { createAndroidCallSound } from "../../lib/android-call-audio";
import { setVoipCallUIActive } from "../../lib/voip";
import { env } from "../../lib/env";
import { tokenStore } from "../../lib/tokenStore";
import {
  CheckinCallAudio,
  CallAudioState,
} from "../checkin-call/checkin-call.audio";
const fixed = {
  vi: {
    prompt: require("../../../assets/medication-audio/vi-prompt.wav"),
    taken: require("../../../assets/medication-audio/vi-taken.wav"),
    skipped: require("../../../assets/medication-audio/vi-skipped.wav"),
    out: require("../../../assets/medication-audio/vi-out.wav"),
    checkin: require("../../../assets/medication-audio/vi-checkin.wav"),
    consent: require("../../../assets/medication-audio/vi-consent.wav"),
  },
  en: {
    prompt: require("../../../assets/medication-audio/en-prompt.wav"),
    taken: require("../../../assets/medication-audio/en-taken.wav"),
    skipped: require("../../../assets/medication-audio/en-skipped.wav"),
    out: require("../../../assets/medication-audio/en-out.wav"),
    checkin: require("../../../assets/medication-audio/en-checkin.wav"),
    consent: require("../../../assets/medication-audio/en-consent.wav"),
  },
};
export type MedicationAudioPhase = keyof typeof fixed.vi;
export function useMedicationAudio(
  id: string,
  attemptId: string | undefined,
  deadline: string | undefined,
  language: string,
  consent = false,
) {
  const player = useRef<CheckinCallAudio | null>(null),
    context = useRef({ id, attemptId, deadline, language, consent });
  context.current = { id, attemptId, deadline, language, consent };
  const [state, setState] = useState<CallAudioState>({
    phase: "idle",
    prompt: null,
    fallback: false,
  });
  useEffect(() => {
    let native = false;
    const owner = new CheckinCallAudio({
      load: async (prompt) => {
        const ctx = context.current,
          lang = ctx.language.startsWith("en") ? "en" : "vi",
          phase = prompt.key as MedicationAudioPhase;
        try {
          const token = tokenStore.getToken();
          if (!token) throw new Error("No session");
          const url = `${env.apiBaseUrl}/api/mobile/${ctx.consent ? "med-schedules" : "med-doses"}/${encodeURIComponent(ctx.id)}/audio?phase=${phase}`;
          if (Platform.OS === "web") {
            const controller = new AbortController(),
              timer = setTimeout(() => controller.abort(), 12000);
            try {
              const response = await fetch(url, {
                headers: {
                  Authorization: `Bearer ${token}`,
                  "Accept-Language": lang,
                },
                signal: controller.signal,
              });
              if (!response.ok) throw new Error("Audio unavailable");
              return URL.createObjectURL(await response.blob());
            } finally {
              clearTimeout(timer);
            }
          }
          const path = `${FileSystem.cacheDirectory}medication-${lang}-${phase}.wav`;
          const job = FileSystem.createDownloadResumable(url, path, {
            headers: {
              Authorization: `Bearer ${token}`,
              "Accept-Language": lang,
            },
          });
          let timer: ReturnType<typeof setTimeout> | undefined;
          try {
            const result = await Promise.race([
              job.downloadAsync(),
              new Promise<never>((_resolve, reject) => {
                timer = setTimeout(() => {
                  void job.pauseAsync().catch(() => {});
                  reject(new Error("Audio timeout"));
                }, 12000);
              }),
            ]);
            if (!result || result.status !== 200)
              throw new Error("Audio unavailable");
            return result.uri;
          } finally {
            if (timer) clearTimeout(timer);
          }
        } catch {
          const asset = Asset.fromModule(fixed[lang][phase]);
          await asset.downloadAsync();
          return asset.localUri || asset.uri;
        }
      },
      prepare: async () => {
        const ctx = context.current;
        native = ctx.attemptId
          ? await setVoipCallUIActive(ctx.attemptId, true, ctx.deadline)
          : false;
        if (!native)
          await Audio.setAudioModeAsync({
            playsInSilentModeIOS: true,
            allowsRecordingIOS: false,
          });
      },
      create: async (uri) =>
        native && Platform.OS === "android" && context.current.attemptId
          ? createAndroidCallSound(context.current.attemptId, uri)
          : (
              await Audio.Sound.createAsync(
                { uri },
                { keepAudioSessionActive: native },
              )
            ).sound,
      stopSpeech: async () => {},
      allowDeviceSpeech: () => false,
      speak: (_p, callbacks) => callbacks.onError(),
      onState: setState,
    });
    player.current = owner;
    return () => {
      player.current = null;
      owner.dispose();
    };
  }, []);
  const play = useCallback(
    (phase: MedicationAudioPhase) =>
      player.current?.play({
        key: phase,
        text: phase,
        language: context.current.language.startsWith("en") ? "en" : "vi",
      }),
    [],
  );
  const stop = useCallback(
    () => player.current?.stop() || Promise.resolve(),
    [],
  );
  return { state, play, stop };
}
