import { getAppConfig } from "./lib/app-config.js";
import { createQuizService } from "./lib/api-service.js";
import { getQuizTopic } from "./lib/quiz-content.js";
import { computeQuizResult } from "./lib/scoring.js";
import { getClientContext } from "./lib/session.js";
import { createTelemetry } from "./lib/telemetry.js";

const config = getAppConfig();
const service = createQuizService(config);
const clientContext = getClientContext();
const telemetry = createTelemetry({
  service,
  sessionToken: clientContext.sessionToken,
});

const state = {
  topic: null,
  mode: config.remoteEnabled ? "supabase" : "local-demo",
  quizSessionId: null,
  attemptNumber: 1,
  questions: [],
  answers: [],
  currentIndex: 0,
  questionStartedAt: 0,
  result: null,
  serviceModeLocked: false,
};

function updateSidePanel() {
  const title = document.querySelector("#topic-side-title");
  const copy = document.querySelector("#topic-side-copy");
  const modeBadge = document.querySelector("#mode-badge");
  const questionCountBadge = document.querySelector("#question-count-badge");

  if (!state.topic) {
    return;
  }

  title.textContent = state.topic.title;
  copy.textContent = state.topic.description;
  questionCountBadge.textContent = `${state.topic.questionsPerSession} / ${state.topic.questionPoolSize} 題池`;
  modeBadge.textContent = state.mode === "supabase" ? "Supabase 連線模式" : "本機體驗";
}

function renderNotFound() {
  const root = document.querySelector("#quiz-root");
  root.innerHTML = `
    <div class="quiz-card-shell">
      <div class="quiz-card-shell__topline"></div>
      <section class="quiz-view quiz-view--active quiz-view--centered">
        <p class="eyebrow">找不到主題</p>
        <h1>這個測驗主題不存在</h1>
        <p>也許網址有誤，或這個主題還沒有啟用。你可以先回到主頁，換一個想探索的方向。</p>
        <a class="primary-btn primary-btn--inline" href="./index.html">回到測驗館</a>
      </section>
    </div>
  `;
}

function renderLanding() {
  const root = document.querySelector("#quiz-root");
  root.innerHTML = `
    <div class="quiz-card-shell quiz-card-shell--topic" style="--topic-accent:${state.topic.themeColor}; --topic-soft:${state.topic.themeColorSoft}; --topic-ink:${state.topic.themeInk}; --topic-glow:${state.topic.themeGlow};">
      <div class="quiz-card-shell__topline"></div>
      <section class="quiz-view quiz-view--active quiz-view--landing">
        <div class="hero-mark hero-mark--topic">${state.topic.icon}</div>
        <p class="eyebrow">心理自我探索測驗</p>
        <h1 class="hero-title">${state.topic.title}</h1>
        <p class="hero-copy">${state.topic.heroCopy}</p>
        <div class="hero-pill-row hero-pill-row--compact">
          <span>${state.topic.questionsPerSession} 題作答</span>
          <span>${state.topic.questionPoolSize} 題池</span>
          <span>匿名紀錄</span>
        </div>
        <button class="primary-btn" id="start-quiz-button" type="button">開始照見自己</button>
        <p class="landing-footnote">這份測驗會從題庫中抽出 8 題，結果會像一份溫柔的心理鏡像，陪你看見慣性與力量。</p>
      </section>
    </div>
  `;

  document.querySelector("#start-quiz-button").addEventListener("click", startQuizFlow);
}

function renderQuestion() {
  const question = state.questions[state.currentIndex];
  const progress = ((state.currentIndex + 1) / state.questions.length) * 100;
  const root = document.querySelector("#quiz-root");

  root.innerHTML = `
    <div class="quiz-card-shell quiz-card-shell--topic" style="--topic-accent:${state.topic.themeColor}; --topic-soft:${state.topic.themeColorSoft}; --topic-ink:${state.topic.themeInk}; --topic-glow:${state.topic.themeGlow};">
      <div class="quiz-card-shell__topline"></div>
      <section class="quiz-view quiz-view--active">
        <div class="progress-row">
          <div class="progress-track" aria-hidden="true">
            <span class="progress-fill" style="width:${progress}%"></span>
          </div>
          <p class="progress-label">${state.currentIndex + 1} / ${state.questions.length}</p>
        </div>

        <div class="question-block">
          <p class="question-kicker">${question.contextHint}</p>
          <h2 class="question-text">${question.prompt}</h2>
          <div class="options-grid" id="question-options"></div>
        </div>
      </section>
    </div>
  `;

  const optionsGrid = document.querySelector("#question-options");
  question.options.forEach((option) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "option-btn";
    button.textContent = option.text;
    button.addEventListener("click", () => handleAnswer(option, button));
    optionsGrid.append(button);
  });

  state.questionStartedAt = Date.now();

  telemetry.track("question_view", {
    quizSlug: state.topic.slug,
    quizSessionId: state.quizSessionId,
    questionId: question.id,
    questionCode: question.code,
    questionIndex: state.currentIndex + 1,
  });
}

