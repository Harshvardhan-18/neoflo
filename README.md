# Visual AI Agent — Chrome Extension & Backend

A Chrome extension that observes a consenting user's own browsing activity (clicks, navigation, scroll, screenshots), runs captured screenshots through Claude's vision API (server-side) to generate structured activity summaries, and persists everything to a PostgreSQL database via a FastAPI backend.

---

## ☕ "Coffee" Theme & Privacy Guardrails

- **Explicit Opt-in**: Tracking is disabled by default until consent is explicitly granted.
- **Domain Blocklist**: Pre-seeded domain exclusions (banking, medical, government) enforce hard capture skips before events or screenshots enter local buffers.
- **No Credential Capture**: Form values and `input[type=password]` entries are never captured or logged.
- **One-Click Pause**: Quick status toggle in the extension popup.
- **Server-side Claude API**: Secrets (`ANTHROPIC_API_KEY`) strictly remain server-side in the backend service.

---

## 🏗 Repository Structure

```text
neoflo/
├── backend/            # FastAPI async application & database models
├── extension/          # MV3 Chrome Extension (Vite + TypeScript)
├── dashboard/          # Next.js dashboard (Phase 7)
├── docs/               # Architecture and API specs
├── docker-compose.yml  # Docker infrastructure (PostgreSQL 16)
└── README.md
```

---

## 🚀 Getting Started

### 1. Database Setup (Docker Compose)
Start the PostgreSQL container:
```bash
docker-compose up -d
```

### 2. Backend Setup
Navigate to `backend/`:
```bash
cd backend
python -m venv .venv
# On Windows PowerShell:
.venv\Scripts\Activate.ps1
# On Linux/macOS:
source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env

# Run database migrations
alembic upgrade head

# Start FastAPI server
uvicorn app.main:app --reload --port 8000
```
Verify the health endpoint at: `http://localhost:8000/api/v1/health`

### 3. Extension Setup
Navigate to `extension/`:
```bash
cd extension
npm install
npm run build
```
Load the unpacked extension:
1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** and select the `extension/dist` folder.
