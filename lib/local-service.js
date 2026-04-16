import { getQuizTopic } from "./quiz-content.js";
import { computeQuizResult, pickRandomQuestions } from "./scoring.js";

const STORAGE_KEYS = {
  attempts: "mind_mirror_local_attempts",
  events: "mind_mirror_local_events",
  results: "mind_mirror_local_results",
};

function readJson(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (_error) {
    return fallback;
  }
}

function writeJson(key, value) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function publicTopicPayload(topic) {
  return {
    slug: topic.slug,
    title: topic.title,
    subtitle: topic.subtitle,
    description: topic.description,
    shareTitle: topic.shareTitle,
    shareDescription: topic.shareDescription,
    questionsPerSession: topic.questionsPerSession,
    questionPoolSize: topic.questionPoolSize,
    axes: topic.axes,
    themeColor: topic.themeColor,
    themeColorSoft: topic.themeColorSoft,
    themeInk: topic.themeInk,
    themeGlow: topic.themeGlow,
  };
}

function stripQuestion(question) {
  return {
    id: question.id,
    code: question.code,
    prompt: question.prompt,
    contextHint: question.contextHint,
    options: question.options.map((option) => ({
      id: option.id,
      optionKey: option.optionKey,
      text: option.text,
      traitWeights: option.traitWeights,
    })),
  };
}

function formatResult(topic, computed, aiMirrorInsight = "") {
  return {
    mode: "local-demo",
    profileKey: computed.profile.profileKey,
    title: computed.profile.title,
    narrative: computed.profile.summary,
    strengths: computed.profile.strengths,
    blindSpots: computed.profile.blindSpots,
    growthSuggestions: computed.profile.growthSuggestions,
    mirrorInsight: aiMirrorInsight,
    topTags: computed.topTags,
    axisScores: computed.axisScores,
    traitScores: computed.traitScores,
    topic: publicTopicPayload(topic),
  };
}

export function createLocalService() {
  return {
    mode: "local-demo",

    async getTopic(slug) {
      const topic = getQuizTopic(slug);
      if (!topic) {
        throw new Error("Quiz topic not found.");
      }
      return publicTopicPayload(topic);
    },

    async startQuiz(payload) {
      const topic = getQuizTopic(payload.slug);
      if (!topic) {
        throw new Error("Quiz topic not found.");
      }

      const attempts = readJson(STORAGE_KEYS.attempts, []);
      const attemptNumber =
        attempts.filter(
          (attempt) =>
            attempt.topicSlug === topic.slug && attempt.sessionToken === payload.sessionToken,
        ).length + 1;
      const quizSessionId = crypto.randomUUID();
      const questions = pickRandomQuestions(topic, topic.questionsPerSession).map(stripQuestion);

      attempts.push({
        quizSessionId,
        topicSlug: topic.slug,
        sessionToken: payload.sessionToken,
        attemptNumber,
        startedAt: new Date().toISOString(),
        status: "in_progress",
        questions,
        responses: [],
      });

      writeJson(STORAGE_KEYS.attempts, attempts);

      return {
        mode: "local-demo",
        quizSessionId,
        attemptNumber,
        topic: publicTopicPayload(topic),
        questions,
      };
    },

    async submitAnswer(payload) {
      const attempts = readJson(STORAGE_KEYS.attempts, []);
      const attempt = attempts.find((entry) => entry.quizSessionId === payload.quizSessionId);
      if (!attempt) {
        throw new Error("Quiz session not found.");
      }

      const nextResponses = attempt.responses.filter((entry) => entry.questionId !== payload.questionId);
      nextResponses.push({
        questionId: payload.questionId,
        questionOptionId: payload.questionOptionId,
        responseTimeMs: payload.responseTimeMs,
        answeredAt: new Date().toISOString(),
      });

      attempt.responses = nextResponses;
      writeJson(STORAGE_KEYS.attempts, attempts);

      return {
        ok: true,
      };
    },

    async completeQuiz(payload) {
      const attempts = readJson(STORAGE_KEYS.attempts, []);
      const attempt = attempts.find((entry) => entry.quizSessionId === payload.quizSessionId);
      if (!attempt) {
        throw new Error("Quiz session not found.");
      }

      const topic = getQuizTopic(attempt.topicSlug);
      const selectedOptions = attempt.responses.map((response) => {
        const question = topic.questions.find((entry) => entry.id === response.questionId);
        return question.options.find((option) => option.id === response.questionOptionId);
      });

      const computed = computeQuizResult(topic, selectedOptions);
      const formatted = formatResult(topic, computed);

      attempt.status = "completed";
      attempt.completedAt = new Date().toISOString();
      attempt.result = formatted;
      writeJson(STORAGE_KEYS.attempts, attempts);

      const results = readJson(STORAGE_KEYS.results, []);
      results.push({
        quizSessionId: attempt.quizSessionId,
        topicSlug: topic.slug,
        sessionToken: attempt.sessionToken,
        createdAt: new Date().toISOString(),
        result: formatted,
      });
      writeJson(STORAGE_KEYS.results, results);

      return formatted;
    },

    async trackEvents(payload) {
      const events = readJson(STORAGE_KEYS.events, []);
      payload.events.forEach((event) => {
        events.push({
          ...event,
          recordedAt: new Date().toISOString(),
        });
      });
      writeJson(STORAGE_KEYS.events, events);
      return {
        ok: true,
      };
    },
  };
}
