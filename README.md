# Cooper — fábrica y gestión de marcas

La aplicación actual vive en [`cooper/`](cooper/README.md) y la fábrica usa 32 flujos en `workflows/v2/`, con Data Tables de n8n, revisión humana y adaptadores de proveedores. El texto histórico de abajo describe la primera versión y sus cuatro borradores; no es la guía del VPS actual.

- [Estado vigente](docs/ESTADO.md) y [auditoría total](docs/informes/faltantes-total.md).
- [Especificación](docs/cooper-especificacion.md), [entrega](cooper/ENTREGA.md) y [contrato del cerebro](skill/FABRICA.md).
- [Operación, copias y recuperación](docs/cooper-operacion.md), [conciliación sin duplicados](docs/cooper-conciliacion.md).
- [Lote n8n y reversa](docs/cooper-cobertura-despliegue.md). Las activaciones reales requieren los controles y permisos indicados en el estado.

## Documentación histórica de la primera versión

### Claude + n8n + HeyGen YouTube Automation

Send a topic to Telegram, review the script, and hand it off to HeyGen. This checkout imports as four drafts. Claude calls and YouTube uploads come disabled. Follow the [n8n setup](docs/03-n8n-setup.md) to connect your accounts and verify each workflow.

This repo has the four n8n workflows, the Claude skill file, and the setup docs for the AI video automation system I built and run on my own channel.

**Stack:** Claude Code (routine) + n8n + HeyGen Video Agent + vidIQ + Telegram + Google Sheets + YouTube Data API

---

## Demo Video

