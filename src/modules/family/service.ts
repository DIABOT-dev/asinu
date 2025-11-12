import { query } from "@/lib/db_client";

const RELATION_TYPES = [
  "father",
  "mother",
  "son",
  "daughter",
  "husband",
  "wife",
  "brother",
  "sister",
  "grandfather",
  "grandmother",
  "grandson",
  "granddaughter",
  "uncle",
  "aunt",
  "cousin",
  "other",
] as const;

const RELATIVE_ROLES = ["viewer", "editor"] as const;

export type RelationType = (typeof RELATION_TYPES)[number];
export type RelativeRole = (typeof RELATIVE_ROLES)[number];

export type RelativeLink = {
  id: string;
  owner_user_id: string;
  relative_user_id: string;
  relation: RelationType;
  role: RelativeRole;
  created_at: string;
  profile: {
    user_id: string;
    display_name: string | null;
    email: string | null;
    phone: string | null;
  };
};

export class FamilyServiceError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "FamilyServiceError";
    this.status = status;
  }
}

export const familyService = {
  isValidRelation(relation: string): relation is RelationType {
    return RELATION_TYPES.includes(relation as RelationType);
  },
  isValidRole(role: string): role is RelativeRole {
    return RELATIVE_ROLES.includes(role as RelativeRole);
  },
  async ensureUserExists(userId: string) {
    const res = await query<{ user_id: string }>("SELECT user_id FROM app_user WHERE user_id = $1", [userId]);
    if (res.rowCount === 0) {
      throw new FamilyServiceError("USER_NOT_FOUND", 404);
    }
  },
  async listRelatives(ownerId: string): Promise<RelativeLink[]> {
    const res = await query(
      `SELECT r.*, u.display_name, u.email, u.phone
       FROM relatives r
       JOIN app_user u ON u.user_id = r.relative_user_id
       WHERE r.owner_user_id = $1
       ORDER BY r.created_at ASC`,
      [ownerId],
    );
    return res.rows.map((row: any) => ({
      id: row.id,
      owner_user_id: row.owner_user_id,
      relative_user_id: row.relative_user_id,
      relation: row.relation,
      role: row.role,
      created_at: row.created_at,
      profile: {
        user_id: row.relative_user_id,
        display_name: row.display_name,
        email: row.email,
        phone: row.phone,
      },
    }));
  },
  async addRelative(ownerId: string, relativeId: string, relation: RelationType, role: RelativeRole) {
    if (ownerId === relativeId) {
      throw new FamilyServiceError("SELF_LINK_NOT_ALLOWED");
    }
    if (!this.isValidRelation(relation)) {
      throw new FamilyServiceError("INVALID_RELATION");
    }
    if (!this.isValidRole(role)) {
      throw new FamilyServiceError("INVALID_ROLE");
    }

    await this.ensureUserExists(relativeId);

    try {
      await query(
        `INSERT INTO relatives (owner_user_id, relative_user_id, relation, role)
         VALUES ($1, $2, $3, $4)`,
        [ownerId, relativeId, relation, role],
      );
    } catch (error: any) {
      if (error?.code === "23505") {
        throw new FamilyServiceError("ALREADY_LINKED");
      }
      throw error;
    }
  },
  async removeRelative(ownerId: string, relativeId: string) {
    const res = await query(
      `DELETE FROM relatives
       WHERE owner_user_id = $1 AND relative_user_id = $2`,
      [ownerId, relativeId],
    );
    if (res.rowCount === 0) {
      throw new FamilyServiceError("LINK_NOT_FOUND", 404);
    }
  },
  async assertViewer(viewerId: string, ownerId: string): Promise<RelativeRole> {
    if (viewerId === ownerId) {
      return "editor";
    }
    const res = await query<{ role: RelativeRole }>(
      `SELECT role FROM relatives WHERE owner_user_id = $1 AND relative_user_id = $2`,
      [ownerId, viewerId],
    );
    if (res.rowCount === 0) {
      throw new FamilyServiceError("NOT_AUTHORIZED", 403);
    }
    return res.rows[0].role;
  },
};
