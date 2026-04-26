"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Image from "next/image";

type Frequency = "One place" | "A few places" | "Everywhere";
type Driver =
  | "Designer preference"
  | "Product requirement"
  | "Accessibility need"
  | "Brand requirement"
  | "Unclear";

type TriageForm = {
  userApiKey: string;
  job: string;
  closestComponents: string;
  differences: string;
  frequency: Frequency | "";
  driver: Driver | "";
};

type TriageResult = {
  verdict: "VARIANT" | "NEW_COMPONENT";
  reasoning: string;
  next_step: string;
};

const TIP_URL = "https://example.com/tip";
const DRAFT_STORAGE_KEY = "ds-triage-draft";

const initialForm: TriageForm = {
  userApiKey: "",
  job: "",
  closestComponents: "",
  differences: "",
  frequency: "",
  driver: ""
};

export default function HomePage() {
  const [form, setForm] = useState<TriageForm>(initialForm);
  const [tipChoice, setTipChoice] = useState<"tipped" | "skipped" | null>(null);
  const [result, setResult] = useState<TriageResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const rawDraft = window.localStorage.getItem(DRAFT_STORAGE_KEY);
      if (!rawDraft) return;

      const draft = JSON.parse(rawDraft) as Partial<
        Pick<TriageForm, "job" | "closestComponents" | "differences" | "frequency" | "driver">
      >;

      setForm((prev) => ({
        ...prev,
        job: typeof draft.job === "string" ? draft.job : prev.job,
        closestComponents:
          typeof draft.closestComponents === "string"
            ? draft.closestComponents
            : prev.closestComponents,
        differences:
          typeof draft.differences === "string" ? draft.differences : prev.differences,
        frequency:
          draft.frequency === "One place" ||
          draft.frequency === "A few places" ||
          draft.frequency === "Everywhere"
            ? draft.frequency
            : prev.frequency,
        driver:
          draft.driver === "Designer preference" ||
          draft.driver === "Product requirement" ||
          draft.driver === "Accessibility need" ||
          draft.driver === "Brand requirement" ||
          draft.driver === "Unclear"
            ? draft.driver
            : prev.driver
      }));
    } catch {
      // localStorage can be unavailable in some environments.
    }
  }, []);

  const handleTipChoice = (choice: "tipped" | "skipped") => {
    if (choice === "tipped") {
      try {
        window.localStorage.setItem(
          DRAFT_STORAGE_KEY,
          JSON.stringify({
            job: form.job,
            closestComponents: form.closestComponents,
            differences: form.differences,
            frequency: form.frequency,
            driver: form.driver
          })
        );
      } catch {
        // localStorage can be unavailable; proceed without draft save.
      }

      window.open(TIP_URL, "_blank", "noopener,noreferrer");
    }

    setTipChoice(choice);
  };

  const isFormValid = useMemo(
    () =>
      Boolean(
        form.job.trim() &&
          form.closestComponents.trim() &&
          form.differences.trim() &&
          form.frequency &&
          form.driver
      ),
    [form]
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isFormValid) return;

    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/triage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(form)
      });

      if (!response.ok) {
        const errorPayload = (await response.json().catch(() => null)) as
          | { code?: string }
          | null;

        if (errorPayload?.code === "DAILY_SERVER_TOKEN_LIMIT_REACHED") {
          throw new Error("SERVER_DAILY_LIMIT_REACHED");
        }

        if (errorPayload?.code === "MISSING_API_KEY") {
          throw new Error("NO_API_KEY_AVAILABLE");
        }

        throw new Error("REQUEST_FAILED");
      }

      const data = (await response.json()) as TriageResult;
      setResult(data);
      try {
        window.localStorage.removeItem(DRAFT_STORAGE_KEY);
      } catch {
        // localStorage can be unavailable in some environments.
      }
    } catch (err) {
      if (err instanceof Error && err.message === "SERVER_DAILY_LIMIT_REACHED") {
        setError("Server token budget is used up today. Add your own Claude API key.");
      } else if (err instanceof Error && err.message === "NO_API_KEY_AVAILABLE") {
        setError("Add your Claude API key to continue.");
      } else {
        setError("Something went wrong. Please try again.");
      }
      setResult(null);
    } finally {
      setIsLoading(false);
    }
  };

  const resetTool = () => {
    setForm(initialForm);
    setTipChoice(null);
    setResult(null);
    setError(null);
  };

  return (
    <main className="mx-auto w-full max-w-6xl px-5 pb-24 pt-14 sm:px-8 lg:px-10">
      <section className="space-y-8 lg:grid lg:grid-cols-12 lg:gap-8 lg:space-y-0">
        <div className="space-y-4 lg:col-span-7">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-zinc-200 bg-white shadow-sm">
            <Image
              src="/logo.png"
              alt="Design system triage logo"
              width={32}
              height={32}
              className="h-8 w-8 rounded"
              priority
            />
          </div>
          <h1 className="text-balance text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">
            Should this be a new component, or a variant?
          </h1>
          <p className="max-w-[60ch] text-base leading-7 text-zinc-600 sm:text-lg">
            A focused tool for the most common design system intake question.
          </p>
          <a
            href="#try-it"
            className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-300 focus:ring-offset-2"
          >
            Jump to tool
          </a>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:col-span-12">
          <article className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-5">
            <h2 className="text-lg font-semibold tracking-tight text-zinc-900">The problem</h2>
            <ul className="mt-3 list-disc space-y-2.5 pl-5 leading-7 text-zinc-700 marker:text-zinc-400">
              <li>
                Every DS team gets the same request, over and over: &quot;Can we add
                a new component for X?&quot;
              </li>
              <li>
                Most of the time, the answer is no — it&apos;s a variant of
                something you already have.
              </li>
              <li>
                But the conversation to get there is exhausting:
                <ul className="mt-2 list-disc space-y-1.5 pl-5 marker:text-zinc-400">
                  <li>Vocabulary mismatches.</li>
                  <li>Half-remembered components.</li>
                  <li>Requests that feel different but can&apos;t say why.</li>
                  <li>
                    Reviewers who push back but can&apos;t say why either.
                  </li>
                </ul>
              </li>
            </ul>
          </article>

          <article className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-5">
            <h2 className="text-lg font-semibold tracking-tight text-zinc-900">The tool</h2>
            <ul className="mt-3 list-disc space-y-2.5 pl-5 leading-7 text-zinc-700 marker:text-zinc-400">
              <li>Answer five questions about what you need.</li>
              <li>Get a direct verdict: variant or new component.</li>
              <li>Get reasoning a senior DS practitioner would give.</li>
              <li>Get one concrete next step to move the request forward.</li>
            </ul>
          </article>
        </div>

        <article className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50/70 p-5 lg:col-span-8">
          <h2 className="text-lg font-semibold tracking-tight text-zinc-900">What you get</h2>
          <ul className="list-disc space-y-2.5 pl-5 leading-7 text-zinc-700 marker:text-zinc-400">
            <li>Five-question intake (2-3 minutes).</li>
            <li>A clear verdict.</li>
            <li>Reasoning specific to what you described.</li>
            <li>A concrete next step.</li>
            <li>Works with any design system.</li>
          </ul>
        </article>

        <article className="space-y-3 lg:col-span-4">
          <h2 className="text-lg font-semibold tracking-tight text-zinc-900">Who built it</h2>
          <ul className="list-disc space-y-2.5 pl-5 leading-7 text-zinc-700 marker:text-zinc-400">
            <li>I&apos;ve spent 20+ years in UX and design systems work.</li>
            <li>
              Including intake and triage on a national-scale component library.
            </li>
            <li>
              This tool encodes the reasoning I&apos;d walk a designer through if
              they brought the request to me.
            </li>
          </ul>
        </article>

        <aside className="space-y-1 text-sm leading-6 text-zinc-500 lg:col-span-4 lg:col-start-9">
          <p>This is a weekend experiment.</p>
          <p>If the problem resonates, a fuller version is coming.</p>
          <p>
            Buying now tells me this is worth investing in further.
          </p>
        </aside>
      </section>

      <section
        id="try-it"
        className="mt-16 scroll-mt-8 border-t border-zinc-200 pt-12 lg:mx-auto lg:max-w-3xl"
      >
        <h2 className="text-2xl font-semibold tracking-tight text-zinc-900">Try it</h2>

        {!result ? (
          <form className="mt-8 space-y-7 rounded-2xl border border-zinc-200 bg-zinc-50/60 p-5 sm:p-6" onSubmit={handleSubmit}>
            {error ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {error}
              </p>
            ) : null}

            <label className="block space-y-2">
              <span className="text-sm font-medium text-zinc-800">
                Claude API key (optional)
              </span>
              <input
                type="password"
                value={form.userApiKey}
                disabled={isLoading}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, userApiKey: event.target.value }))
                }
                placeholder="sk-ant-..."
                className="h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-zinc-900 placeholder:text-zinc-400 transition focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-100"
              />
              <span className="block text-xs leading-5 text-zinc-500">
                If provided, this request uses your key instead of the server key.
              </span>
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-zinc-800">
                What does this component need to do?
              </span>
              <input
                required
                type="text"
                value={form.job}
                disabled={isLoading}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, job: event.target.value }))
                }
                placeholder="One sentence describing the component&apos;s job"
                className="h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-zinc-900 placeholder:text-zinc-400 transition focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-100"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-zinc-800">
                What existing components in your system are closest?
              </span>
              <input
                required
                type="text"
                value={form.closestComponents}
                disabled={isLoading}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    closestComponents: event.target.value
                  }))
                }
                placeholder="List 1-3 components, or write &apos;not sure&apos;"
                className="h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-zinc-900 placeholder:text-zinc-400 transition focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-100"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-zinc-800">
                What&apos;s different about what you need?
              </span>
              <textarea
                required
                rows={3}
                value={form.differences}
                disabled={isLoading}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    differences: event.target.value
                  }))
                }
                placeholder="Visual style, behavior, content structure, semantics, accessibility..."
                className="w-full resize-y rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder:text-zinc-400 transition focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-100"
              />
            </label>

            <fieldset className="space-y-3" disabled={isLoading}>
              <legend className="text-sm font-medium text-zinc-800">
                How often will this pattern appear?
              </legend>
              {(["One place", "A few places", "Everywhere"] as const).map(
                (option) => (
                  <label
                    key={option}
                    className="flex min-h-11 items-center gap-2 rounded-md px-2 text-zinc-700"
                  >
                    <input
                      required
                      type="radio"
                      name="frequency"
                      value={option}
                      checked={form.frequency === option}
                      onChange={() =>
                        setForm((prev) => ({ ...prev, frequency: option }))
                      }
                      className="h-4 w-4 border-zinc-300 text-zinc-900 focus:ring-zinc-300"
                    />
                    <span>{option}</span>
                  </label>
                )
              )}
            </fieldset>

            <fieldset className="space-y-3" disabled={isLoading}>
              <legend className="text-sm font-medium text-zinc-800">
                What&apos;s driving the request?
              </legend>
              {(
                [
                  "Designer preference",
                  "Product requirement",
                  "Accessibility need",
                  "Brand requirement",
                  "Unclear"
                ] as const
              ).map((option) => (
                <label
                  key={option}
                  className="flex min-h-11 items-center gap-2 rounded-md px-2 text-zinc-700"
                >
                  <input
                    required
                    type="radio"
                    name="driver"
                    value={option}
                    checked={form.driver === option}
                    onChange={() => setForm((prev) => ({ ...prev, driver: option }))}
                    className="h-4 w-4 border-zinc-300 text-zinc-900 focus:ring-zinc-300"
                  />
                  <span>{option}</span>
                </label>
              ))}
            </fieldset>

            <div className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4">
              <p className="text-sm font-medium text-zinc-800">Before you run it:</p>

              {tipChoice === null ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => handleTipChoice("tipped")}
                    className="rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-3 text-left transition hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-300 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span className="block text-sm font-medium text-zinc-900">Leave a $1 tip</span>
                    <span className="mt-1 block text-xs leading-5 text-zinc-500">
                      Opens in a new tab. Your answers will be saved.
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => handleTipChoice("skipped")}
                    className="rounded-lg border border-zinc-300 bg-white px-3 py-3 text-left transition hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-300 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span className="block text-sm font-medium text-zinc-900">Skip — just run it</span>
                    <span className="mt-1 block text-xs leading-5 text-zinc-500">
                      No tip, no problem.
                    </span>
                  </button>
                </div>
              ) : (
                <p className="text-sm leading-6 text-zinc-600">
                  {tipChoice === "tipped"
                    ? "Thanks. Run it whenever you're ready."
                    : "All set. Run it whenever you're ready."}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading || !isFormValid || tipChoice === null}
              className="inline-flex h-11 items-center justify-center rounded-md bg-zinc-900 px-5 text-sm font-medium text-white transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-300 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-zinc-400"
            >
              {isLoading ? "Thinking..." : "Get verdict"}
            </button>
          </form>
        ) : (
          <div className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-7">
            <span
              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold tracking-wide ${
                result.verdict === "VARIANT"
                  ? "bg-indigo-100 text-indigo-700"
                  : "bg-amber-100 text-amber-700"
              }`}
            >
              {result.verdict === "VARIANT" ? "VARIANT" : "NEW COMPONENT"}
            </span>

            <p className="mt-4 leading-7 text-zinc-700">{result.reasoning}</p>
            <p className="mt-3 leading-7 text-zinc-700">
              <span className="font-semibold text-zinc-900">Next step:</span>{" "}
              {result.next_step}
            </p>

            <button
              type="button"
              onClick={resetTool}
              className="mt-6 inline-flex h-10 items-center justify-center rounded-md border border-zinc-300 px-4 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-300 focus:ring-offset-2"
            >
              Start over
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
