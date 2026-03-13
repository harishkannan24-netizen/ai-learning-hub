import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { topic, content } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const prompt = content
      ? `Based on this document content, create a short explainer video script with exactly 6-8 scenes. Document:\n${content.slice(0, 30000)}`
      : `Create a short explainer video script about "${topic}" with exactly 6-8 scenes.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are a video script generator. Return ONLY valid JSON with this structure:
{
  "title": "Video Title",
  "scenes": [
    {
      "title": "Scene Title",
      "narration": "What the narrator says (2-3 sentences)",
      "visual": "Description of what's shown on screen",
      "icon": "one of: book, lightbulb, target, chart, users, shield, rocket, star, globe, heart, code, brain, zap, layers",
      "bgColor": "one of: blue, violet, emerald, orange, pink, indigo, fuchsia, sky, lime, red, cyan, teal, amber, rose"
    }
  ]
}
No markdown, no extra text.`
          },
          { role: "user", content: prompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "create_video_script",
              description: "Create a structured video script with scenes",
              parameters: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  scenes: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        narration: { type: "string" },
                        visual: { type: "string" },
                        icon: { type: "string" },
                        bgColor: { type: "string" },
                      },
                      required: ["title", "narration", "visual", "icon", "bgColor"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["title", "scenes"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "create_video_script" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const videoData = JSON.parse(toolCall.function.arguments);
      return new Response(JSON.stringify(videoData), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fallback: try parsing content directly
    const content2 = data.choices?.[0]?.message?.content || "";
    const jsonMatch = content2.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return new Response(jsonMatch[0], {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Failed to generate video script");
  } catch (e) {
    console.error("generate-video error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
