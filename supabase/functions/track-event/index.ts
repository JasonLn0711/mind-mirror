import { handleOptions, json } from "../_shared/cors.ts";
import { getAdminClient, readJson, isUuid } from "../_shared/db.ts";
import { logAnalytics } from "../_shared/events.ts";

Deno.serve(async (request) => {
  const optionsResponse = handleOptions(request);
  if (optionsResponse) {
    return optionsResponse;
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  try {
    const body = await readJson<{
      sessionToken: string;
      events: Array<{
        clientEventId: string;
        eventType: string;
        eventPayload?: Record<string, unknown>;
        occurredAt?: string;
      }>;
    }>(request);

    if (!body.sessionToken || !Array.isArray(body.events)) {
      return json({ error: "sessionToken and events are required." }, 400);
    }

    const admin = getAdminClient();
    const quizSlugs = Array.from(
      new Set(
        body.events
          .map((event) => String(event.eventPayload?.quizSlug || ""))
          .filter(Boolean),
      ),
    );

    const topicMap = new Map<string, string>();
    if (quizSlugs.length > 0) {
      const { data: topics } = await admin
        .from("quiz_topics")
        .select("id, slug")
        .in("slug", quizSlugs);

      (topics || []).forEach((topic) => {
        topicMap.set(topic.slug, topic.id);
      });
    }

    const rows = body.events.slice(0, 100).map((event) => {
      const quizSlug = String(event.eventPayload?.quizSlug || "");
      const quizSessionId = String(event.eventPayload?.quizSessionId || "");
      return {
        client_event_id: event.clientEventId || crypto.randomUUID(),
        session_token: body.sessionToken,
        quiz_session_id: isUuid(quizSessionId) ? quizSessionId : null,
        topic_id: topicMap.get(quizSlug) || null,
        event_type: event.eventType,
        event_payload: event.eventPayload || {},
        occurred_at: event.occurredAt || new Date().toISOString(),
      };
    });

    await logAnalytics(admin, rows);

    return json({
      ok: true,
      inserted: rows.length,
    });
  } catch (error) {
    return json(
      {
        error: error instanceof Error ? error.message : "Unknown error.",
      },
      500,
    );
  }
});
