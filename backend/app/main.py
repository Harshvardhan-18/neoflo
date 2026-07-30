from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.middleware.rate_limit import RateLimitMiddleware
from app.routers import events, screenshots, activity, privacy, data_rights

app = FastAPI(
    title="Visual AI Agent Backend API",
    description="Backend service for Chrome extension visual activity logging, Gemini 2.5 Flash vision analysis, timeline queries, privacy governance, and user data rights.",
    version="1.0.0"
)

# CORS middleware supporting extension origins (chrome-extension://*) and local dev frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=r"chrome-extension://[a-z0-9]+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ingestion rate limiting middleware
app.add_middleware(RateLimitMiddleware, max_requests=120, window_seconds=60)

# Register routers
app.include_router(events.router)
app.include_router(screenshots.router)
app.include_router(activity.router)
app.include_router(privacy.router)
app.include_router(data_rights.router)

@app.get("/api/v1/health", tags=["Health Check"])
async def health_check():
    return {
        "status": "ok",
        "service": "visual-ai-agent-backend",
        "environment": settings.ENVIRONMENT
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
