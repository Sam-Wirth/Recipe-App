import Anthropic from '@anthropic-ai/sdk';

// One shared Claude client for all server routes. Reads ANTHROPIC_API_KEY from .env.local.
export const ai = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY ?? 'missing-key',
});

// Change the model in .env.local with AI_MODEL=... without touching code.
// claude-haiku-5-5 is a cheaper, faster option if cost matters more than recipe quality.
export const AI_MODEL = process.env.AI_MODEL ?? 'claude-sonnet-5-5';

/** Pull the input of a forced tool call out of a Claude message. */
export function extractToolInput(message: Anthropic.Message, toolName: string): unknown {
  const block = message.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === toolName,
  );
  return block?.input ?? null;
}

/** Map API errors to a status code and a user-facing message. */
export function aiErrorResponse(error: unknown): { status: number; message: string } {
  if (error instanceof Anthropic.APIError) {
    if (error.status === 401)
      return { status: 502, message: 'Claude rejected the API key. Check ANTHROPIC_API_KEY in .env.local.' };
    if (error.status === 429) return { status: 429, message: 'Rate limited — wait a moment and try again.' };
    if (error.status === 400 && /credit balance/i.test(error.message))
      return { status: 502, message: 'Your Anthropic account is out of credits. Add some under Billing.' };
    if (error.status === 529) return { status: 503, message: 'Claude is temporarily overloaded — try again shortly.' };
    return { status: 502, message: 'The AI service returned an error.' };
  }
  return { status: 500, message: 'Unexpected server error.' };
}
