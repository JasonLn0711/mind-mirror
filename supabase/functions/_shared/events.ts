type AnalyticsEventRow = {
  client_event_id: string;
  session_token: string;
  quiz_session_id?: string | null;
  topic_id?: string | null;
  event_type: string;
  event_payload: Record<string, unknown>;
  occurred_at: string;
};

export async function logAnalytics(admin: any, rows: AnalyticsEventRow[]) {
  if (rows.length === 0) {
    return;
  }

  const { error } = await admin
    .from("analytics_events")
    .upsert(rows, { onConflict: "client_event_id", ignoreDuplicates: true });

  if (error) {
    throw error;
  }
}
