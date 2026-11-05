import { randomUUID } from "expo-crypto";
import { v21Api, type MedDraftSnapshot, type MedSetupDraft } from "./v21.api";
export type DraftStatus = "idle" | "saving" | "saved" | "error";

/** One serialized writer per draft; deleted drafts never revive. */
export class MedicationDraftSession {
  id: string;
  revision: number;
  private latest: MedDraftSnapshot | null;
  private saved: string | null;
  private pending: Promise<void> | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;
  private removing = false;
  constructor(
    private patient: number,
    private owns: () => boolean,
    private status: (status: DraftStatus, error?: unknown) => void,
    initial?: MedSetupDraft | null,
  ) {
    this.id = initial?.id || randomUUID();
    this.revision = initial?.revision || 0;
    this.latest = initial?.snapshot || null;
    this.saved = this.latest ? JSON.stringify(this.latest) : null;
  }
  schedule(value: MedDraftSnapshot) {
    if (this.closed || this.removing || !this.owns()) return;
    this.latest = value;
    if (JSON.stringify(value) === this.saved) return;
    this.status("saving");
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush().catch(() => {});
    }, 400);
  }
  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.closed || this.removing || !this.owns()) return;
    if (this.pending) {
      await this.pending;
      return this.flush();
    }
    if (!this.latest || JSON.stringify(this.latest) === this.saved) return;
    const snapshot = this.latest,
      serialized = JSON.stringify(snapshot);
    this.status("saving");
    this.pending = (async () => {
      const result = await v21Api.writeDraft(this.patient, {
        id: this.id,
        revision: this.revision,
        snapshot,
      });
      this.revision = result.revision;
      this.saved = serialized;
    })();
    try {
      await this.pending;
    } catch (error) {
      this.status("error", error);
      throw error;
    } finally {
      this.pending = null;
    }
    if (this.closed || this.removing || !this.owns()) return;
    if (JSON.stringify(this.latest) !== this.saved) return this.flush();
    this.status("saved");
  }
  async remove() {
    this.removing = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    try {
      if (this.pending) await this.pending.catch(() => {});
      if (!this.owns()) return;
      if (this.revision)
        await v21Api.removeDraft(this.patient, this.id, this.revision);
      this.closed = true;
      this.latest = null;
      this.status("idle");
    } finally {
      this.removing = false;
    }
  }
  complete() {
    this.closed = true;
    if (this.timer) clearTimeout(this.timer);
    this.status("idle");
  }
}
