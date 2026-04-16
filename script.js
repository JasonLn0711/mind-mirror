import { getAppConfig } from "./lib/app-config.js";
import { createQuizService } from "./lib/api-service.js";
import { listQuizCards } from "./lib/quiz-content.js";
import { getClientContext } from "./lib/session.js";
import { createTelemetry } from "./lib/telemetry.js";

const config = getAppConfig();
const service = createQuizService(config);
const clientContext = getClientContext();
const telemetry = createTelemetry({
  service,
  sessionToken: clientContext.sessionToken,
});

function createCard(topic) {
  const card = document.createElement("article");
  card.className = "topic-card";
  card.style.setProperty("--topic-accent", topic.themeColor);
  card.style.setProperty("--topic-soft", topic.themeColorSoft);
  card.style.setProperty("--topic-ink", topic.themeInk);
  card.style.setProperty("--topic-glow", topic.themeGlow);

  const link = document.createElement("a");
  link.className = "topic-card__link";
  link.href = `./quiz.html?slug=${encodeURIComponent(topic.slug)}`;
  link.setAttribute("aria-label", `${topic.title}，開始測驗`);

  link.innerHTML = `
    <div class="topic-card__halo"></div>
    <div class="topic-card__topline"></div>
    <div class="topic-card__meta">
      <span class="topic-card__icon">${topic.icon}</span>
      <span class="topic-card__pill">${topic.shortTitle}</span>
    </div>
    <div class="topic-card__body">
      <h3>${topic.title}</h3>
      <p>${topic.cardDescription}</p>
    </div>
    <div class="topic-card__stats">
      <span>8 / ${topic.questionPoolSize} 題</span>
      <span>3-4 分鐘</span>
    </div>
  `;

  link.addEventListener("click", () => {
    telemetry.track("quiz_card_click", {
      quizSlug: topic.slug,
      surface: "catalog",
      title: topic.title,
    });
  });

  card.append(link);
  return card;
}

function renderCatalog() {
  const grid = document.querySelector("#quiz-grid");
  const topics = listQuizCards();

  topics.forEach((topic) => {
    grid.append(createCard(topic));
  });
}

function bindSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", (event) => {
      const href = anchor.getAttribute("href");
      if (!href || href === "#") {
        return;
      }

      const target = document.querySelector(href);
      if (!target) {
        return;
      }

      event.preventDefault();
      target.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  });
}

renderCatalog();
bindSmoothScroll();

telemetry.track("catalog_view", {
  page: "index",
  remoteEnabled: config.remoteEnabled,
  appMode: config.remoteEnabled ? "supabase" : "local-demo",
});

telemetry.flushSoon();
