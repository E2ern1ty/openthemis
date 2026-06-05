# Launch copy

Repo: https://github.com/E2ern1ty/openthemis

---

## Show HN (news.ycombinator.com/submit)

**Title** (pick one, ≤ 80 chars, no trailing period, no "Show HN:" hype):

```
Show HN: OpenThemis – open-source AI public-opinion analysis (Next.js + LLM)
```

Alternatives:
- `Show HN: OpenThemis – self-hostable AI sentiment/opinion analysis pipeline`
- `Show HN: AI opinion-analysis tool that reuses your browser login to collect data`

**URL field:** `https://github.com/E2ern1ty/openthemis`

**First comment** (post immediately after submitting):

```
Hi HN, I built OpenThemis, an open-source AI public-opinion (sentiment) analysis system for brand/PR/ops use.

It runs a "collect → sentiment → topics → risk" pipeline:
- Multi-channel collection (Weibo, Xiaohongshu, Douyin, X, Reddit) + Excel/CSV import. Collection goes through OpenCLI, which reuses your already-logged-in Chrome session, so there's no separate login or credential storage in the app.
- Sentiment: positive/neutral/negative per item, with an overall "opinion health" score.
- Topic clustering with per-topic sentiment.
- Risk alerting: mines negative signals, judges severity, and distills findings with suggested responses.
- A page-aware AI assistant that answers questions about whatever data is on screen.

Architecture is three decoupled layers, each independently deployable/replaceable:
- Analysis: Next.js 16 + a unified OpenAI-compatible LLM client (configure any endpoint/model in the UI, hot-reloads).
- Collector: a standalone Node process (OpenCLI gateway). It needs a host Chrome, so it can't run headless — servers without a desktop can deploy analysis-only and feed it imported data.
- Storage: SQLite (better-sqlite3, WAL), single file, zero-config.

Stack: Next.js 16 / React 19 / Tailwind 4 / Recharts / TypeScript. MIT licensed.

It started as a tool for myself; I'd love feedback on the architecture and the collector approach (reusing the browser session instead of scraping with stored credentials). Repo: https://github.com/E2ern1ty/openthemis
```

**Tips:**
- Submit Tue–Thu, ~8–10am US Eastern is generally a good window.
- Don't ask for upvotes anywhere. Reply to every comment quickly in the first 1–2 hours.
- Use the GitHub URL as the submission link (HN prefers the project over a blog post).

---

## Reddit

Good subreddits: r/opensource, r/SideProject, r/selfhosted, r/coolgithubprojects.
Read each sub's rules first; r/selfhosted wants self-hosting detail, r/SideProject is fine with a personal-story framing.

**Title:**

```
OpenThemis – an open-source AI public-opinion analysis system (Next.js + OpenAI-compatible LLM, MIT)
```

**Body (Markdown):**

```
I've been building **OpenThemis**, an open-source AI public-opinion / sentiment analysis system, and just made it public.

**What it does** — runs a collect → sentiment → topics → risk pipeline:

- **Multi-channel collection** from Weibo, Xiaohongshu, Douyin, X (Twitter) and Reddit, plus Excel/CSV import. Collection goes through OpenCLI, which **reuses your already-logged-in Chrome session** — the app never stores platform credentials.
- **Sentiment** classification (positive / neutral / negative) with an overall opinion-health score.
- **Topic clustering** with per-topic sentiment.
- **Risk alerting** — mines negative signals, judges severity, and suggests responses.
- A **page-aware AI assistant** that answers questions about the data currently on screen.

**Architecture** — three decoupled, independently deployable layers:

- **Analysis**: Next.js 16 + a unified OpenAI-compatible LLM client. Point it at any endpoint/model from the Settings UI; config hot-reloads.
- **Collector**: a standalone Node process (OpenCLI gateway). It needs a host Chrome, so headless servers can run analysis-only and feed it imported data.
- **Storage**: SQLite (better-sqlite3, WAL) — single file, zero-config.

**Stack:** Next.js 16 / React 19 / Tailwind 4 / Recharts / TypeScript. MIT licensed. UI is bilingual (EN/中).

Repo (screenshots in the README): https://github.com/E2ern1ty/openthemis

Feedback welcome — especially on the collector design (reusing the browser session vs. scraping with stored credentials) and the three-layer split.
```

**Tips:**
- Post to one subreddit at a time; don't blast all of them at once.
- Engage in comments. Reddit ranks by early engagement and downranks drive-by self-promo.
- If a sub requires flair (e.g. "Show & Tell" / "I made this"), add it.
```
