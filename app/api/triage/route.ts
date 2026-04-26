import Anthropic from "@anthropic-ai/sdk";
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

const DAILY_SERVER_TOKEN_LIMIT = 100;

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

function runLocalTriage({
  closestComponents,
  differences,
  frequency,
  driver
}: Pick<RequestBody, "closestComponents" | "differences" | "frequency" | "driver">): TriageResponse {
  const frequencyText = frequency.toLowerCase();
  const differencesText = differences.toLowerCase();
  const driverText = driver.toLowerCase();
  const closest = closestComponents.trim() || "an existing component";

  const hasStrongNewSignals =
    frequencyText.includes("everywhere") ||
    driverText.includes("accessibility") ||
    differencesText.includes("semantic") ||
    differencesText.includes("behavior") ||
    differencesText.includes("keyboard") ||
    differencesText.includes("screen reader") ||
    differencesText.includes("workflow") ||
    differencesText.includes("intent");

  const hasVariantSignals =
    frequencyText.includes("one place") ||
    frequencyText.includes("few") ||
    driverText.includes("designer preference") ||
    differencesText.includes("visual") ||
    differencesText.includes("style") ||
    differencesText.includes("color") ||
    differencesText.includes("size") ||
    differencesText.includes("spacing");

  if (hasStrongNewSignals && !hasVariantSignals) {
    return {
      verdict: "NEW_COMPONENT",
      reasoning:
        "This reads like a distinct job with meaningful behavioral or semantic differences, not a styling tweak. Given the expected usage and constraints, forcing this into an existing API is likely to create overloaded props and fragile logic.",
      next_step:
        "Draft a minimal API and accessibility contract for this as a separate component, then validate it against two real product use cases before implementation."
    };
  }

  return {
    verdict: "VARIANT",
    reasoning: `The request is closer to ${closest} than to a net-new pattern, and the differences sound mostly presentational or scope-limited. That is usually better handled as a variant so the system stays simpler and avoids component sprawl.`,
    next_step:
      "Propose a variant spec on the closest existing component (props, states, and examples) and review it with your DS maintainers."
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<RequestBody>;
    const providedApiKey = body.userApiKey?.trim();
    const serverApiKey = process.env.ANTHROPIC_API_KEY;
    const usingUserKey = Boolean(providedApiKey);
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
        runLocalTriage({ closestComponents, differences, frequency, driver })
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
    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: usingUserKey ? 1024 : Math.max(1, Math.min(1024, remainingServerTokens)),
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }]
    });

    if (!usingUserKey) {
      const inputTokens = response.usage?.input_tokens ?? 0;
      const outputTokens = response.usage?.output_tokens ?? 0;
      serverBudget.usedTokens += inputTokens + outputTokens;
    }

    const textContent = response.content
      .filter((item) => item.type === "text")
      .map((item) => item.text)
      .join("\n")
      .trim();

    const parsed = tryParseTriageResponse(textContent);
    if (!parsed) {
      return NextResponse.json(
        runLocalTriage({ closestComponents, differences, frequency, driver })
      );
    }

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("Triage API error:", error);
    return NextResponse.json({ error: "Failed to complete triage" }, { status: 500 });
  }
}
