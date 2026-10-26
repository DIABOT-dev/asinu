type Snapshot = {
  id: string;
  revision: number;
  status: string;
  updated_at?: string;
};
const order: Record<string, number> = {
  draft: 0,
  sent: 1,
  in_progress: 2,
  completed: 3,
  expired: 3,
  unreachable: 3,
  reported: 4,
  replied: 5,
  closed: 6,
  cancelled: 7,
};
/** A slow poll/upload response must not undo a newer answer or final reply.
 * Going back is valid because the server still increments the revision. */
export function canAcceptIvrSnapshot(
  current: Snapshot | null,
  incoming: Snapshot
) {
  if (!current || current.id !== incoming.id) return true;
  if (incoming.revision !== current.revision)
    return incoming.revision > current.revision;
  if ((order[incoming.status] ?? -1) !== (order[current.status] ?? -1))
    return (order[incoming.status] ?? -1) > (order[current.status] ?? -1);
  return (
    !current.updated_at ||
    !incoming.updated_at ||
    new Date(incoming.updated_at).getTime() >=
      new Date(current.updated_at).getTime()
  );
}
