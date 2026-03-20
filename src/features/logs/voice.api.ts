import { env } from '../../lib/env';
import { tokenStore } from '../../lib/tokenStore';

export type VoiceLogType = 'glucose' | 'blood_pressure' | 'insulin';

export type VoiceParsedGlucose = {
  log_type: 'glucose';
  value: number;
  context: 'fasting' | 'pre_meal' | 'post_meal' | 'before_sleep' | 'random';
  notes?: string;
};

export type VoiceParsedBloodPressure = {
  log_type: 'blood_pressure';
  systolic: number;
  diastolic: number;
  pulse?: number;
  notes?: string;
};

export type VoiceParsedInsulin = {
  log_type: 'insulin';
  insulin_type?: string;
  dose_units: number;
  timing?: 'pre_meal' | 'post_meal' | 'bedtime' | 'correction';
  injection_site?: string;
  notes?: string;
};

export type VoiceParseResult = {
  ok: boolean;
  transcript: string;
  parsed: VoiceParsedGlucose | VoiceParsedBloodPressure | VoiceParsedInsulin | null;
  error?: string;
};

export async function voiceParseLogs(
  audioUri: string,
  logType: VoiceLogType
): Promise<VoiceParseResult> {
  const token = tokenStore.getToken();

  const formData = new FormData();
  formData.append('audio', {
    uri: audioUri,
    type: 'audio/m4a',
    name: 'voice_log.m4a',
  } as any);
  formData.append('log_type', logType);

  const response = await fetch(`${env.apiBaseUrl}/api/logs/voice-parse`, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    let msg = `Request failed: ${response.status}`;
    try { msg = JSON.parse(text).error || msg; } catch {}
    throw new Error(msg);
  }

  return response.json();
}
