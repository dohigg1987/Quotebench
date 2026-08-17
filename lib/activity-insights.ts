export type ActivityTrackingRow = {
  quote_reference: string;
  recipient_id: string | null;
  event_type: string;
  section: string | null;
  duration_ms: number | null;
  created_at: string;
  recipient_status?: string | null;
  signed_at?: string | null;
  expires_at?: string | null;
  client_name?: string | null;
};

export type ActivityInsights = {
  activeRecipients: number;
  engagedRecipients: number;
  totalOpens: number;
  totalDwellMs: number;
  days: Array<{ date: string; recipients: number; opens: number; dwellMs: number }>;
  attention: Array<{
    quoteReference: string;
    clientName: string;
    recipients: number;
    openCount: number;
    dwellMs: number;
    lastActivity: string;
    sections: Array<{ section: string; dwellMs: number }>;
  }>;
};

function parseTimestamp(value: string) {
  return new Date(value.includes("T") ? value : `${value.replace(" ", "T")}Z`);
}

export function buildActivityInsights(rows: ActivityTrackingRow[], now = new Date()): ActivityInsights {
  const dayMs = 86_400_000;
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const start = today - (13 * dayMs);
  const activeSince = now.getTime() - (7 * dayMs);
  const days = Array.from({ length: 14 }, (_, index) => {
    const date = new Date(start + (index * dayMs)).toISOString().slice(0, 10);
    return { date, recipients: 0, opens: 0, dwellMs: 0, recipientIds: new Set<string>() };
  });
  const byDate = new Map(days.map((day) => [day.date, day]));
  const active = new Set<string>();
  const engaged = new Set<string>();
  const attention = new Map<string, {
    quoteReference: string; clientName: string; recipientIds: Set<string>; openCount: number;
    dwellMs: number; lastActivity: string; sections: Map<string, number>;
  }>();
  let totalOpens = 0;
  let totalDwellMs = 0;

  for (const row of rows) {
    const created = parseTimestamp(row.created_at);
    const createdMs = created.getTime();
    if (!Number.isFinite(createdMs) || createdMs < start || createdMs >= today + dayMs) continue;
    const qualified = row.event_type === "open" || row.event_type === "section_heartbeat";
    if (!qualified) continue;
    const recipientId = row.recipient_id ? String(row.recipient_id) : "";
    const date = created.toISOString().slice(0, 10);
    const day = byDate.get(date);
    if (recipientId) {
      engaged.add(recipientId);
      day?.recipientIds.add(recipientId);
      const expiresAt = row.expires_at ? parseTimestamp(row.expires_at).getTime() : Number.POSITIVE_INFINITY;
      const recipientActive = !row.signed_at && row.recipient_status !== "Revoked" && expiresAt >= now.getTime();
      if (recipientActive && createdMs >= activeSince) active.add(recipientId);
    }
    const dwellMs = row.event_type === "section_heartbeat" ? Math.max(0, Number(row.duration_ms ?? 0)) : 0;
    const opens = row.event_type === "open" ? 1 : 0;
    totalOpens += opens;
    totalDwellMs += dwellMs;
    if (day) { day.opens += opens; day.dwellMs += dwellMs; }

    const reference = String(row.quote_reference || "Unassigned");
    const item = attention.get(reference) ?? {
      quoteReference: reference,
      clientName: String(row.client_name || reference),
      recipientIds: new Set<string>(),
      openCount: 0,
      dwellMs: 0,
      lastActivity: row.created_at,
      sections: new Map<string, number>(),
    };
    if (recipientId) item.recipientIds.add(recipientId);
    item.openCount += opens;
    item.dwellMs += dwellMs;
    if (createdMs > parseTimestamp(item.lastActivity).getTime()) item.lastActivity = row.created_at;
    if (dwellMs && row.section) item.sections.set(row.section, (item.sections.get(row.section) ?? 0) + dwellMs);
    attention.set(reference, item);
  }

  return {
    activeRecipients: active.size,
    engagedRecipients: engaged.size,
    totalOpens,
    totalDwellMs,
    days: days.map(({ recipientIds, ...day }) => ({ ...day, recipients: recipientIds.size })),
    attention: [...attention.values()]
      .sort((left, right) => right.dwellMs - left.dwellMs || right.openCount - left.openCount || parseTimestamp(right.lastActivity).getTime() - parseTimestamp(left.lastActivity).getTime())
      .slice(0, 5)
      .map((item) => ({
        quoteReference: item.quoteReference,
        clientName: item.clientName,
        recipients: item.recipientIds.size,
        openCount: item.openCount,
        dwellMs: item.dwellMs,
        lastActivity: item.lastActivity,
        sections: [...item.sections.entries()].sort((left, right) => right[1] - left[1]).map(([section, dwellMs]) => ({ section, dwellMs })),
      })),
  };
}

