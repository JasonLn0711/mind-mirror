import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { QUIZ_TOPICS } from "../lib/quiz-content.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

function sqlString(value) {
  const normalized = String(value ?? "");
  return `'${normalized.replace(/'/g, "''")}'`;
}

function sqlJson(value) {
  return `${sqlString(JSON.stringify(value))}::jsonb`;
}

function sqlTextArray(values) {
  return `ARRAY[${values.map((value) => sqlString(value)).join(", ")}]::text[]`;
}

function buildTopicInsert(topic) {
  const axisConfig = {
    axes: topic.axes,
  };
  const resultTheme = {
    icon: topic.icon,
    shortTitle: topic.shortTitle,
    themeColor: topic.themeColor,
    themeColorSoft: topic.themeColorSoft,
    themeInk: topic.themeInk,
    themeGlow: topic.themeGlow,
    shareTitle: topic.shareTitle,
    shareDescription: topic.shareDescription,
  };

  return `insert into public.quiz_topics (
  slug,
  title,
  short_title,
  subtitle,
  description,
  hero_copy,
  share_title,
  share_description,
  icon,
  theme_color,
  theme_color_soft,
  theme_ink,
  theme_glow,
  status,
  locale,
  question_pool_size,
  questions_per_session,
  axis_config,
  tag_labels,
  result_theme
) values (
  ${sqlString(topic.slug)},
  ${sqlString(topic.title)},
  ${sqlString(topic.shortTitle)},
  ${sqlString(topic.subtitle)},
  ${sqlString(topic.description)},
  ${sqlString(topic.heroCopy)},
  ${sqlString(topic.shareTitle)},
  ${sqlString(topic.shareDescription)},
  ${sqlString(topic.icon)},
  ${sqlString(topic.themeColor)},
  ${sqlString(topic.themeColorSoft)},
  ${sqlString(topic.themeInk)},
  ${sqlString(topic.themeGlow)},
  'active',
  ${sqlString(topic.locale)},
  ${topic.questionPoolSize},
  ${topic.questionsPerSession},
  ${sqlJson(axisConfig)},
  ${sqlJson(topic.tagLabels)},
  ${sqlJson(resultTheme)}
) on conflict (slug) do update set
  title = excluded.title,
  short_title = excluded.short_title,
  subtitle = excluded.subtitle,
  description = excluded.description,
  hero_copy = excluded.hero_copy,
  share_title = excluded.share_title,
  share_description = excluded.share_description,
  icon = excluded.icon,
  theme_color = excluded.theme_color,
  theme_color_soft = excluded.theme_color_soft,
  theme_ink = excluded.theme_ink,
  theme_glow = excluded.theme_glow,
  locale = excluded.locale,
  question_pool_size = excluded.question_pool_size,
  questions_per_session = excluded.questions_per_session,
  axis_config = excluded.axis_config,
  tag_labels = excluded.tag_labels,
  result_theme = excluded.result_theme,
  status = excluded.status;`;
}

function buildQuestionInsert(topic, question) {
  return `insert into public.questions (
  topic_id,
  question_code,
  prompt,
  context_hint,
  sort_order,
  status
) values (
  (select id from public.quiz_topics where slug = ${sqlString(topic.slug)}),
  ${sqlString(question.code)},
  ${sqlString(question.prompt)},
  ${sqlString(question.contextHint)},
  ${question.sortOrder},
  'active'
) on conflict (topic_id, question_code) do update set
  prompt = excluded.prompt,
  context_hint = excluded.context_hint,
  sort_order = excluded.sort_order,
  status = excluded.status;`;
}

function buildOptionInsert(topic, question, option, index) {
  return `insert into public.question_options (
  question_id,
  option_key,
  option_text,
  trait_weights,
  option_order
) values (
  (
    select questions.id
    from public.questions
    inner join public.quiz_topics on quiz_topics.id = questions.topic_id
    where quiz_topics.slug = ${sqlString(topic.slug)}
      and questions.question_code = ${sqlString(question.code)}
  ),
  ${sqlString(option.optionKey)},
  ${sqlString(option.text)},
  ${sqlJson(option.traitWeights)},
  ${index + 1}
) on conflict (question_id, option_key) do update set
  option_text = excluded.option_text,
  trait_weights = excluded.trait_weights,
  option_order = excluded.option_order;`;
}

function buildProfileInsert(topic, profile) {
  return `insert into public.result_profiles (
  topic_id,
  profile_key,
  title,
  summary,
  strengths,
  blind_spots,
  growth_suggestions,
  base_prompt,
  matching_rules
) values (
  (select id from public.quiz_topics where slug = ${sqlString(topic.slug)}),
  ${sqlString(profile.profileKey)},
  ${sqlString(profile.title)},
  ${sqlString(profile.summary)},
  ${sqlTextArray(profile.strengths)},
  ${sqlTextArray(profile.blindSpots)},
  ${sqlTextArray(profile.growthSuggestions)},
  ${sqlString(profile.basePrompt)},
  ${sqlJson(profile.matchingRules)}
) on conflict (topic_id, profile_key) do update set
  title = excluded.title,
  summary = excluded.summary,
  strengths = excluded.strengths,
  blind_spots = excluded.blind_spots,
  growth_suggestions = excluded.growth_suggestions,
  base_prompt = excluded.base_prompt,
  matching_rules = excluded.matching_rules;`;
}

function buildSeedSql() {
  const statements = [
    "-- 這個檔案由 scripts/build-seed-assets.mjs 產生",
    "begin;",
  ];

  QUIZ_TOPICS.forEach((topic) => {
    statements.push(buildTopicInsert(topic));
    topic.questions.forEach((question) => {
      statements.push(buildQuestionInsert(topic, question));
      question.options.forEach((option, index) => {
        statements.push(buildOptionInsert(topic, question, option, index));
      });
    });
    topic.resultProfiles.forEach((profile) => {
      statements.push(buildProfileInsert(topic, profile));
    });
  });

  statements.push("commit;");
  statements.push("");

  return `${statements.join("\n\n")}\n`;
}

function buildExamplesMarkdown() {
  const lines = [
    "# 測驗內容範例",
    "",
    "這份文件由共用測驗內容來源自動產生。",
    "",
  ];

  QUIZ_TOPICS.forEach((topic) => {
    const sampleProfile = topic.resultProfiles[0];
    lines.push(`## ${topic.title}`);
    lines.push("");
    lines.push(`- 主題代稱：\`${topic.slug}\``);
    lines.push(`- 主題：${topic.shortTitle}`);
    lines.push(`- 題庫數量：${topic.questions.length}`);
    lines.push(`- 每次抽題：${topic.questionsPerSession}`);
    lines.push(`- 範例結果標題：${sampleProfile.title}`);
    lines.push(`- 範例結果敘述：${sampleProfile.summary}`);
    lines.push("");
    lines.push("### 前 10 題範例");
    lines.push("");

    topic.questions.slice(0, 10).forEach((question, questionIndex) => {
      lines.push(`${questionIndex + 1}. ${question.prompt}`);
      question.options.forEach((option) => {
        lines.push(`- ${option.optionKey}. ${option.text}`);
      });
      lines.push("");
    });
  });

  return `${lines.join("\n")}\n`;
}

async function main() {
  await mkdir(path.join(rootDir, "supabase"), { recursive: true });
  await mkdir(path.join(rootDir, "docs"), { recursive: true });

  await writeFile(path.join(rootDir, "supabase", "seed.sql"), buildSeedSql(), "utf8");
  await writeFile(
    path.join(rootDir, "docs", "quiz-content-examples.md"),
    buildExamplesMarkdown(),
    "utf8",
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
