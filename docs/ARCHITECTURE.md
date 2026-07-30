# Visual AI Agent — System Architecture (Phase 1 Stub)

## System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                   Browser / Client Side                     │
│                                                             │
│  ┌────────────────────┐          ┌──────────────────────┐  │
│  │ Content Script     │ ──msg──> │ Background Worker    │  │
│  │ (DOM/Clicks/Events)│          │ (Buffering & Canvas) │  │
│  └────────────────────┘          └──────────┬───────────┘  │
│                                             │ (HTTPS API)  │
└─────────────────────────────────────────────┼──────────────┘
                                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend Server Side                      │
│                                                             │
│  ┌────────────────────┐          ┌──────────────────────┐  │
│  │ FastAPI App        │ ───────> │ PostgreSQL Database  │  │
│  │ (Ingestion/Auth)   │          │ (SQLAlchemy Async)   │  │
│  └─────────┬──────────┘          └──────────────────────┘  │
│            │                                                │
│            ▼                                                │
│  ┌────────────────────┐                                     │
│  │ Anthropic Vision   │ (Claude Messages API)               │
│  │ (Async Summaries)  │                                     │
│  └────────────────────┘                                     │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

1. **Chrome Extension (Vite + TypeScript MV3)**:
   - Captures DOM events (clicks, scrolls, navigation).
   - Enforces pre-capture domain blocklist.
   - Captures & compresses screenshots via offscreen canvas.
   - Buffers events locally in IndexedDB before batch flushing.

2. **FastAPI Backend (Python 3.11+)**:
   - Ingests event batches and screenshot uploads.
   - Validates requests via per-install API keys (`X-Install-Key`).
   - Serves activity timeline queries for the Next.js Dashboard.

3. **Data Layer (PostgreSQL 16)**:
   - Relational store managed via async SQLAlchemy + Alembic migrations.
   - Tables: `sessions`, `events`, `screenshots`, `ai_summaries`, `privacy_rules`.

4. **AI Vision Analysis**:
   - Server-side integration with Claude Messages API to generate structured JSON summaries of captured screenshots.
