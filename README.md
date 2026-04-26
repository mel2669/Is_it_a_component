# $1 Design System Triage Tool

Single-page Next.js app that helps design system teams decide if a request should be a variant or a new component.

## Stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS
- Anthropic API via server-side route at `/api/triage`
- Deployable on Vercel

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create a local env file:

```bash
cp .env.example .env.local
```

3. Add your key to `.env.local`:

```env
ANTHROPIC_API_KEY=your_real_key_here
```

4. Run locally:

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000).

## How It Works

- The page contains a landing section and the triage tool in one scrollable view.
- The form sends five required answers to `POST /api/triage`.
- The form supports an optional user-provided Claude API key; if provided, that request uses the user key.
- If no user key is provided, the API route uses `ANTHROPIC_API_KEY` with a daily server budget of 100 tokens.
- The API route sends answers to Anthropic (`claude-sonnet-4-5`) with a strict system prompt.
- The route parses the model output as JSON and validates its shape before returning to the client.
- If model output is malformed or the request fails, the client shows: `Something went wrong. Please try again.`

### Daily token budget details

- The 100-token server budget is tracked in memory and resets daily (UTC).
- This budget only applies to requests using the server API key.
- User-provided keys are not budget-limited by the app.

## Deploy to Vercel

1. Push this repo to GitHub.
2. Import the repo in [Vercel](https://vercel.com/new).
3. Set environment variable `ANTHROPIC_API_KEY` in the Vercel project settings.
4. Deploy.

No database, auth, or user accounts are required.
