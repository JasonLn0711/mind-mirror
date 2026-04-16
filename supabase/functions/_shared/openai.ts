export async function generateMirrorInsight(input: {
  topicTitle: string;
  profileTitle: string;
  narrative: string;
  topTags: Array<{ label: string }>;
  strengths: string[];
  blindSpots: string[];
}) {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  const model = Deno.env.get("OPENAI_MODEL");

  if (!apiKey || !model) {
    return "";
  }

  const prompt = [
    `主題：${input.topicTitle}`,
    `結果標題：${input.profileTitle}`,
    `結果摘要：${input.narrative}`,
    `高頻心理線索：${input.topTags.map((entry) => entry.label).join("、") || "無"}`,
    `優勢：${input.strengths.join("；")}`,
    `盲點：${input.blindSpots.join("；")}`,
    "請用繁體中文寫 80 到 120 字的補充洞察。",
    "口吻：溫柔、貼近、像被理解。",
    "禁止：診斷、病理化、命令式說教。",
  ].join("\n");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.8,
      max_tokens: 180,
      messages: [
        {
          role: "system",
          content: "You write warm, concise mirror-style self-discovery insights in Traditional Chinese.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    return "";
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.content?.trim?.() || "";
}
