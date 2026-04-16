import { handleOptions, json } from "../_shared/cors.ts";
import { getAdminClient, readJson } from "../_shared/db.ts";
import { logAnalytics } from "../_shared/events.ts";

function shuffle<T>(list: T[]) {
  const clone = [...list];
  for (let index = clone.length - 1; index > 0; index -= 1) {
    const nextIndex = Math.floor(Math.random() * (index + 1));
    [clone[index], clone[nextIndex]] = [clone[nextIndex], clone[index]];
  }
  return clone;
}

function mapTopic(topic: any) {
  return {
    slug: topic.slug,
    title: topic.title,
    shortTitle: topic.short_title,
    subtitle: topic.subtitle,
    description: topic.description,
    heroCopy: topic.hero_copy,
    shareTitle: topic.share_title,
    shareDescription: topic.share_description,
    icon: topic.icon,
    themeColor: topic.theme_color,
    themeColorSoft: topic.theme_color_soft,
    themeInk: topic.theme_ink,
    themeGlow: topic.theme_glow,
    questionsPerSession: topic.questions_per_session,
    questionPoolSize: topic.question_pool_size,
    axes: topic.axis_config?.axes || [],
  };
}

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
      slug: string;
      sessionToken: string;
      sourcePage?: string;
      referrer?: string;
      utm?: Record<string, string>;
      deviceMeta?: Record<string, unknown>;
    }>(request);

    if (!body.slug || !body.sessionToken) {
      return json({ error: "slug and sessionToken are required." }, 400);
    }

    const admin = getAdminClient();
    const { data: topic, error: topicError } = await admin
      .from("quiz_topics")
      .select("*")
      .eq("slug", body.slug)
      .eq("status", "active")
      .single();

    if (topicError || !topic) {
      return json({ error: "Quiz topic not found." }, 404);
    }

    const { count } = await admin
      .from("quiz_sessions")
      .select("*", { count: "exact", head: true })
      .eq("topic_id", topic.id)
      .eq("session_token", body.sessionToken);

    const attemptNumber = (count || 0) + 1;
    const { data: sessionRow, error: sessionError } = await admin
      .from("quiz_sessions")
      .insert({
        topic_id: topic.id,
        session_token: body.sessionToken,
        attempt_number: attemptNumber,
        source_page: body.sourcePage || "quiz",
        referrer: body.referrer || "",
        utm: body.utm || {},
        device_meta: body.deviceMeta || {},
        status: "in_progress",
      })
      .select("*")
      .single();

    if (sessionError || !sessionRow) {
      throw sessionError || new Error("Could not create quiz session.");
    }

    const { data: questions, error: questionError } = await admin
      .from("questions")
      .select("id, question_code, prompt, context_hint, sort_order")
      .eq("topic_id", topic.id)
      .eq("status", "active")
      .order("sort_order", { ascending: true });

    if (questionError || !questions) {
      throw questionError || new Error("Could not load questions.");
    }

    const selectedQuestions = shuffle(questions).slice(0, topic.questions_per_session);
    const questionIds = selectedQuestions.map((question) => question.id);

    const { data: options, error: optionError } = await admin
      .from("question_options")
      .select("id, question_id, option_key, option_text, trait_weights, option_order")
      .in("question_id", questionIds)
      .order("option_order", { ascending: true });

    if (optionError || !options) {
      throw optionError || new Error("Could not load question options.");
    }

    const seedGroup = crypto.randomUUID();
    const sessionQuestions = selectedQuestions.map((question, index) => ({
      quiz_session_id: sessionRow.id,
      question_id: question.id,
      display_order: index + 1,
      seed_group: seedGroup,
    }));

    const { error: sessionQuestionError } = await admin
      .from("session_questions")
      .insert(sessionQuestions);

    if (sessionQuestionError) {
      throw sessionQuestionError;
    }

    const optionMap = new Map<string, any[]>();
    options.forEach((option) => {
      const list = optionMap.get(option.question_id) || [];
      list.push(option);
      optionMap.set(option.question_id, list);
    });

    const payloadQuestions = selectedQuestions.map((question) => ({
      id: question.id,
      questionCode: question.question_code,
      prompt: question.prompt,
      contextHint: question.context_hint,
      options: (optionMap.get(question.id) || []).map((option) => ({
        id: option.id,
        optionKey: option.option_key,
        optionText: option.option_text,
        traitWeights: option.trait_weights,
      })),
    }));

    await logAnalytics(admin, [
      {
        client_event_id: crypto.randomUUID(),
        session_token: body.sessionToken,
        quiz_session_id: sessionRow.id,
        topic_id: topic.id,
        event_type: "quiz_start",
        event_payload: {
          quizSlug: body.slug,
          attemptNumber,
          sourcePage: body.sourcePage || "quiz",
        },
        occurred_at: new Date().toISOString(),
      },
    ]);

    return json({
      quizSessionId: sessionRow.id,
      attemptNumber,
      topic: mapTopic(topic),
      questions: payloadQuestions,
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
