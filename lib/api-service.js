import { createLocalService } from "./local-service.js";

function stripQuestionPayload(question) {
  return {
    id: question.id,
    code: question.questionCode || question.code,
    prompt: question.prompt,
    contextHint: question.contextHint || question.context_hint || "",
    options: (question.options || []).map((option) => ({
      id: option.id,
      optionKey: option.optionKey || option.option_key,
      text: option.text || option.optionText || option.option_text,
      traitWeights: option.traitWeights || option.trait_weights || {},
    })),
  };
}

function normalizeResultPayload(result) {
  return {
    mode: "supabase",
    profileKey: result.profileKey || result.profile_key,
    title: result.title,
    narrative: result.narrative,
    strengths: result.strengths || [],
    blindSpots: result.blindSpots || result.blind_spots || [],
    growthSuggestions: result.growthSuggestions || result.growth_suggestions || [],
    mirrorInsight: result.mirrorInsight || result.ai_mirror_insight || "",
    topTags: result.topTags || result.top_tags || [],
    axisScores: result.axisScores || result.axis_scores || [],
    traitScores: result.traitScores || result.trait_scores || {},
  };
}

function createRemoteService(config) {
  async function request(path, options = {}) {
    const response = await fetch(`${config.functionsUrl}/${path}`, {
      method: options.method || "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: config.supabaseAnonKey,
        Authorization: `Bearer ${config.supabaseAnonKey}`,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`Function ${path} failed with ${response.status}.`);
    }

    return response.json();
  }

  return {
    mode: "supabase",

    async getTopic(slug) {
      return request(`quiz-topic?slug=${encodeURIComponent(slug)}`, {
        method: "GET",
      });
    },

    async startQuiz(payload) {
      if (payload.forceLocal) {
        throw new Error("Forced local mode.");
      }

      const data = await request("quiz-start", {
        body: payload,
      });

      return {
        mode: "supabase",
        quizSessionId: data.quizSessionId || data.quiz_session_id,
        attemptNumber: data.attemptNumber || data.attempt_number,
        topic: data.topic,
        questions: (data.questions || []).map(stripQuestionPayload),
      };
    },

    async submitAnswer(payload) {
      return request("quiz-answer", {
        body: payload,
      });
    },

    async completeQuiz(payload) {
      const data = await request("quiz-complete", {
        body: payload,
      });
      return normalizeResultPayload(data.result || data);
    },

    async trackEvents(payload) {
      return request("track-event", {
        body: payload,
      });
    },
  };
}

export function createQuizService(config) {
  const localService = createLocalService();

  if (!config.remoteEnabled) {
    return localService;
  }

  const remoteService = createRemoteService(config);

  return {
    ...remoteService,

    async getTopic(slug) {
      try {
        return await remoteService.getTopic(slug);
      } catch (_error) {
        return localService.getTopic(slug);
      }
    },

    async startQuiz(payload) {
      if (payload.forceLocal) {
        return localService.startQuiz(payload);
      }
      return remoteService.startQuiz(payload);
    },

    async submitAnswer(payload) {
      return remoteService.submitAnswer(payload);
    },

    async completeQuiz(payload) {
      return remoteService.completeQuiz(payload);
    },

    async trackEvents(payload) {
      try {
        return await remoteService.trackEvents(payload);
      } catch (_error) {
        return localService.trackEvents(payload);
      }
    },
  };
}
