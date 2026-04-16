import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

type Action =
  | "rewrite"
  | "polish"
  | "analyze"
  | "characters"
  | "pacing"
  | "custom";

const SYSTEM_PROMPT = `You are an expert screenwriter and script consultant. You work with Fountain-formatted screenplays. When outputting screenplay content, always use proper Fountain format.`;

const ACTION_PROMPTS: Record<Exclude<Action, "custom">, string> = {
  rewrite: `Rewrite the following screenplay passage. Make the dialogue more natural, vivid, and cinematic. Tighten action lines. Keep the same story beats and characters but elevate the writing quality. Output ONLY the rewritten Fountain-formatted screenplay — no commentary.`,

  polish: `Polish this screenplay passage. Fix formatting issues, clean up dialogue to sound more natural, add missing parentheticals where tone is implied, ensure scene headings are correct, and tighten action descriptions. Make minimal changes — preserve the writer's voice. Output ONLY the polished Fountain-formatted screenplay — no commentary.`,

  analyze: `Analyze this screenplay passage as a script consultant would. Cover:

- **Story & Structure**: Does the scene have a clear purpose? Is there conflict or tension?
- **Dialogue**: Does it sound natural? Is each character's voice distinct?
- **Pacing**: Is the scene too long or too short? Does it drag anywhere?
- **Action Lines**: Are they visual and cinematic? Or too novelistic?
- **Formatting**: Any Fountain formatting issues?
- **Suggestions**: Specific, actionable improvements.

Be direct and constructive. Reference specific lines.`,

  characters: `Analyze the characters in this screenplay passage:

- List each character who appears
- Describe their voice and personality based on their dialogue
- Note if any characters sound too similar
- Identify each character's objective in the scene
- Suggest ways to make each character more distinct
- Note any character inconsistencies

Be specific — quote dialogue to support your observations.`,

  pacing: `Analyze the pacing and structure of this screenplay passage:

- Is the scene too long, too short, or about right?
- Where does it drag or feel rushed?
- Is there a clear beginning, middle, and end to the scene?
- Are there any unnecessary lines that could be cut?
- Does the scene enter late and leave early (as good scenes should)?
- How does the rhythm of dialogue vs. action work?

Provide specific line-by-line suggestions for tightening or expanding.`,
};

export async function POST(req: NextRequest) {
  try {
    const { text, action, customPrompt } = await req.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "Text is required" },
        { status: 400 }
      );
    }

    if (!action || typeof action !== "string") {
      return NextResponse.json(
        { error: "Action is required" },
        { status: 400 }
      );
    }

    let userPrompt: string;
    if (action === "custom") {
      if (!customPrompt || typeof customPrompt !== "string") {
        return NextResponse.json(
          { error: "Custom prompt is required for custom action" },
          { status: 400 }
        );
      }
      userPrompt = `${customPrompt}\n\nHere is the screenplay passage:\n\n${text}`;
    } else {
      const actionPrompt = ACTION_PROMPTS[action as Exclude<Action, "custom">];
      if (!actionPrompt) {
        return NextResponse.json(
          { error: "Invalid action" },
          { status: 400 }
        );
      }
      userPrompt = `${actionPrompt}\n\nHere is the screenplay passage:\n\n${text}`;
    }

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    const content = message.content[0];
    const result = content.type === "text" ? content.text : "";

    return NextResponse.json({ result });
  } catch (error) {
    console.error("AI script analysis error:", error);
    return NextResponse.json(
      { error: "AI analysis failed. Please try again." },
      { status: 500 }
    );
  }
}
