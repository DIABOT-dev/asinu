type Snapshot = {
  id: string;
  revision: number;
  status: string;
  updated_at?: string;
};

export function ivrInvitationUnavailable(status?: string | null) {
  if (!status || ["sent", "in_progress"].includes(status)) return null;
  if (status === "draft") return "preparing";
  if (status === "cancelled") return "cancelled";
  if (status === "expired") return "expired";
  return "ended";
}
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

export function splitReplyForSpeech(text: string, maxLength: number) {
  const sections: string[] = [];
  const limit = Math.max(2, maxLength);
  let remaining = text.trim();
  while (remaining.length > limit) {
    const candidate = remaining.slice(0, limit);
    const whitespace = Math.max(
      candidate.lastIndexOf(" "),
      candidate.lastIndexOf("\n")
    );
    const safeLimit = /^[\uDC00-\uDFFF]$/.test(remaining[limit]) ? limit - 1 : limit;
    const end = whitespace > 0 ? whitespace : safeLimit;
    sections.push(remaining.slice(0, end));
    remaining = remaining.slice(end).trimStart();
  }
  if (remaining) sections.push(remaining);
  return sections;
}
