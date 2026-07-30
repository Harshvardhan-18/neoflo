# Visual AI Agent

A privacy-first, Chrome MV3 extension + FastAPI backend system that observes browsing activity, captures compressed screenshots, and uses **Gemini 2.5 Flash Vision** to generate AI-powered page summaries. Includes a full-featured Coffee Theme dashboard for reviewing sessions, screenshots, and AI insights.

---

## Architecture

```
Chrome Extension (MV3, TypeScript + Vite)
  │
  ├── Content Script (DOM events: clicks, scroll depth, focus)
  ├── Background Service Worker
  │     ├── session.ts  (session lifecycle, install_id)
  │     ├── capture.ts  (screenshot queue, 1.5s rate limit)
  │     └── flush.ts    (IndexedDB → FastAPI upload)
  ├── Popup UI         (status badge, quick block, AI feed)
  ├── Options Page     (blocklist manager, data rights)
  └── Consent Screen   (first-install explicit opt-in)
        │
        │  HTTP (host_permissions: localhost:8000)
        ▼
FastAPI Backend (Python, asyncpg + asyncio)
  │
  ├── POST /api/v1/events/batch        (event ingestion)
  ├── POST /api/v1/screenshots         (screenshot upload → Gemini)
  ├── GET  /api/v1/activity/timeline   (timeline + filters)
  ├── GET/POST/DELETE /api/v1/privacy/rules
  ├── POST /api/v1/data/export         (GDPR-style export)
  ├── POST /api/v1/data/delete         (permanent purge)
  └── POST /api/v1/admin/retention/purge
        │
        ├── PostgreSQL 16 (via Docker, port 5433)
        └── Google Gemini 2.5 Flash Vision (google-genai SDK)

Dashboard (React + Vite, Coffee Theme)
  └── Activity Timeline, Screenshot Gallery, Session Replay Scrubber
```

---

## Tech Stack

| Layer | Stack |
|---|---|
| Extension | Chrome MV3, TypeScript, Vite 5, `@crxjs/vite-plugin`, `idb` |
| Backend | Python 3.13, FastAPI, asyncpg, SQLAlchemy (async), Alembic, Pydantic |
| AI Vision | `google-genai` SDK, `gemini-2.5-flash` model |
| Database | PostgreSQL 16 (Docker) |
| Dashboard | React 18, Vite, TypeScript |

---

## Project Structure

```
neoflo/
├── backend/                 # FastAPI backend
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── models.py
│   │   ├── dependencies/
│   │   ├── middleware/
│   │   ├── routers/         # events, screenshots, activity, privacy, data_rights, admin
│   │   └── services/        # vision.py (Gemini), processor.py, retention.py
│   ├── alembic/
│   ├── tests/
│   └── requirements.txt
├── extension/               # Chrome MV3 extension
│   ├── src/
│   │   ├── background/      # index.ts, session.ts, capture.ts, flush.ts
│   │   ├── content/         # index.ts (DOM listeners)
│   │   ├── popup/           # index.html, main.ts
│   │   ├── consent/         # index.html, main.ts
│   │   ├── options/         # index.html, main.ts
│   │   ├── styles/          # theme.css (Coffee Design System)
│   │   └── utils/           # privacy.ts, db.ts, image.ts
│   ├── manifest.json
│   └── vite.config.ts
├── dashboard/               # React activity dashboard
│   ├── src/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   └── index.html
├── docs/
│   ├── ARCHITECTURE.md
│   └── API_CONTRACT.md
├── docker-compose.yml
└── README.md
```

---

## Setup & Running

### Prerequisites
- Docker Desktop (for PostgreSQL)
- Node.js 20+
- Python 3.13+
- A Google Gemini API key (`GEMINI_API_KEY`)

### 1. Start PostgreSQL

```bash
docker-compose up -d
```

PostgreSQL will be available at `localhost:5433`.

### 2. Backend Setup

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
source .venv/bin/activate       # macOS/Linux

pip install -r requirements.txt

# Copy and configure environment
cp .env.example .env
# Edit .env: set DATABASE_URL, GEMINI_API_KEY

