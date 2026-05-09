import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";
import { join } from "path";
import { NextResponse } from "next/server";

const SYSTEM_PROMPT = `You are a senior design system practitioner helping a designer
decide one thing: should their component request be a NEW
COMPONENT or a VARIANT of an existing component?

You have 15+ years of experience building design systems at
scale. Your default stance is skeptical of new components.
Most requests are variants in disguise.

You will receive five answers about a proposed component.
Return one verdict with reasoning.

DECISION PRINCIPLES:

1. FREQUENCY GATES NEW COMPONENTS. One-off patterns are almost
   never new components. Patterns appearing in a few places
   lean variant. Patterns appearing everywhere lean new
   component.

2. SEMANTIC AND BEHAVIORAL DIFFERENCE BEATS VISUAL DIFFERENCE.
   A component that looks different but does the same job is
   a variant. A component with different user intent, different
   interaction patterns, or different accessibility semantics
   warrants new component status.

3. WATCH FOR OVERLOADING. If adding this as a variant would
   require the existing component's API to grow significantly —
   many new props, conditional logic, mode flags — that's a
   signal it should be a new component. Variants should feel
   like the same thing in a different outfit.

4. DRIVER MATTERS. Accessibility-driven requests get more
   benefit-of-the-doubt for new components. Designer preference
   ("I want it to look different") gets the most scrutiny.
   Brand and product requirements sit between.

OUTPUT FORMAT:

Return a JSON object with this exact shape, and nothing else
(no markdown, no preamble):
{
  "verdict": "VARIANT" or "NEW_COMPONENT",
  "reasoning": "2-3 sentences. Name the existing component if
                verdict is VARIANT. Be specific to what they
                described.",
  "next_step": "One concrete action they should take to move
                this forward."
}

TONE:
- Direct, not hedging.
- Skeptical of new components by default.`;

type RequestBody = {
  userApiKey?: string;
  job: string;
  closestComponents: string;
  differences: string;
  frequency: string;
  driver: string;
};

type TriageResponse = {
  verdict: "VARIANT" | "NEW_COMPONENT";
  reasoning: string;
  next_step: string;
};

const DEFAULT_DAILY_SERVER_TOKEN_LIMIT = 12000;
const DEFAULT_SERVER_MAX_OUTPUT_TOKENS = 450;
const SERVER_BUDGET_BUFFER_TOKENS = 800;
const USER_MAX_OUTPUT_TOKENS = 1024;

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const DAILY_SERVER_TOKEN_LIMIT = parsePositiveInt(
  process.env.DAILY_SERVER_TOKEN_LIMIT,
  DEFAULT_DAILY_SERVER_TOKEN_LIMIT
);
const SERVER_MAX_OUTPUT_TOKENS = parsePositiveInt(
  process.env.SERVER_MAX_OUTPUT_TOKENS,
  DEFAULT_SERVER_MAX_OUTPUT_TOKENS
);

type ServerBudgetState = {
  date: string;
  usedTokens: number;
};

const serverBudget: ServerBudgetState = {
  date: new Date().toISOString().slice(0, 10),
  usedTokens: 0
};

function getTodayUtcDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function resetBudgetIfNeeded() {
  const today = getTodayUtcDate();
  if (serverBudget.date !== today) {
    serverBudget.date = today;
    serverBudget.usedTokens = 0;
  }
}

function tryParseTriageResponse(rawText: string): TriageResponse | null {
  const candidates = [rawText];
  const firstBrace = rawText.indexOf("{");
  const lastBrace = rawText.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && firstBrace < lastBrace) {
    candidates.push(rawText.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as Partial<TriageResponse>;
      if (
        (parsed.verdict === "VARIANT" || parsed.verdict === "NEW_COMPONENT") &&
        typeof parsed.reasoning === "string" &&
        typeof parsed.next_step === "string"
      ) {
        return parsed as TriageResponse;
      }
    } catch {
      // Continue to next parse strategy.
    }
  }

  return null;
}

function extractTextContent(response: Anthropic.Messages.Message): string {
  return response.content
    .filter((item) => item.type === "text")
    .map((item) => item.text)
    .join("\n")
    .trim();
}

/**
 * Next.js does not override process.env keys that were already set (e.g. from
 * ~/.zshrc). In development, prefer .env.local so the file you edit is what runs.
 */
