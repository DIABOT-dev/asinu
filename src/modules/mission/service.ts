import { emitMissionDoneEvent, type MissionDoneEvent } from "@/lib/bridge";
import { awardTreePoints } from "@/modules/tree/service";
import { creditRewardPoints } from "@/modules/rewards/ledger";
import { createDbMissionRepository, getDbPoolClient, type MissionRepository } from "./repository";
import type { MissionCheckinResult, MissionStatus, MissionTodayPayload } from "./types";
import { determineMissionStatus, getDateKey, isDuplicateCheckin, summarizeMissions } from "./utils";

export class MissionNotFoundError extends Error {}

export class MissionLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MissionLimitError";
  }
}

export interface MissionServiceDeps {
  repo?: MissionRepository;
  now?: () => Date;
  emitMissionDone?: (payload: MissionDoneEvent) => Promise<unknown>;
}

const defaultRepo = createDbMissionRepository();

export function createMissionService(deps: MissionServiceDeps = {}) {
  const repo = deps.repo ?? defaultRepo;
  const now = deps.now ?? (() => new Date());
  const emitDone = deps.emitMissionDone ?? emitMissionDoneEvent;

  async function getTodayMissions(userId: string, refDate = now()): Promise<MissionTodayPayload> {
    const { key, start, end } = getDateKey(refDate);
    await repo.ensureAssignmentsForDate(userId, key);
    const missions = await repo.fetchTodayMissions(userId, key, { start, end });
    const summary = summarizeMissions(missions, key);
    return { missions, summary };
  }

  async function checkinMission(userId: string, missionId: string): Promise<MissionCheckinResult> {
    const refDate = now();
    const { key, start, end } = getDateKey(refDate);
    const client = await getDbPoolClient();
    let transactionStarted = false;
    let added = 0;
    let finalStatus: MissionStatus = "pending";
    let missionCode: string | undefined;
    let missionPoints = 0;

    try {
      await client.query("BEGIN");
      transactionStarted = true;

      const mission = await repo.getMissionById(missionId, client);
      if (!mission) {
        throw new MissionNotFoundError("Mission not found.");
      }
      missionCode = mission.code;
      missionPoints = mission.energy;

      await repo.ensureAssignmentForMission(userId, missionId, key, client);

      const todayCount = await repo.getTodayLogCount(userId, missionId, { start, end }, client);
      if (todayCount >= mission.max_per_day) {
        throw new MissionLimitError("Mission already completed for today.");
      }

      const lastTs = await repo.getLastLogTimestamp(userId, missionId, client);
      const duplicate = isDuplicateCheckin(lastTs, refDate);
      if (!duplicate) {
        await repo.insertMissionLog(
          { userId, missionId, ts: refDate, points: mission.energy, metadata: { trigger: "checkin" } },
          client,
        );
        added = 1;
      }

      const newCount = todayCount + added;
      finalStatus = determineMissionStatus(newCount, mission.max_per_day);

      await repo.updateUserMissionStatus(
        {
          userId,
          missionId,
          missionDate: key,
          status: finalStatus,
          completedAt: finalStatus === "done" ? refDate : null,
        },
        client,
      );

      await client.query("COMMIT");
      transactionStarted = false;
    } catch (error) {
      if (transactionStarted) {
        await client.query("ROLLBACK").catch(() => {});
      }
      throw error;
    } finally {
      client.release();
    }

    if (added > 0) {
      emitDone({
        userId,
        missionId,
        missionCode,
        points: missionPoints,
        ts: refDate.toISOString(),
      }).catch((error) => {
        console.warn("[mission] bridge emit failed", error);
      });

      awardTreePoints({
        userId,
        delta: missionPoints,
        reason: missionCode ? `mission:${missionCode}` : "mission",
        meta: { mission_id: missionId, mission_code: missionCode },
        idempotencyKey: `mission:${missionId}:${key}`,
      }).catch((error) => {
        console.warn("[tree] award mission points failed", error);
      });

      creditRewardPoints({
        userId,
        amount: missionPoints,
        reason: missionCode ? `mission:${missionCode}` : "mission",
        metadata: { mission_id: missionId, mission_code: missionCode },
        idempotencyKey: `mission:${missionId}:${key}`,
      }).catch((error) => {
        console.warn("[rewards] credit points failed", error);
      });
    }

    const today = await getTodayMissions(userId, refDate);
    return {
      mission_id: missionId,
      added,
      status: finalStatus,
      today_summary: today.summary,
    };
  }

  return {
    getTodayMissions,
    checkinMission,
  };
}

export const missionService = createMissionService();