[![Watch the demo](https://img.youtube.com/vi/puM_wcS3jxk/maxresdefault.jpg)](https://www.youtube.com/watch?v=puM_wcS3jxk)

▶️ **Watch on YouTube:** https://www.youtube.com/watch?v=puM_wcS3jxk

---

## What this actually does

You message a Telegram bot with a video topic. Claude picks it up, researches keywords with vidIQ, writes the script in your voice, and sends it to you for approval. You approve or ask for changes right from your phone. Once approved, Claude sends the script to HeyGen's Video Agent, which renders a full video with your avatar, captions, motion graphics and B-roll. n8n catches the finished video and uploads it to YouTube with the title and description already written.

Two ways to run it:

1. **Topic mode.** You send an idea. Claude researches and writes the script. You review it.
2. **Script mode.** You already have a script. You paste it. No review step. It goes straight to production.

---

## Architecture

```
                        ┌─────────────────────────┐
                        │   Claude Code Routine   │
                        │   (API trigger enabled) │
                        │                         │
                        │  reads: SKILL.md +      │
                        │  reference scripts      │
                        │  from THIS repo         │
                        └───────────┬─────────────┘
                                    │
              MCP connections: n8n · vidIQ · HeyGen
                                    │
   ┌────────────────────────────────┼────────────────────────────────┐
   │                                │                                │
   ▼                                ▼                                ▼
┌──────────────┐          ┌──────────────────┐            ┌──────────────────┐
│ WORKFLOW 1   │          │ WORKFLOW 2       │            │ WORKFLOW 3       │
│ Idea intake  │──────────│ Script review    │────────────│ Log to sheet     │
│ (Telegram)   │          │ (Telegram+form)  │            │ (Google Sheets)  │
└──────────────┘          └──────────────────┘            └──────────────────┘
                                    │                                │
                          approved ─┘                                │
                                    │                                │
                                    ▼                                │
                        ┌───────────────────────┐                    │
                        │ HeyGen Video Agent    │                    │
                        │ (Claude calls direct  │                    │
                        │  via MCP, no n8n hop) │                    │
                        └───────────┬───────────┘                    │
                                    │ video_id returned              │
                                    │                                │
                                    ▼                                ▼
                        ┌───────────────────────────────────────────────┐
                        │ WORKFLOW 4  (runs without Claude)             │
                        │ HeyGen webhook → match sheet row → download    │
                        │ → optional private YouTube upload → Telegram ping │
                        └───────────────────────────────────────────────┘
```

Workflows 1 and 2 call the Claude Code routine. The routine calls Workflows 2 and 3. Workflow 4 is fully independent. That matters, because HeyGen can take a long time to render and you do not want a Claude session sitting there waiting.

---

## Repo structure

```
.
├── README.md                        You are here
├── LICENSE
├── .gitignore
├── SANITIZE.md                      Read before you push anything
├── workflows/
│   ├── README.md                    What each workflow does, node by node
│   ├── 01-telegram-idea-intake.json
│   ├── 02-script-review-approval.json
│   ├── 03-log-to-spreadsheet.json
│   └── 04-heygen-webhook-youtube-upload.json
├── skill/
│   ├── SKILL.md                     The brain. Claude reads this.
│   └── reference/
│       ├── script-style.md          Script structure and voice rules
│       ├── example-scripts.md       Your scripts go here
│       ├── video-agent-prompt.md    The one-shot HeyGen prompt template
│       └── brand-kit.md             Colors, avatar ID, voice ID
├── docs/
│   ├── 01-requirements.md           Accounts, plans, costs
│   ├── 02-telegram-setup.md
│   ├── 03-n8n-setup.md
│   ├── 04-heygen-setup.md
│   ├── 05-vidiq-setup.md
│   ├── 06-youtube-google-setup.md
│   ├── 07-claude-routine-setup.md   The important one
│   ├── 08-customize-for-your-niche.md
│   └── 09-troubleshooting.md
└── templates/
    ├── tracking-sheet.md            Google Sheet column schema
    └── env.example
```

---

## Quick start

1. Read `docs/01-requirements.md` and get your accounts ready.
2. Fork this repo. You need your own copy, because Claude reads the skill file from your repo.
3. Edit `skill/reference/brand-kit.md` with your HeyGen avatar ID and voice ID.
4. Replace `skill/reference/example-scripts.md` with two or three of your own scripts.
5. Import the four JSON files into n8n. Reconnect every credential.
6. Set up the Claude Code routine following `docs/07-claude-routine-setup.md`.
7. Run the offline workflow tests, then verify connections with your test accounts.

Do not skip step 4. The example scripts are what make the output sound like you instead of sounding like a chatbot.

---

## How the Telegram intake works

The bot listens for two keywords.

**Send `topic` or `idea`:**
The bot replies asking for your topic. You send it back in this format:

```
How I automated my entire YouTube channel [angle: show the actual cost breakdown] [cta: link in description] (use vidiq)
```

Only the topic is required. Angle, CTA and the vidIQ flag are all optional.

**Send `script`:**
The bot asks for a ready-made script. Whatever you paste is treated as already approved. No review step. It goes straight to HeyGen.

### The vidIQ flag

Append one of these to your topic text:

| Flag | Effect |
|---|---|
| `(use vidiq)` | Requests keyword research. |
| `(no vidiq)` or `(skip vidiq)` | Skips keyword research. This is the default. |

Use `(no vidiq)` for personal stories, opinion videos and build logs. There is no keyword angle on those and vidIQ credits are not free.

---

## How the approval loop works

Telegram has a 4096 character limit per message. A full script blows past that. So the notification and the script are split.

Telegram gets a short message: topic, title, and a link.
The n8n form page shows the full script, the title, the description, and two buttons.

Approve, and it goes to production. Request changes, and your notes go back to Claude, Claude rewrites, and you get a fresh form. This loops until you approve.

---

## Why HeyGen Video Agent and not the plain avatar API

Plain talking-head renders look cheap. That was the honest problem with version one of this system. Video Agent generates captions, motion graphics and B-roll around the avatar, so the output actually looks like a video someone made on purpose.

It costs more credits. That trade is worth it.

Two things to know:

- The prompt is **one shot**. You send the full script and every visual instruction in a single prompt. Do not build a back-and-forth conversation with the agent. The prompt template is in `skill/reference/video-agent-prompt.md`.
- The Video Agent endpoint takes `prompt`, `avatarId`, `voiceId` and `files`. There is **no audio asset input**. You cannot feed it an external voiceover from ElevenLabs or Fish Audio. I tried. It does not exist. Use a HeyGen TTS voice passed as `voiceId`.

### The credit trap

If you are on a HeyGen web plan (Creator, Team), your plan credits and your API credits are two separate wallets. An API key bills the API wallet, which is empty unless you top it up, and web plans cannot buy one-time API packs.

Use the HeyGen MCP connector for generation against your web plan credits. n8n uses the HeyGen API for webhook registration and completion reads.

---

## Requirements at a glance

| Thing | Plan needed | Rough monthly cost |
|---|---|---|
| Claude | Pro or Max (Claude Code routines) | $20 to $100 |
| HeyGen | Creator or above | $29+ |
| n8n | Cloud starter, or self-hosted free | $0 to $24 |
| vidIQ | Optional MCP in all plans | See current plan |
| Telegram Bot API | Free | $0 |
| Google Sheets + YouTube Data API | Free | $0 |

Full breakdown in `docs/01-requirements.md`.

---

## Customizing this for your niche

The workflows stay the same. Two files change.

**`skill/SKILL.md`** — you can edit the script length targets, the research step, the approval rules and the video style rules. The overall structure should stay as is.

**`skill/reference/example-scripts.md`** — this one you must change. Drop in your own scripts. This is the single biggest lever on output quality. Claude matches what it sees here.

**`skill/reference/brand-kit.md`** — your avatar, your voice, your colors.

Full guidance in `docs/08-customize-for-your-niche.md`.

---

## Before you publish your own fork

The n8n JSON exports in this repo have been sanitized. Yours will not be, unless you sanitize them. Bot tokens, chat IDs, spreadsheet IDs, webhook URLs and credential references all end up in an export.

Read `SANITIZE.md` before your first push. There is a checklist and a prompt you can paste into Claude to scan the files for you.

---

## FAQ

**Do I need to code?**
No. You import JSON, click through credential screens, and edit markdown files.

**Can I use a different avatar tool?**
The renderer integrates with the Claude routine and Workflow 4. Adapt the callback authentication, event normalization, and file retrieval. Preserve video_id as the tracking key.

**Does it upload publicly?**
Uploads are disabled by default. When enabled, Workflow 4 uploads as **private**, with subscriber notifications disabled.

**How long does one video take?**
About 3 to 6 minutes of your attention. Send topic, read script, approve. The rendering happens without you.

**Does this work with a self-hosted n8n?**
Yes. That is what I recommend for a team setup.

---

## Credits and contact

Built and documented by [Indish Marketer](https://indishmarketer.com).

If you build something with this, I would like to see it.

## License

MIT. Do what you want with it.
