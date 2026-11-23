import { apiClient } from '../../lib/apiClient';
import { isExpertConsultationEnabled } from '../../lib/appEnv';
import { env } from '../../lib/env';

export type ConsultationTask = {
  tenant_id?: string;
  task_id: string;
  summary: string;
  status?: string | null;
  follow_up_until?: string | null;
  created_at: string;
  latest_message?: string | null;
  latest_sender_type?: 'patient' | 'doctor' | null;
  latest_message_at?: string | null;
};

const activeStatuses = new Set([
  'new',
  'queued',
  'assigned',
  'accepted',
  'started',
  'in_progress',
  'waiting_user',
  'waiting_approval',
  'waiting_doctor',
]);

export const isFollowUpOpen = (task: Pick<ConsultationTask, 'status' | 'follow_up_until'>) =>
  task.status === 'completed' && Date.parse(task.follow_up_until ?? '') > Date.now();

export const isOpenConsultation = (task: Pick<ConsultationTask, 'status' | 'follow_up_until'>) =>
  activeStatuses.has(task.status ?? '') || isFollowUpOpen(task);

type ClinicListResponse = { data?: { items: Array<{ tenant_id: string }> } };
type TaskListResponse = { data?: { tasks: ConsultationTask[] } };

export async function listConsultationTasks(signal?: AbortSignal) {
  if (!isExpertConsultationEnabled) return [];

  const clinics = await apiClient<ClinicListResponse>('/api/doctor/clinics', {
    method: 'POST',
    body: {},
    signal,
  }).catch(() => null);
  if (signal?.aborted) return [];

  const tenantIds = new Set([
    env.doctorTenantId,
    ...(clinics?.data?.items ?? []).map((clinic) => clinic.tenant_id),
  ].filter(Boolean));
  const responses = await Promise.allSettled(
    Array.from(tenantIds, async (tenantId) => {
      const result = await apiClient<TaskListResponse>(
        `/api/doctor/tasks?tenant_id=${encodeURIComponent(tenantId)}`,
        { signal, retry: { attempts: 3, initialDelayMs: 500, backoffFactor: 2 } },
      );
      return (result.data?.tasks ?? []).map((task) => ({
        ...task,
        tenant_id: task.tenant_id || tenantId,
      }));
    }),
  );
  if (responses.length && responses.every((response) => response.status === 'rejected')) {
    throw new Error('Consultation list unavailable');
  }
  const tasks = responses.flatMap((response) =>
    response.status === 'fulfilled' ? response.value : [],
  );
  return Array.from(new Map(tasks.map((task) => [task.task_id, task])).values()).sort(
    (left, right) =>
      Date.parse(right.latest_message_at || right.created_at) -
      Date.parse(left.latest_message_at || left.created_at),
  );
}
