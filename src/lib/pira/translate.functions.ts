import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const translateText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { text: string; to: "en" | "ja" }) => {
    const text = String(input?.text ?? "").slice(0, 4000);
    if (!text.trim()) throw new Error("文章を入力してください");
    return { text, to: input.to === "ja" ? ("ja" as const) : ("en" as const) };
  })
  .handler(async ({ data }) => {
    const { generateResponse, GatewayError } = await import("@lovable.dev/ai-gateway");
    const target = data.to === "en" ? "English" : "Japanese";
    try {
      const res = await generateResponse({
        model: "openai/gpt-6-astra",
        instructions: `You are a translator. Translate the user's text into natural ${target}. Reply with the translation only.`,
        input: data.text,
      });
      let out = "";
      for (const item of (res as { output?: Array<{ type: string; content?: Array<{ type: string; text?: string }> }> }).output ?? []) {
        if (item.type !== "message") continue;
        for (const c of item.content ?? []) if (c.type === "output_text" && c.text) out += c.text;
      }
      return { text: out.trim() };
    } catch (e) {
      if (e instanceof GatewayError) {
        if (e.httpStatus === 429) throw new Error("混み合っています。少し待ってからもう一度どうぞ。");
        if (e.httpStatus === 402) throw new Error("AIのクレジットが不足しています。");
      }
      throw new Error("翻訳できませんでした。");
    }
  });
