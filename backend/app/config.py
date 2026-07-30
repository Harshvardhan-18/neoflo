from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgrespassword@localhost:5433/visual_ai_agent"
    SYNC_DATABASE_URL: str = "postgresql+psycopg2://postgres:postgrespassword@localhost:5433/visual_ai_agent"
    GITHUB_TOKEN: str = ""
    GITHUB_MODELS_BASE_URL: str = "https://models.inference.ai.azure.com"
    VISION_MODEL: str = "gpt-4o-mini"
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "INFO"
    ALLOWED_ORIGINS: str = "chrome-extension://*,http://localhost:5173,http://localhost:3000"

    @property
    def cors_origins(self) -> List[str]:
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
