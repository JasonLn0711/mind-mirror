import { handleOptions, json } from "../_shared/cors.ts";
import { getAdminClient } from "../_shared/db.ts";

Deno.serve(async (request) => {
  const optionsResponse = handleOptions(request);
  if (optionsResponse) {
    return optionsResponse;
  }

  if (request.method !== "GET") {
    return json({ error: "Method not allowed." }, 405);
  }

  try {
    const slug = new URL(request.url).searchParams.get("slug");
    if (!slug) {
      return json({ error: "slug is required." }, 400);
    }

    const admin = getAdminClient();
    const { data: topic, error } = await admin
      .from("quiz_topics")
      .select("*")
      .eq("slug", slug)
      .eq("status", "active")
      .single();

    if (error || !topic) {
      return json({ error: "Quiz topic not found." }, 404);
    }

    return json({
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
      locale: topic.locale,
      questionPoolSize: topic.question_pool_size,
      questionsPerSession: topic.questions_per_session,
      axes: topic.axis_config?.axes || [],
      tagLabels: topic.tag_labels || {},
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
