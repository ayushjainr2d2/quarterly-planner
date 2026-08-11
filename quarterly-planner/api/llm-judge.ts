import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * Generic OpenAI proxy — the API key only ever lives here, server-side.
 * The browser calls this endpoint; this endpoint calls OpenAI.
 *
 * Every "LLM judge" feature (Reach/Impact scoring, conflict summaries, etc.)
 * reuses this single route by sending its own system/user prompt — no new
 * endpoint needed per feature, and no new place the key could leak from.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "Server is not configured with an OpenAI API key." });
    return;
  }

  const { systemPrompt, userPrompt, model = "gpt-4o-mini", jsonMode = false } = (req.body ?? {}) as {
    systemPrompt?: string;
    userPrompt?: string;
    model?: string;
    jsonMode?: boolean;
  };

  if (!userPrompt) {
    res.status(400).json({ error: "userPrompt is required." });
    return;
  }

  try {
    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
          { role: "user", content: userPrompt },
        ],
        temperature: 0,
        ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
      }),
    });

    if (!openaiRes.ok) {
      const detail = await openaiRes.text();
      res.status(openaiRes.status).json({ error: `OpenAI request failed: ${detail}` });
      return;
    }

    const data = (await openaiRes.json()) as { choices?: { message?: { content?: string } }[] };
    const content: string = data.choices?.[0]?.message?.content ?? "";
    res.status(200).json({ content });
  } catch {
    res.status(502).json({ error: "Could not reach OpenAI." });
  }
}