function axisDescription(axis) {
  if (axis.balanced) {
    return `${axis.leftLabel}與${axis.rightLabel}都在運作`;
  }

  return `目前偏向 ${axis.dominantLabel}`;
}

function buildShareText() {
  if (!state.result) {
    return "我剛做完一份心理自我探索測驗。";
  }

  return `我測到的結果是「${state.result.title}」：${state.result.narrative}`;
}

function renderResult() {
  const result = state.result;
  const root = document.querySelector("#quiz-root");

  root.innerHTML = `
    <div class="quiz-card-shell quiz-card-shell--topic" style="--topic-accent:${state.topic.themeColor}; --topic-soft:${state.topic.themeColorSoft}; --topic-ink:${state.topic.themeInk}; --topic-glow:${state.topic.themeGlow};">
      <div class="quiz-card-shell__topline"></div>
      <section class="quiz-view quiz-view--active quiz-view--result">
        <div class="result-hero">
          <p class="eyebrow">鏡像結果</p>
          <h1 class="result-title-display">${result.title}</h1>
          <p class="result-narrative">${result.narrative}</p>
          ${result.mirrorInsight ? `<div class="mirror-insight"><h2>像被看見的一句話</h2><p>${result.mirrorInsight}</p></div>` : ""}
        </div>

        <section class="result-section">
          <div class="section-subhead">
            <h2>你的兩條心理軸線</h2>
            <p>重點在於你最近更常啟動哪一套內在系統。</p>
          </div>
          <div class="axis-grid">
            ${result.axisScores
              .map((axis) => {
                const position = `${Math.round(((axis.balance + 1) / 2) * 100)}%`;
                return `
                  <article class="axis-card">
                    <div class="axis-card__labels">
                      <span>${axis.leftLabel}</span>
                      <strong>${axisDescription(axis)}</strong>
                      <span>${axis.rightLabel}</span>
                    </div>
                    <div class="axis-card__track">
                      <span class="axis-card__marker" style="left:${position}"></span>
                    </div>
                    <p class="axis-card__meta">左側 ${axis.leftScore} ・ 右側 ${axis.rightScore}</p>
                  </article>
                `;
              })
              .join("")}
          </div>
        </section>

        <section class="result-section">
          <div class="section-subhead">
            <h2>你這次最明顯的心理線索</h2>
            <p>這些線索會提醒你，近期哪些保護或推進方式特別常被啟動。</p>
          </div>
          <div class="tag-cloud">
            ${result.topTags.map((tag) => `<span>${tag.label}</span>`).join("")}
          </div>
        </section>

        <section class="result-grid">
          <article class="insight-card">
            <h2>你的優勢</h2>
            <ul>${result.strengths.map((item) => `<li>${item}</li>`).join("")}</ul>
          </article>
          <article class="insight-card">
            <h2>容易忽略的地方</h2>
            <ul>${result.blindSpots.map((item) => `<li>${item}</li>`).join("")}</ul>
          </article>
        </section>

        <section class="result-section">
          <div class="section-subhead">
            <h2>溫柔成長建議</h2>
            <p>這些建議會陪你少一點內耗、多一點選擇。</p>
          </div>
          <ul class="growth-list">${result.growthSuggestions.map((item) => `<li>${item}</li>`).join("")}</ul>
        </section>

        <div class="result-actions">
          <button class="primary-btn" id="share-result-button" type="button">原生分享結果</button>
          <button class="secondary-btn" id="copy-result-button" type="button">複製結果文字</button>
        </div>

        <div class="share-row">
          <button class="share-btn share-btn-fb" id="facebook-share-button" type="button">Facebook</button>
          <button class="share-btn share-btn-x" id="x-share-button" type="button">X</button>
          <button class="share-btn share-btn-ghost" id="restart-quiz-button" type="button">再測一次</button>
        </div>
      </section>
    </div>
  `;

  document.querySelector("#share-result-button").addEventListener("click", shareResultNative);
  document.querySelector("#copy-result-button").addEventListener("click", copyResultText);
  document.querySelector("#facebook-share-button").addEventListener("click", shareToFacebook);
  document.querySelector("#x-share-button").addEventListener("click", shareToX);
  document.querySelector("#restart-quiz-button").addEventListener("click", restartQuiz);

  telemetry.track("result_view", {
    quizSlug: state.topic.slug,
    quizSessionId: state.quizSessionId,
    profileKey: result.profileKey,
    title: result.title,
  });
}

function formatResultPayload(topic, computed, mirrorInsight = "") {
  return {
    profileKey: computed.profile.profileKey,
    title: computed.profile.title,
    narrative: computed.profile.summary,
    strengths: computed.profile.strengths,
    blindSpots: computed.profile.blindSpots,
    growthSuggestions: computed.profile.growthSuggestions,
    mirrorInsight,
    topTags: computed.topTags,
    axisScores: computed.axisScores,
    traitScores: computed.traitScores,
  };
}

