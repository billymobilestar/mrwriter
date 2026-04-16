import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const { thread, comments } = await req.json();

    if (!thread || !comments || !Array.isArray(comments)) {
      return NextResponse.json({ error: "Thread and comments are required" }, { status: 400 });
    }

    // Build the conversation text for Claude
    const conversationText = comments
      .map((c: { author: string; body: string; depth: number }) => {
        const indent = "  ".repeat(c.depth);
        return `${indent}${c.author}: ${c.body}`;
      })
      .join("\n\n");

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: `You are a screenwriter adapting a Reddit thread into a screenplay using Fountain format.

Thread title: "${thread.title}"
Subreddit: r/${thread.subreddit}

Here is the conversation:

${conversationText}

Convert this into a properly formatted Fountain screenplay. Follow these rules:

1. Start with a title page:
   Title: ${thread.title}
   Credit: Based on r/${thread.subreddit}
   Author: Reddit Users
   Draft date: ${new Date().toLocaleDateString()}

2. After "===" (title page break), write "FADE IN:"

3. Use scene headings like "INT. REDDIT THREAD - NIGHT" to establish setting

4. Convert usernames to CHARACTER NAMES (clean up underscores/numbers, uppercase)

5. Convert comments to natural-sounding DIALOGUE:
   - Clean up Reddit-speak, abbreviations, and internet slang
   - Remove "edit:" notices, award acknowledgments
   - Make it sound like natural spoken dialogue
   - Keep the original meaning and emotion

6. Add ACTION lines between dialogue to describe the scene, mood, reactions

7. Add PARENTHETICALS where tone is implied (sarcasm, whispering, etc.)

8. Group related exchanges into scenes with appropriate scene headings

9. End with "FADE OUT."

Output ONLY the Fountain formatted screenplay, nothing else.`,
        },
      ],
    });

    const content = message.content[0];
    const fountain = content.type === "text" ? content.text : "";

    return NextResponse.json({ fountain });
  } catch (error) {
    console.error("AI analysis error:", error);
    return NextResponse.json(
      { error: "Failed to analyze with AI" },
      { status: 500 }
    );
  }
}
