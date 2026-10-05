import { useAuthStore } from '../auth/auth.store';
import { completeVoipCallAnswer } from '../../lib/voip';
import { checkinCallApi } from './checkin-call.api';
import { CheckinCallAcceptance } from './checkin-call.handoff';

const acceptance = new CheckinCallAcceptance(checkinCallApi.accept);

export async function acceptCheckinCallOnce(attemptId: string) {
  const session = useAuthStore.getState().token;
  try {
    const result = await acceptance.accept(attemptId, session);
    if (useAuthStore.getState().token !== session) throw new Error('Call session changed');
    await completeVoipCallAnswer(attemptId, true, result.confirm_deadline);
    return result;
  } catch (error) {
    if (useAuthStore.getState().token === session) await completeVoipCallAnswer(attemptId, false);
    throw error;
  }
}
