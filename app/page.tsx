"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";

type Frequency = "One place" | "A few places" | "Everywhere";
type Driver =
  | "Designer preference"
  | "Product requirement"
  | "Accessibility need"
  | "Brand requirement"
  | "Unclear";

const CLOSEST_OTHER_ID = "__other__";
const MAX_CLOSEST_SELECTIONS = 5;

const CLOSEST_COMPONENT_OPTIONS = [
  { id: "button", label: "Button / icon button" },
  { id: "input", label: "Input / text field" },
  { id: "textarea", label: "Textarea" },
  { id: "select", label: "Select / dropdown / combobox" },
  { id: "selection", label: "Checkbox / radio / switch / toggle" },
  { id: "card", label: "Card" },
  { id: "modal", label: "Modal / dialog" },
  { id: "drawer", label: "Drawer / sheet / side panel" },
  { id: "popover", label: "Popover / tooltip / menu surface" },
  { id: "tabs", label: "Tabs / segmented control" },
  { id: "accordion", label: "Accordion / disclosure" },
  { id: "list", label: "List / list item / row" },
  { id: "table", label: "Table / data grid" },
  { id: "badge", label: "Badge / chip / tag" },
  { id: "avatar", label: "Avatar / thumbnail" },
  { id: "alert", label: "Alert / banner / inline message / toast" },
  { id: "nav", label: "Navigation / menu / breadcrumb" },
  { id: "datepicker", label: "Date or time picker" },
  { id: "feedback", label: "Loading / progress / skeleton" },
  { id: "divider", label: "Divider / separator" },
  { id: CLOSEST_OTHER_ID, label: "Other" }
] as const;

type ClosestComponentId = (typeof CLOSEST_COMPONENT_OPTIONS)[number]["id"];

const CLOSEST_ID_SET = new Set<string>(CLOSEST_COMPONENT_OPTIONS.map((o) => o.id));

const CLOSEST_LABEL_BY_ID: Record<ClosestComponentId, string> =
  CLOSEST_COMPONENT_OPTIONS.reduce(
    (acc, o) => {
      acc[o.id] = o.label;
      return acc;
    },
    {} as Record<ClosestComponentId, string>
  );

function formatClosestComponentsForApi(
  selections: ClosestComponentId[],
  otherText: string
): string {
  const core = selections.filter((id) => id !== CLOSEST_OTHER_ID);
  const parts = core.map((id) => CLOSEST_LABEL_BY_ID[id]);
  if (selections.includes(CLOSEST_OTHER_ID)) {
    const detail = otherText.trim();
    parts.push(detail ? `Other (${detail})` : "Other");
  }
  return parts.join("; ");
}

function closestChipLabel(id: ClosestComponentId, otherText: string): string {
  if (id === CLOSEST_OTHER_ID) {
    const t = otherText.trim();
    return t ? `Other: ${t.length > 36 ? `${t.slice(0, 36)}…` : t}` : "Other";
  }
  return CLOSEST_LABEL_BY_ID[id];
}

type TriageForm = {
  userApiKey: string;
  job: string;
  closestSelections: ClosestComponentId[];
  closestOtherText: string;
  differences: string;
  frequency: Frequency | "";
  driver: Driver | "";
};

type TriageResult = {
  verdict: "VARIANT" | "NEW_COMPONENT";
  reasoning: string;
  next_step: string;
};

const TIP_URL = "https://ko-fi.com/melvinhogan";
const DRAFT_STORAGE_KEY = "ds-triage-draft";

const initialForm: TriageForm = {
  userApiKey: "",
  job: "",
  closestSelections: [],
  closestOtherText: "",
  differences: "",
  frequency: "",
  driver: ""
};

