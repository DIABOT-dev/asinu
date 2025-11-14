export class RewardServiceError extends Error {
  code: string;
  status: number;
  meta?: Record<string, unknown>;

  constructor(code: string, message: string, status = 400, meta?: Record<string, unknown>) {
    super(message);
    this.name = "RewardServiceError";
    this.code = code;
    this.status = status;
    this.meta = meta;
  }
}
