import { handleOptions, json } from "../_shared/cors.ts";
import { getAdminClient, readJson } from "../_shared/db.ts";
import { logAnalytics } from "../_shared/events.ts";
import { generateMirrorInsight } from "../_shared/openai.ts";
import { computeResultFromSelections } from "../_shared/scoring.ts";

Deno.serve(async (request) => {
  const optionsResponse = handleOptions(request);
  if (optionsResponse) {
    return optionsResponse;
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  try {
    const body = await readJson<{ quizSessionId: string }>(request);
    if (!body.quizSessionId) {
      return json({ error: "quizSessionId is required." }, 400);
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

    const { data: topic, error: topicError } = await admin
      .from("quiz_topics")
      .select("*")
      .eq("id", session.topic_id)
      .single();

    if (topicError || !topic) {
      throw topicError || new Error("Quiz topic is missing.");
    }

    const { data: responses, error: responseError } = await admin
      .from("responses")
      .select("question_option_id, trait_delta")
      .eq("quiz_session_id", body.quizSessionId);

    if (responseError || !responses) {
      throw responseError || new Error("Could not read quiz responses.");
    }

    if (responses.length !== topic.questions_per_session) {
      return json({ error: "Quiz is not fully answered yet." }, 409);
    }

    const { data: profiles, error: profileError } = await admin
      .from("result_profiles")
      .select("profile_key, title, summary, strengths, blind_spots, growth_suggestions")
      .eq("topic_id", topic.id);

    if (profileError || !profiles) {
      throw profileError || new Error("Could not load result profiles.");
    }

    const computed = computeResultFromSelections({
      axisConfig: topic.axis_config || { axes: [] },
      tagLabels: topic.tag_labels || {},
      resultProfiles: profiles,
      selectedOptions: responses.map((response) => response.trait_delta || {}),
    });

    const aiMirrorInsight = await generateMirrorInsight({
      topicTitle: topic.title,
      profileTitle: computed.profile.title,
      narrative: computed.profile.summary,
      topTags: computed.topTags,
      strengths: computed.profile.strengths,
      blindSpots: computed.profile.blind_spots,
    });

    const resultRow = {
      quiz_session_id: session.id,
      topic_id: topic.id,
      profile_key: computed.profile.profile_key,
      title: computed.profile.title,
      narrative: computed.profile.summary,
      strengths: computed.profile.strengths,
      blind_spots: computed.profile.blind_spots,
      growth_suggestions: computed.profile.growth_suggestions,
      trait_scores: computed.traitScores,
      axis_scores: computed.axisScores,
      ai_mirror_insight: aiMirrorInsight,
    };

    const { error: resultError } = await admin
      .from("results")
      .upsert(resultRow, { onConflict: "quiz_session_id" });

    if (resultError) {
      throw resultError;
    }

    const { error: sessionUpdateError } = await admin
      .from("quiz_sessions")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", session.id);

    if (sessionUpdateError) {
      throw sessionUpdateError;
    }

    await logAnalytics(admin, [
      {
        client_event_id: crypto.randomUUID(),
        session_token: session.session_token,
        quiz_session_id: session.id,
        topic_id: topic.id,
        event_type: "quiz_complete",
        event_payload: {
          profileKey: computed.profile.profile_key,
          title: computed.profile.title,
        },
        occurred_at: new Date().toISOString(),
      },
    ]);

    return json({
      result: {
        profileKey: computed.profile.profile_key,
        title: computed.profile.title,
        narrative: computed.profile.summary,
        strengths: computed.profile.strengths,
        blindSpots: computed.profile.blind_spots,
        growthSuggestions: computed.profile.growth_suggestions,
        mirrorInsight: aiMirrorInsight,
        topTags: computed.topTags,
        axisScores: computed.axisScores,
        traitScores: computed.traitScores,
      },
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
