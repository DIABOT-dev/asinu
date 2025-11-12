export type TreeState = {
  user_id: string;
  level: number;
  total_points: number;
  e_day: number;
  streak: number;
  last_event_at: string | null;
  updated_at: string | null;
  next_level_points: number;
  daily_target: number;
};

export type AwardTreePointsInput = {
  userId: string;
  delta: number;
  reason: string;
  meta?: Record<string, unknown>;
  idempotencyKey?: string;
};
