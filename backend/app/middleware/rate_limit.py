import time
from collections import defaultdict
from fastapi import Request, Response, status
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import JSONResponse

class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, max_requests: int = 120, window_seconds: int = 60):
        super().__init__(app)
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        # Stores timestamp lists per client key
        self.requests_log = defaultdict(list)

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        # Apply rate limiting specifically to ingestion endpoints
        path = request.url.path
        if path.startswith("/api/v1/events/batch") or path.startswith("/api/v1/screenshots"):
            client_key = request.headers.get("X-Install-Key") or request.client.host if request.client else "unknown"
            now = time.time()

            # Filter out timestamps older than window_seconds
            timestamps = [t for t in self.requests_log[client_key] if now - t < self.window_seconds]
            self.requests_log[client_key] = timestamps

            if len(timestamps) >= self.max_requests:
                return JSONResponse(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    content={"detail": "Rate limit exceeded. Please try again later."}
                )

            self.requests_log[client_key].append(now)

        return await call_next(request)
