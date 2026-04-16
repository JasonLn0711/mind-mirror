import test from "node:test";
import assert from "node:assert/strict";

import { QUIZ_TOPICS } from "../lib/quiz-content.js";
import { computeQuizResult } from "../lib/scoring.js";

test("ships 12 quiz topics", () => {
  assert.equal(QUIZ_TOPICS.length, 12);
});

test("every topic has at least 30 questions and 8 result profiles", () => {
  QUIZ_TOPICS.forEach((topic) => {
    assert.ok(topic.questions.length >= 30, `${topic.slug} should have 30+ questions`);
    assert.equal(topic.resultProfiles.length, 8, `${topic.slug} should have 8 result profiles`);
  });
});

test("every question has 4 options", () => {
  QUIZ_TOPICS.forEach((topic) => {
    topic.questions.forEach((question) => {
      assert.equal(question.options.length, 4, `${topic.slug}/${question.code} should have 4 options`);
    });
  });
});

test("quadrant scoring resolves deterministic quadrant profile", () => {
  const topic = QUIZ_TOPICS[0];
  const llOptions = topic.questions.slice(0, 8).map((question) => question.options[0]);
  const result = computeQuizResult(topic, llOptions);
  assert.equal(result.profileKey, "quadrant_ll");
  assert.equal(result.profile.title, topic.resultProfiles[0].title);
});
