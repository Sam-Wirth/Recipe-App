# Recipe Box

A recipe web app powered by Claude. Snap a photo of your fridge or pantry and get a recipe built from what you have, or talk through a recipe out loud and get it back as clean ingredients and steps. Save the ones you like and cook them step by step in Cook Mode.

Built with Next.js 16 (App Router), TypeScript, Tailwind CSS and the Anthropic Claude API.

## Features

- **Pantry Scanner** — upload or take photos of your fridge and pantry. Claude lists the ingredients it sees; you edit the list, pick servings and any notes ("no oven", "vegetarian"), and generate a recipe. iPhone HEIC photos are converted in the browser.
- **Voice Recipe** — describe a recipe out loud. Uses the browser's speech-to-text, or records/uploads audio to an optional self-hosted Whisper server. Claude turns the transcript into a structured recipe that you can review and edit before saving.
- **My Recipes** — a gallery of everything you've saved, with editing and deleting.
- **Cook Mode** — a full-screen, one-step-at-a-time view with an ingredient checklist, big buttons and keyboard shortcuts (← → Space, Esc). Keeps the screen awake where the browser allows it.

## What you need

- [Node.js](https://nodejs.org) **20.9 or newer** (the LTS installer is fine). Check with `node --version`.
- An **Anthropic API key** from [console.anthropic.com](https://console.anthropic.com). API usage is pay-as-you-go and separate from a Claude.ai subscription — add a few dollars of credit under **Billing**. A scan or recipe typically costs around a cent or two.

## Setup

1. **Get the code** — clone the repo, or download it from GitHub (**Code → Download ZIP**) and unzip it.

2. **Install dependencies** — open a terminal in the project folder and run:

   ```bash
   npm install
   ```

3. **Add your API key** — copy `.env.example` to a new file named `.env.local`:

   ```bash
   # macOS / Linux
   cp .env.example .env.local
   # Windows (PowerShell)
   Copy-Item .env.example .env.local
   ```

   Open `.env.local` and replace `sk-ant-your-key-here` with your key. Never share or commit this file.

4. **Start the app:**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

Restart `npm run dev` whenever you change `.env.local` — it's only read at startup.

## Configuration

All settings live in `.env.local`. See `.env.example` for the full list.

| Variable | Required | What it does |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | Yes | Your Anthropic API key. |
| `AI_MODEL` | No | Claude model. Defaults to `claude-sonnet-5-5`; `claude-haiku-5-5` is cheaper. |
| `DEV_ORIGINS` | No | Your computer's LAN IP, to open the dev server from your phone. |
| `WHISPER_URL` | No | Base URL of an OpenAI-compatible Whisper server, e.g. `http://192.168.1.60:8000/v1`. |
| `WHISPER_MODEL` | No | Whisper model name. Defaults to `Systran/faster-whisper-small`. |
| `WHISPER_API_KEY` | No | Only if your Whisper server requires one. |
| `RECIPE_DATA_DIR` | No | Folder for saved recipes. Defaults to `./data`. |

## Using it on your phone

1. Make sure the phone is on the same Wi-Fi as the computer running the app.
2. Find the computer's local IP — `npm run dev` prints it as **Network: http://192.168.x.x:3000** (or run `ipconfig` on Windows / `ipconfig getifaddr en0` on macOS).
3. Add it to `.env.local` as `DEV_ORIGINS=192.168.x.x` and restart `npm run dev`.
4. Open `http://192.168.x.x:3000` on the phone. On Windows, allow Node.js through the firewall on **Private** networks when asked.

Photo upload works over plain HTTP. **Live voice recording on a phone needs HTTPS** — browsers only allow microphone access on secure pages (localhost is the exception). Typing or pasting a transcript, and uploading a voice memo (with Whisper set up), work without it. For HTTPS, use a private tunnel such as [Tailscale](https://tailscale.com) (`tailscale serve 3000`).

## Optional: Whisper for voice memos

The Voice Recipe page always offers the browser's own speech-to-text (Chrome, Edge and Safari; Chrome sends audio to Google to transcribe it). To also **record audio** in any browser or **upload existing voice memos**, run a Whisper server that speaks the OpenAI transcription API — for example [speaches](https://github.com/speaches-ai/speaches) in Docker — and set `WHISPER_URL` in `.env.local`. Audio is sent from the app's server to your Whisper server, so it can stay on your own network.

Home Assistant's Whisper add-on uses the Wyoming protocol, not this API, so it won't work here directly.

## Where recipes are stored

Saved recipes are written to `data/recipes.json` in the project folder. That folder is git-ignored so your recipes stay private. Back it up if you care about it. Each person running the app has their own separate recipe collection.

Storage goes through one interface in `lib/recipeStore.ts`, so it can be swapped for a database (Supabase is planned) without touching the pages.

## Project layout

```
app/
  page.tsx                 Home page
  scan/                    Pantry Scanner
  voice/                   Voice Recipe
  recipes/                 Gallery, recipe pages, edit pages
  api/
    scan-pantry/           Photo → ingredient list (Claude vision)
    generate-recipe/       Ingredients → recipe
    parse-recipe/          Voice transcript → recipe
    transcribe/            Audio → text via your Whisper server
    recipes/               Save / list / update / delete
components/                UI pieces (recipe card, editor, Cook Mode, voice capture…)
lib/
  ai.ts                    Claude client and model setting
  recipe.ts                Recipe type, Claude tool schema, validation
  recipeStore.ts           Saved-recipe storage (JSON file)
  prepareImage.ts          In-browser HEIC conversion and resizing
  site.ts                  Site name
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Production build |
| `npm start` | Run the production build |
| `npm run lint` | Lint the code |

## A note on hosting it publicly

The app has **no login**. Anyone who can open it can use your Anthropic API key (and run up your bill) and see, edit or delete the saved recipes. It's meant for running on your own computer or home network. Don't put it on the public internet without adding authentication and usage limits first.
