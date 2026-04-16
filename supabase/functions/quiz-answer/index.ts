import { handleOptions, json } from "../_shared/cors.ts";
import { getAdminClient, readJson } from "../_shared/db.ts";
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
      quizSessionId: string;
      questionId: string;
      questionOptionId: string;
      responseTimeMs?: number;
    }>(request);

    if (!body.quizSessionId || !body.questionId || !body.questionOptionId) {
      return json({ error: "quizSessionId, questionId, questionOptionId are required." }, 400);
    }

    const admin = getAdminClient();
    const { data: session, error: sessionError } = await admin
      .from("quiz_sessions")
      .select("id, topic_id, session_token, status")
      .eq("id", body.quizSessionId)
      .single();

    if (sessionError || !session) {
      return json({ error: "Quiz session not found." }, 404);
    }

    if (session.status !== "in_progress") {
      return json({ error: "Quiz session is not active." }, 409);
    }

    const { data: sessionQuestion, error: sessionQuestionError } = await admin
      .from("session_questions")
      .select("question_id")
      .eq("quiz_session_id", body.quizSessionId)
      .eq("question_id", body.questionId)
      .maybeSingle();

    if (sessionQuestionError || !sessionQuestion) {
      return json({ error: "Question does not belong to this session." }, 400);
    }

    const { data: option, error: optionError } = await admin
      .from("question_options")
      .select("id, question_id, trait_weights, option_key")
      .eq("id", body.questionOptionId)
      .eq("question_id", body.questionId)
      .single();

    if (optionError || !option) {
      return json({ error: "Option does not belong to the selected question." }, 400);
    }

    const { error: responseError } = await admin.from("responses").upsert(
      {
        quiz_session_id: body.quizSessionId,
        question_id: body.questionId,
        question_option_id: body.questionOptionId,
        response_time_ms: body.responseTimeMs || 0,
        trait_delta: option.trait_weights || {},
      },
      {
        onConflict: "quiz_session_id,question_id",
      },
    );

    if (responseError) {
      throw responseError;
    }

    await logAnalytics(admin, [
      {
        client_event_id: crypto.randomUUID(),
        session_token: session.session_token,
        quiz_session_id: session.id,
        topic_id: session.topic_id,
        event_type: "answer_select",
        event_payload: {
          questionId: body.questionId,
          questionOptionId: body.questionOptionId,
          optionKey: option.option_key,
          responseTimeMs: body.responseTimeMs || 0,
        },
        occurred_at: new Date().toISOString(),
      },
    ]);

    return json({
      ok: true,
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
