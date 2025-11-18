export type SmokeContext = {
  baseUrl: string;
  sessionId?: string;
  allowWrites: boolean;
  timeoutMs: number;
};

export type SmokeResult =
  | {
      id: string;
      name: string;
      status: "pass";
      details?: string;
    }
  | {
      id: string;
      name: string;
      status: "skip";
      details?: string;
    }
  | {
      id: string;
      name: string;
      status: "fail";
      error: Error;
    };

export type SmokeTest = {
  id: string;
  name: string;
  run: (ctx: SmokeContext) => Promise<SmokeResult>;
};