async function startQuizFlow() {
  const payload = {
    slug: state.topic.slug,
    sessionToken: clientContext.sessionToken,
    sourcePage: "quiz",
    referrer: clientContext.referrer,
    utm: clientContext.utm,
    deviceMeta: clientContext.deviceMeta,
  };

  try {
    const response = await service.startQuiz(payload);
    state.mode = response.mode || state.mode;
    state.serviceModeLocked = true;
    state.quizSessionId = response.quizSessionId;
    state.attemptNumber = response.attemptNumber;
    state.questions = response.questions;
    state.answers = [];
    state.currentIndex = 0;
    updateSidePanel();
    renderQuestion();
  } catch (_error) {
    const fallback = await service.startQuiz({
      ...payload,
      forceLocal: true,
    });
    state.mode = "local-demo";
    state.serviceModeLocked = true;
    state.quizSessionId = fallback.quizSessionId;
    state.attemptNumber = fallback.attemptNumber;
    state.questions = fallback.questions;
    state.answers = [];
    state.currentIndex = 0;
    updateSidePanel();
    renderQuestion();
  }
}

async function handleAnswer(option, selectedButton) {
  const question = state.questions[state.currentIndex];
  const responseTimeMs = Date.now() - state.questionStartedAt;
  const buttons = document.querySelectorAll(".option-btn");

  buttons.forEach((button) => {
    button.disabled = true;
    button.classList.add("is-locked");
  });

  selectedButton.classList.add("is-selected");

  state.answers.push({
    question,
    option,
    responseTimeMs,
  });

  try {
    await service.submitAnswer({
      quizSessionId: state.quizSessionId,
      questionId: question.id,
      questionOptionId: option.id,
      responseTimeMs,
    });
  } catch (_error) {
    // local state is already enough to continue; result fallback will still work
  }

  window.setTimeout(async () => {
    state.currentIndex += 1;
    if (state.currentIndex < state.questions.length) {
      renderQuestion();
      return;
    }

    try {
      const result = await service.completeQuiz({
        quizSessionId: state.quizSessionId,
      });
      state.result = result;
    } catch (_error) {
      const computed = computeQuizResult(
        state.topic,
        state.answers.map((answer) => answer.option),
      );
      state.result = formatResultPayload(state.topic, computed);
      state.mode = "local-demo";
      updateSidePanel();
    }

    renderResult();
  }, 220);
}

async function shareResultNative() {
  const payload = {
    title: state.topic.shareTitle,
    text: buildShareText(),
    url: window.location.href,
  };

  telemetry.track("share_click", {
    quizSlug: state.topic.slug,
    quizSessionId: state.quizSessionId,
    channel: "native",
  });

  if (navigator.share) {
    try {
      await navigator.share(payload);
      return;
    } catch (error) {
      if (error && error.name === "AbortError") {
        return;
      }
    }
  }

  await navigator.clipboard.writeText(`${payload.text} ${payload.url}`);
}

async function copyResultText() {
  const copyButton = document.querySelector("#copy-result-button");
  telemetry.track("copy_result", {
    quizSlug: state.topic.slug,
    quizSessionId: state.quizSessionId,
  });

  try {
    await navigator.clipboard.writeText(`${buildShareText()} ${window.location.href}`);
    copyButton.textContent = "已複製";
    window.setTimeout(() => {
      copyButton.textContent = "複製結果文字";
    }, 1400);
  } catch (_error) {
    window.prompt("請手動複製以下文字", `${buildShareText()} ${window.location.href}`);
  }
}

function shareToFacebook() {
  telemetry.track("share_click", {
    quizSlug: state.topic.slug,
    quizSessionId: state.quizSessionId,
    channel: "facebook",
  });
  const shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`;
  window.open(shareUrl, "_blank", "noopener,noreferrer");
}

function shareToX() {
  telemetry.track("share_click", {
    quizSlug: state.topic.slug,
    quizSessionId: state.quizSessionId,
    channel: "x",
  });
  const shareUrl =
    `https://twitter.com/intent/tweet?text=${encodeURIComponent(buildShareText())}` +
    `&url=${encodeURIComponent(window.location.href)}`;
  window.open(shareUrl, "_blank", "noopener,noreferrer");
}

function restartQuiz() {
  telemetry.track("restart_quiz", {
    quizSlug: state.topic.slug,
    quizSessionId: state.quizSessionId,
  });
  state.quizSessionId = null;
  state.result = null;
  state.answers = [];
  state.currentIndex = 0;
  renderLanding();
}

async function boot() {
  const slug = new URLSearchParams(window.location.search).get("slug");
  state.topic = slug ? getQuizTopic(slug) : null;

  if (!state.topic) {
    document.title = "Mind Mirror | 找不到主題";
    renderNotFound();
    telemetry.track("quiz_page_view", {
      quizSlug: slug || "missing",
      state: "missing",
    });
    telemetry.flushSoon();
    return;
  }

  document.title = `Mind Mirror | ${state.topic.title}`;
  updateSidePanel();
  renderLanding();
  telemetry.track("quiz_page_view", {
    quizSlug: state.topic.slug,
    state: "ready",
  });
  telemetry.flushSoon();
}

boot();