# Run database migrations
alembic upgrade head

# Start backend server
uvicorn app.main:app --reload --port 8000
```

API docs: http://localhost:8000/docs

### 3. Extension Setup

```bash
cd extension
npm install
npm run build          # Build extension bundle → extension/dist/
npm run package        # Create distributable → extension/build/visual-ai-agent-v1.0.0.zip
```

**Load in Chrome:**
1. Navigate to `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select `extension/dist/`
4. The consent disclosure screen opens automatically on first install

### 4. Dashboard Setup

```bash
cd dashboard
npm install
npm run dev            # Development server → http://localhost:5173
npm run build          # Production build
```

Enter your extension's `install_id` (from `chrome.storage.local`) in the dashboard to connect.

---

## Privacy & Security

### Privacy-By-Design Principles

| Principle | Implementation |
|---|---|
| **Explicit Consent First** | Tracking is OFF until user accepts consent screen on first install |
| **Input Value Exclusion** | `input[type=password]` and all input `.value` fields are NEVER captured |
| **Blocklist-First Pipeline** | `isDomainBlocked()` is the absolute first check in all capture/event pipelines |
| **Seeded Privacy Domains** | Financial (Chase, PayPal), medical (Epic), and auth portals (Okta, login.gov) blocked by default |
| **Custom Domain Blocklist** | User can block additional domains from the Options page or popup |
| **One-Click Global Pause** | Pause toggle in popup immediately halts all capture and event recording |
| **Full Data Rights** | Export all data (JSON) or permanently purge all records via Options page or API |
| **Anonymous Install ID** | UUID-based install key; no account registration or PII required |

### Security

- `X-Install-Key` header authentication on all protected API routes
- Rate limiting middleware: 120 ingestion requests per 60-second window
- `host_permissions` restricted to `localhost:8000` only in extension manifest
- CORS configured to allow `chrome-extension://` origins and `localhost` only

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/events/batch` | Ingest batch browsing events |
| `POST` | `/api/v1/screenshots` | Upload screenshot for Gemini processing |
| `GET` | `/api/v1/activity/timeline` | Paginated activity timeline with filters |
| `GET` | `/api/v1/privacy/rules` | List privacy rules |
| `POST` | `/api/v1/privacy/rules` | Add domain block/allow rule |
| `DELETE` | `/api/v1/privacy/rules/{id}` | Remove a privacy rule |
| `POST` | `/api/v1/data/export` | Export all user data as JSON |
| `POST` | `/api/v1/data/delete` | Permanently delete all user data |
| `POST` | `/api/v1/admin/retention/purge` | Purge data older than N days |
| `GET` | `/api/v1/health` | Health check |

---

## Running Tests

```bash
cd backend
.venv\Scripts\activate
pytest tests/ -v
```

Expected: **12 tests passed**.

---

## Environment Variables

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | asyncpg PostgreSQL connection URL | `postgresql+asyncpg://user:pass@localhost:5433/neoflo` |
| `GEMINI_API_KEY` | Google Gemini API key for vision analysis | `AIzaSy...` |
| `ENVIRONMENT` | Runtime environment | `development` |
| `CORS_ORIGINS` | Allowed CORS origins (JSON list) | `["http://localhost:5173"]` |

---

## Release Notes — v1.0.0

- Phase 1: Project foundation & architecture (monorepo, Docker, FastAPI, Alembic, MV3 scaffold)
- Phase 2: Core activity tracking engine (privacy gate, IndexedDB buffer, session lifecycle)
- Phase 3: Visual capture pipeline (OffscreenCanvas downscaling, MutationObserver burst detection)
- Phase 4: Gemini 2.5 Flash Vision AI analysis layer (structured JSON output, exponential backoff)
- Phase 5: Backend API & data layer hardening (auth, rate limiting, timeline, privacy rules, data rights)
- Phase 6: Extension UI — Coffee Theme (consent screen, popup, options page)
- Phase 7: Dashboard, data retention, extension packaging, v1.0.0 release