export default function HomePage() {
  const [form, setForm] = useState<TriageForm>(initialForm);
  const [closestOpen, setClosestOpen] = useState(false);
  const closestDropdownRef = useRef<HTMLDivElement>(null);
  const [tipChoice, setTipChoice] = useState<"tipped" | "skipped" | null>(null);
  const [result, setResult] = useState<TriageResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsUserApiKey, setNeedsUserApiKey] = useState(false);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!closestOpen) return;
      const node = closestDropdownRef.current;
      if (node && !node.contains(event.target as Node)) {
        setClosestOpen(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [closestOpen]);

  useEffect(() => {
    try {
      const rawDraft = window.localStorage.getItem(DRAFT_STORAGE_KEY);
      if (!rawDraft) return;

      const draft = JSON.parse(rawDraft) as Partial<
        Pick<
          TriageForm,
          | "job"
          | "closestSelections"
          | "closestOtherText"
          | "differences"
          | "frequency"
          | "driver"
        >
      >;

      setForm((prev) => ({
        ...prev,
        job: typeof draft.job === "string" ? draft.job : prev.job,
        closestSelections: Array.isArray(draft.closestSelections)
          ? draft.closestSelections.filter(
              (id): id is ClosestComponentId =>
                typeof id === "string" && CLOSEST_ID_SET.has(id)
            )
          : prev.closestSelections,
        closestOtherText:
          typeof draft.closestOtherText === "string"
            ? draft.closestOtherText
            : prev.closestOtherText,
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
            closestSelections: form.closestSelections,
            closestOtherText: form.closestOtherText,
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

  const closestFieldValid = useMemo(() => {
    const count = form.closestSelections.length;
    const inRange = count >= 1 && count <= MAX_CLOSEST_SELECTIONS;
    const needsOtherDetail = form.closestSelections.includes(CLOSEST_OTHER_ID);
    const otherOk = !needsOtherDetail || Boolean(form.closestOtherText.trim());
    return inRange && otherOk;
  }, [form.closestOtherText, form.closestSelections]);

  const isFormValid = useMemo(
    () =>
      Boolean(
        form.job.trim() &&
          closestFieldValid &&
          form.differences.trim() &&
          form.frequency &&
          form.driver
      ),
    [closestFieldValid, form]
  );

  const toggleClosestSelection = (id: ClosestComponentId) => {
    setForm((prev) => {
      const has = prev.closestSelections.includes(id);
      if (has) {
        return {
          ...prev,
          closestSelections: prev.closestSelections.filter((x) => x !== id),
          ...(id === CLOSEST_OTHER_ID ? { closestOtherText: "" } : {})
        };
      }
      if (prev.closestSelections.length >= MAX_CLOSEST_SELECTIONS) {
        return prev;
      }
      return {
        ...prev,
        closestSelections: [...prev.closestSelections, id]
      };
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isFormValid) return;

    setError(null);
    setIsLoading(true);

    try {
      const closestComponents = formatClosestComponentsForApi(
        form.closestSelections,
        form.closestOtherText
      );

      const response = await fetch("/api/triage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          job: form.job,
          closestComponents,
          differences: form.differences,
          frequency: form.frequency,
          driver: form.driver,
          userApiKey: form.userApiKey.trim()
        })
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

        if (errorPayload?.code === "NON_CLAUDE_RESPONSE") {
          throw new Error("NON_CLAUDE_RESPONSE");
        }

        if (errorPayload?.code === "CLAUDE_REQUEST_FAILED") {
          throw new Error("CLAUDE_REQUEST_FAILED");
        }

        if (errorPayload?.code === "USER_API_KEY_INVALID") {
          throw new Error("USER_API_KEY_INVALID");
        }

        if (errorPayload?.code === "SERVER_API_KEY_INVALID") {
          throw new Error("SERVER_API_KEY_INVALID");
        }

        throw new Error("REQUEST_FAILED");
      }

      const data = (await response.json()) as TriageResult;
      setResult(data);
      setNeedsUserApiKey(false);
      try {
        window.localStorage.removeItem(DRAFT_STORAGE_KEY);
      } catch {
        // localStorage can be unavailable in some environments.
      }
    } catch (err) {
      if (err instanceof Error && err.message === "SERVER_DAILY_LIMIT_REACHED") {
        setNeedsUserApiKey(true);
        setError("Server token budget is used up today. Add your own Claude API key.");
      } else if (err instanceof Error && err.message === "NO_API_KEY_AVAILABLE") {
        setNeedsUserApiKey(true);
        setError("Add your Claude API key to continue.");
      } else if (
        err instanceof Error &&
        (err.message === "NON_CLAUDE_RESPONSE" || err.message === "CLAUDE_REQUEST_FAILED")
      ) {
        setError("We couldn't get a Claude-generated answer. Please try again.");
      } else if (err instanceof Error && err.message === "USER_API_KEY_INVALID") {
        setNeedsUserApiKey(true);
        setError(
          "Anthropic rejected the key in this box. Use a fresh API key from console.anthropic.com—or clear the box to use ANTHROPIC_API_KEY from .env.local instead."
        );
      } else if (err instanceof Error && err.message === "SERVER_API_KEY_INVALID") {
        setNeedsUserApiKey(true);
        setError(
          "Anthropic rejected ANTHROPIC_API_KEY from .env.local. Create a new key at console.anthropic.com and replace the value, then restart npm run dev—or paste a working key above."
        );
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
    setNeedsUserApiKey(false);
  };

  return (
    <main className="mx-auto w-full max-w-[1240px] pb-24 pt-0">
      <section className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] mb-24 w-screen overflow-hidden border-b border-[#242728] bg-[#07080a] px-5 pb-16 pt-14 sm:px-8 lg:px-10">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40">
          <div className="absolute -left-[10%] top-0 h-10 w-[130%] -rotate-6 bg-gradient-to-r from-[#ff5757] to-[#a1131a] opacity-80" />
          <div className="absolute -left-[8%] top-8 h-10 w-[130%] -rotate-6 bg-gradient-to-r from-[#ff5757] to-[#a1131a] opacity-65" />
          <div className="absolute -left-[6%] top-16 h-10 w-[130%] -rotate-6 bg-gradient-to-r from-[#ff5757] to-[#a1131a] opacity-50" />
        </div>
        <div className="mx-auto grid max-w-[1240px] gap-10 pt-20 lg:grid-cols-12">
          <div className="space-y-5 lg:col-span-6">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg border border-[#242728] bg-[#121212]">
              <Image
                src="/logo.png"
                alt="Design system triage logo"
                width={32}
                height={32}
                className="h-8 w-8 rounded-md"
                priority
              />
            </div>
            <h1 className="text-balance text-4xl font-semibold leading-[1.1] tracking-tight text-[#f4f4f6] sm:text-5xl lg:text-6xl">
              Is it component?
            </h1>
            <p className="max-w-[60ch] text-base leading-7 text-[#cdcdcd] sm:text-lg">
              A focused tool for the most common design system intake question.
            </p>
            <a
              href="#try-it"
              className="inline-flex h-10 items-center justify-center rounded-md border border-[#242728] bg-[#ffffff] px-4 text-sm font-medium text-[#000000] transition hover:bg-[#e8e8e8] focus:outline-none focus:ring-2 focus:ring-[#ffffff]/30"
            >
              Jump to tool
            </a>
          </div>
          <article className="rounded-lg border border-[#242728] bg-[#0d0d0d] p-5 lg:col-span-6">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#242728] bg-[#121212]">
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="h-4 w-4 text-[#ff5757]"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="8" />
                  <path d="M12 8v4" />
                  <circle cx="12" cy="15.5" r="0.8" fill="currentColor" stroke="none" />
                </svg>
              </span>
              <h2 className="text-lg font-medium tracking-tight text-[#f4f4f6]">The problem</h2>
            </div>
            <ul className="mt-3 list-disc space-y-2.5 pl-5 leading-7 text-[#cdcdcd] marker:text-[#6a6b6c]">
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
                <ul className="mt-2 list-disc space-y-1.5 pl-5 marker:text-[#6a6b6c]">
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
        </div>
      </section>

      <section className="space-y-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:col-span-12">
          <article className="rounded-lg border border-[#242728] bg-[#0d0d0d] p-5">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#242728] bg-[#121212]">
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="h-4 w-4 text-[#ff5757]"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M4 7h10" />
                  <path d="M4 17h16" />
                  <circle cx="16" cy="7" r="2.2" />
                  <circle cx="8" cy="17" r="2.2" />
                </svg>
              </span>
              <h2 className="text-lg font-medium tracking-tight text-[#f4f4f6]">The tool</h2>
            </div>
            <ul className="mt-3 list-disc space-y-2.5 pl-5 leading-7 text-[#cdcdcd] marker:text-[#6a6b6c]">
              <li>Answer five questions about what you need.</li>
              <li>Get a direct verdict: variant or new component.</li>
              <li>Get reasoning a senior DS practitioner would give.</li>
              <li>Get one concrete next step to move the request forward.</li>
            </ul>
          </article>

          <article className="space-y-3 rounded-lg border border-[#242728] bg-[#0d0d0d] p-5">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#242728] bg-[#121212]">
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="h-4 w-4 text-[#ff5757]"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 7 9 18l-5-5" />
                </svg>
              </span>
              <h2 className="text-lg font-medium tracking-tight text-[#f4f4f6]">What you get</h2>
            </div>
            <ul className="list-disc space-y-2.5 pl-5 leading-7 text-[#cdcdcd] marker:text-[#6a6b6c]">
              <li>Five-question intake (2-3 minutes).</li>
              <li>A clear verdict.</li>
              <li>Reasoning specific to what you described.</li>
              <li>A concrete next step.</li>
              <li>Works with any design system.</li>
            </ul>
          </article>
        </div>

      </section>

      <section
        id="try-it"
        className="mt-16 w-full scroll-mt-8 border-t border-[#242728] pt-12"
      >
        <div className="flex items-center gap-3">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#242728] bg-[#121212]">
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="h-4 w-4 text-[#ff5757]"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          </span>
          <h2 className="text-2xl font-medium tracking-tight text-[#f4f4f6]">Try it</h2>
        </div>

        {!result ? (
          <form className="mt-8 space-y-7 rounded-xl border border-[#242728] bg-[#0d0d0d] p-5 sm:p-6" onSubmit={handleSubmit}>
            {error ? (
              <p className="rounded-md border border-[#ff6161]/40 bg-[#ff6161]/15 px-4 py-3 text-sm font-medium text-[#ff6161]">
                {error}
              </p>
            ) : null}

            {needsUserApiKey ? (
              <label className="block space-y-2">
                <span className="text-sm font-medium text-[#f4f4f6]">
                  Claude API key
                </span>
                <input
                  type="password"
                  value={form.userApiKey}
                  disabled={isLoading}
                  autoComplete="off"
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, userApiKey: event.target.value }))
                  }
                  placeholder="sk-ant-..."
                  className="h-11 w-full rounded-md border border-[#242728] bg-[#101111] px-3 text-[#f4f4f6] placeholder:text-[#6a6b6c] transition focus:border-[rgba(255,255,255,0.16)] focus:outline-none focus:ring-2 focus:ring-[#ffffff]/20 disabled:cursor-not-allowed disabled:opacity-70"
                />
                <span className="block text-xs leading-5 text-[#9c9c9d]">
                  The server key isn&apos;t available or was rejected. Paste your key from
                  console.anthropic.com — it is only sent to this app&apos;s API route, not
                  stored.
                </span>
              </label>
            ) : null}

            <label className="block space-y-2">
              <span className="text-sm font-medium text-[#f4f4f6]">
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
                className="h-11 w-full rounded-md border border-[#242728] bg-[#101111] px-3 text-[#f4f4f6] placeholder:text-[#6a6b6c] transition focus:border-[rgba(255,255,255,0.16)] focus:outline-none focus:ring-2 focus:ring-[#ffffff]/20 disabled:cursor-not-allowed disabled:opacity-70"
              />
            </label>

            <div ref={closestDropdownRef} className="relative space-y-2">
              <span className="block text-sm font-medium text-[#f4f4f6]">
                Which existing components is this request most like?
              </span>
              <p className="text-xs leading-5 text-[#9c9c9d]">
                Pick up to {MAX_CLOSEST_SELECTIONS} from common design system patterns. Add
                detail if you choose Other.
              </p>

              {form.closestSelections.length > 0 ? (
                <ul className="flex flex-wrap gap-2" aria-label="Selected components">
                  {form.closestSelections.map((id) => {
                    const label = closestChipLabel(id, form.closestOtherText);
                    return (
                      <li key={id}>
                        <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-[#2e3031] bg-[#161717] py-1 pl-2.5 pr-1 text-xs text-[#e8e8e8] sm:text-sm">
                          <span className="min-w-0 truncate" title={label}>
                            {label}
                          </span>
                          <button
                            type="button"
                            disabled={isLoading}
                            onClick={() => toggleClosestSelection(id)}
                            aria-label={`Remove ${CLOSEST_LABEL_BY_ID[id]}`}
                            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[#9c9c9d] transition hover:bg-[#242728] hover:text-[#f4f4f6] focus:outline-none focus:ring-2 focus:ring-[#ffffff]/25 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <svg
                              viewBox="0 0 24 24"
                              aria-hidden="true"
                              className="h-3.5 w-3.5"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                            >
                              <path d="M18 6 6 18M6 6l12 12" />
                            </svg>
                          </button>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : null}

              <button
                type="button"
                disabled={isLoading}
                id="closest-components-trigger"
                aria-haspopup="listbox"
                aria-expanded={closestOpen}
                aria-controls="closest-components-listbox"
                onClick={() => setClosestOpen((o) => !o)}
                className="flex h-11 w-full items-center justify-between gap-2 rounded-md border border-[#242728] bg-[#101111] px-3 text-left text-[#f4f4f6] transition focus:border-[rgba(255,255,255,0.16)] focus:outline-none focus:ring-2 focus:ring-[#ffffff]/20 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <span
                  className={
                    form.closestSelections.length === 0 ? "text-[#6a6b6c]" : "text-[#cdcdcd]"
                  }
                >
                  {form.closestSelections.length === 0
                    ? "Choose components…"
                    : "Add or change…"}
                </span>
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className={`h-4 w-4 shrink-0 text-[#9c9c9d] transition ${closestOpen ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>

              {closestOpen ? (
                <ul
                  id="closest-components-listbox"
                  role="listbox"
                  aria-multiselectable="true"
                  aria-labelledby="closest-components-trigger"
                  className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-[#242728] bg-[#101111] py-2 shadow-lg"
                >
                  {CLOSEST_COMPONENT_OPTIONS.map((opt) => {
                    const checked = form.closestSelections.includes(opt.id);
                    const atCap =
                      form.closestSelections.length >= MAX_CLOSEST_SELECTIONS && !checked;
                    return (
                      <li key={opt.id} role="option" aria-selected={checked}>
                        <label
                          className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-[#cdcdcd] hover:bg-[#1a1a1a] ${
                            atCap ? "cursor-not-allowed opacity-50 hover:bg-transparent" : ""
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={isLoading || atCap}
                            onChange={() => toggleClosestSelection(opt.id)}
                            className="h-4 w-4 shrink-0 rounded border-[#242728] bg-[#101111] text-[#ffffff] focus:ring-[#ffffff]/30"
                          />
                          <span>{opt.label}</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              ) : null}

              {form.closestSelections.includes(CLOSEST_OTHER_ID) ? (
                <label className="block space-y-2 pt-1">
                  <span className="text-sm font-medium text-[#f4f4f6]">
                    Describe &quot;Other&quot;
                  </span>
                  <input
                    type="text"
                    value={form.closestOtherText}
                    disabled={isLoading}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, closestOtherText: event.target.value }))
                    }
                    placeholder="e.g. File upload dropzone, rich text toolbar…"
                    className="h-11 w-full rounded-md border border-[#242728] bg-[#101111] px-3 text-[#f4f4f6] placeholder:text-[#6a6b6c] transition focus:border-[rgba(255,255,255,0.16)] focus:outline-none focus:ring-2 focus:ring-[#ffffff]/20 disabled:cursor-not-allowed disabled:opacity-70"
                  />
                </label>
              ) : null}

              {form.closestSelections.length >= MAX_CLOSEST_SELECTIONS ? (
                <p className="text-xs text-[#9c9c9d]">Maximum {MAX_CLOSEST_SELECTIONS} selections.</p>
              ) : null}
            </div>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-[#f4f4f6]">
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
                className="w-full resize-y rounded-md border border-[#242728] bg-[#101111] px-3 py-2 text-[#f4f4f6] placeholder:text-[#6a6b6c] transition focus:border-[rgba(255,255,255,0.16)] focus:outline-none focus:ring-2 focus:ring-[#ffffff]/20 disabled:cursor-not-allowed disabled:opacity-70"
              />
            </label>

            <fieldset className="space-y-3" disabled={isLoading}>
              <legend className="text-sm font-medium text-[#f4f4f6]">
                How often will this pattern appear?
              </legend>
              {(["One place", "A few places", "Everywhere"] as const).map(
                (option) => (
                  <label
                    key={option}
                    className="flex min-h-11 items-center gap-2 rounded-md border border-transparent px-2 text-[#cdcdcd] hover:border-[#242728]"
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
                      className="h-4 w-4 border-[#242728] bg-[#101111] text-[#ffffff] focus:ring-[#ffffff]/30"
                    />
                    <span>{option}</span>
                  </label>
                )
              )}
            </fieldset>

            <fieldset className="space-y-3" disabled={isLoading}>
              <legend className="text-sm font-medium text-[#f4f4f6]">
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
                  className="flex min-h-11 items-center gap-2 rounded-md border border-transparent px-2 text-[#cdcdcd] hover:border-[#242728]"
                >
                  <input
                    required
                    type="radio"
                    name="driver"
                    value={option}
                    checked={form.driver === option}
                    onChange={() => setForm((prev) => ({ ...prev, driver: option }))}
                    className="h-4 w-4 border-[#242728] bg-[#101111] text-[#ffffff] focus:ring-[#ffffff]/30"
                  />
                  <span>{option}</span>
                </label>
              ))}
            </fieldset>

            <div className="space-y-3 rounded-lg border border-[#242728] bg-[#101111] p-4">
              <p className="text-sm font-medium text-[#f4f4f6]">Before you run it:</p>

              {tipChoice === null ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => handleTipChoice("tipped")}
                    className="rounded-md border border-[#242728] bg-[#121212] px-3 py-3 text-left transition hover:bg-[#101111] focus:outline-none focus:ring-2 focus:ring-[#ffffff]/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span className="flex items-center gap-2 text-sm font-medium text-[#f4f4f6]">
                      <svg
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                        className="h-4 w-4 text-[#f4f4f6]"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M12 3v18" />
                        <path d="M16 7.5a3.5 3.5 0 0 0-3.5-2h-1A3.5 3.5 0 0 0 8 9c0 1.9 1.5 3 3.5 3h1A3.5 3.5 0 0 1 16 15.5 3.5 3.5 0 0 1 12.5 19h-1A3.5 3.5 0 0 1 8 15.5" />
                      </svg>
                      Leave a $1 tip
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-[#9c9c9d]">
                      Opens in a new tab. Your answers will be saved.
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => handleTipChoice("skipped")}
                    className="rounded-md border border-[#242728] bg-transparent px-3 py-3 text-left transition hover:bg-[#101111] focus:outline-none focus:ring-2 focus:ring-[#ffffff]/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span className="flex items-center gap-2 text-sm font-medium text-[#f4f4f6]">
                      <svg
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                        className="h-4 w-4 text-[#f4f4f6]"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M5 12h14" />
                        <path d="m14 7 5 5-5 5" />
                      </svg>
                      Skip — just run it
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-[#9c9c9d]">
                      No tip, no problem.
                    </span>
                  </button>
                </div>
              ) : (
                <p className="text-sm leading-6 text-[#cdcdcd]">
                  {tipChoice === "tipped"
                    ? "Thanks. Run it whenever you're ready."
                    : "All set. Run it whenever you're ready."}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading || !isFormValid || tipChoice === null}
              className="inline-flex h-11 items-center justify-center rounded-md bg-[#ffffff] px-5 text-sm font-medium text-[#000000] transition hover:bg-[#e8e8e8] focus:outline-none focus:ring-2 focus:ring-[#ffffff]/30 disabled:cursor-not-allowed disabled:bg-[#434345] disabled:text-[#9c9c9d]"
            >
              {isLoading ? "Thinking..." : "Get verdict"}
            </button>
          </form>
        ) : (
          <div className="mt-8 rounded-xl border border-[#242728] bg-[#0d0d0d] p-6 sm:p-7">
            <span
              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold tracking-wide ${
                result.verdict === "VARIANT"
                  ? "bg-[#57c1ff]/15 text-[#57c1ff]"
                  : "bg-[#ffc533]/15 text-[#ffc533]"
              }`}
            >
              {result.verdict === "VARIANT" ? "VARIANT" : "NEW COMPONENT"}
            </span>

            <p className="mt-4 leading-7 text-[#cdcdcd]">{result.reasoning}</p>
            <p className="mt-3 leading-7 text-[#cdcdcd]">
              <span className="font-semibold text-[#f4f4f6]">Next step:</span>{" "}
              {result.next_step}
            </p>

            <button
              type="button"
              onClick={resetTool}
              className="mt-6 inline-flex h-10 items-center justify-center rounded-md border border-[#242728] px-4 text-sm font-medium text-[#f4f4f6] transition hover:bg-[#101111] focus:outline-none focus:ring-2 focus:ring-[#ffffff]/20"
            >
              Start over
            </button>
          </div>
        )}
      </section>

      <section className="mt-16 space-y-8 px-5 sm:px-8 lg:px-10">
        <article className="space-y-3">
          <h2 className="text-lg font-medium tracking-tight text-[#f4f4f6]">Who built it</h2>
          <ul className="list-disc space-y-2.5 pl-5 leading-7 text-[#cdcdcd] marker:text-[#6a6b6c]">
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

        <aside className="space-y-1 text-left text-sm leading-6 text-[#9c9c9d]">
          <p>This is a weekend experiment.</p>
          <p>If the problem resonates, a fuller version is coming.</p>
          <p>
            Buying now tells me this is worth investing in further.
          </p>
        </aside>
      </section>
    </main>
  );
}