function readAnthropicKeyFromEnvLocal(): string | undefined {
  if (process.env.NODE_ENV !== "development") return undefined;
  try {
    const envPath = join(process.cwd(), ".env.local");
    const raw = readFileSync(envPath, "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      if (key !== "ANTHROPIC_API_KEY") continue;
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      return val || undefined;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function resolveServerAnthropicApiKey(): string | undefined {
  const fromFile = readAnthropicKeyFromEnvLocal();
  const fromProcess = process.env.ANTHROPIC_API_KEY;
  const chosen =
    process.env.NODE_ENV === "development"
      ? (fromFile ?? fromProcess)
      : (fromProcess ?? fromFile);
  return chosen?.trim() || undefined;
}

export async function POST(request: Request) {
  let usedUserKey = false;

  try {
    const body = (await request.json()) as Partial<RequestBody>;
    const providedApiKey = body.userApiKey?.trim();
    const serverApiKey = resolveServerAnthropicApiKey();
    const usingUserKey = Boolean(providedApiKey);
    usedUserKey = usingUserKey;
    const apiKey = providedApiKey || serverApiKey;

    const { job, closestComponents, differences, frequency, driver } = body;

    if (
      !job?.trim() ||
      !closestComponents?.trim() ||
      !differences?.trim() ||
      !frequency?.trim() ||
      !driver?.trim()
    ) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    if (!apiKey) {
      return NextResponse.json(
        {
          error: "No API key available. Add your own key or configure server key.",
          code: "MISSING_API_KEY"
        },
        { status: 503 }
      );
    }

    const userMessage = `Here are the designer's answers:

1. What the component needs to do: ${job}
2. Closest existing components: ${closestComponents}
3. What's different: ${differences}
4. Frequency: ${frequency}
5. Driver: ${driver}`;

    resetBudgetIfNeeded();
    if (!usingUserKey && serverBudget.usedTokens >= DAILY_SERVER_TOKEN_LIMIT) {
      return NextResponse.json(
        {
          error: "Daily server token limit reached. Add your own Claude API key.",
          code: "DAILY_SERVER_TOKEN_LIMIT_REACHED"
        },
        { status: 429 }
      );
    }

    const remainingServerTokens = DAILY_SERVER_TOKEN_LIMIT - serverBudget.usedTokens;
    if (!usingUserKey && remainingServerTokens < SERVER_BUDGET_BUFFER_TOKENS) {
      return NextResponse.json(
        {
          error: "Daily server token limit reached. Add your own Claude API key.",
          code: "DAILY_SERVER_TOKEN_LIMIT_REACHED"
        },
        { status: 429 }
      );
    }

    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: usingUserKey
        ? USER_MAX_OUTPUT_TOKENS
        : Math.min(SERVER_MAX_OUTPUT_TOKENS, remainingServerTokens),
      temperature: 0,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }]
    });

    if (!usingUserKey) {
      const inputTokens = response.usage?.input_tokens ?? 0;
      const outputTokens = response.usage?.output_tokens ?? 0;
      serverBudget.usedTokens += inputTokens + outputTokens;
    }

    const textContent = extractTextContent(response);

    let parsed = tryParseTriageResponse(textContent);
    if (!parsed) {
      const repairResponse = await anthropic.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: usingUserKey
          ? USER_MAX_OUTPUT_TOKENS
          : Math.min(SERVER_MAX_OUTPUT_TOKENS, remainingServerTokens),
        temperature: 0,
        system:
          "Convert the input into valid JSON only. Output exactly one JSON object with keys verdict, reasoning, next_step.",
        messages: [
          {
            role: "user",
            content: `Return this as strict JSON only:\n${textContent}`
          }
        ]
      });

      if (!usingUserKey) {
        const repairInputTokens = repairResponse.usage?.input_tokens ?? 0;
        const repairOutputTokens = repairResponse.usage?.output_tokens ?? 0;
        serverBudget.usedTokens += repairInputTokens + repairOutputTokens;
      }

      parsed = tryParseTriageResponse(extractTextContent(repairResponse));
    }

    if (!parsed) {
      return NextResponse.json(
        {
          error: "Claude returned an invalid response format.",
          code: "NON_CLAUDE_RESPONSE"
        },
        { status: 502 }
      );
    }

    return NextResponse.json(parsed);
  } catch (error: unknown) {
    if (error instanceof Anthropic.APIError) {
      if (error.status === 401) {
        return NextResponse.json(
          {
            error: usedUserKey
              ? "Provided Claude API key is invalid."
              : "Server Claude API key is invalid.",
            code: usedUserKey ? "USER_API_KEY_INVALID" : "SERVER_API_KEY_INVALID"
          },
          { status: 401 }
        );
      }
    }

    console.error("Triage API error:", error);
    return NextResponse.json(
      {
        error: "Unable to get a response from Claude right now.",
        code: "CLAUDE_REQUEST_FAILED"
      },
      { status: 502 }
    );
  }
}
