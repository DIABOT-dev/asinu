# Bolt Legacy Archive

Artifacts in this directory were moved out of the active codebase during the Bolt backend retirement.

- **Retention window:** 4 weeks from the archive date stamped in each subdirectory (e.g. `2025-10-09`).
- **Do not modify** files in place; any recovery must copy the asset back into the working tree in a new branch for review.
- **Restoration workflow:**
  1. Identify the needed artifact and confirm its archive date.
  2. Copy the file or folder back to a scratch location (outside of `archive/`) for evaluation.
  3. Submit a PR describing the reason for recovery and the follow-up plan (e.g., reimplementation or deletion).
  4. After the retention window expires and no restore request is open, the archive subdirectory can be purged in a follow-up PR.

For questions, contact the DIABOT platform team or refer to `docs/tech/ARCHIVE_POLICY.md`.
