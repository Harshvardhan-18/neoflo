import asyncio
import base64
import json
import logging
from typing import Dict, Any
from openai import AsyncOpenAI
from app.config import settings

logger = logging.getLogger("visual_ai_agent.vision")

PROMPT_TEMPLATE = """\
You are a visual browsing activity analyzer. Analyze the provided screenshot of a user's web browsing session.
Domain: {domain}
URL: {url}

Provide a structured JSON response with the following exact keys:
{{
  "activity_type": "short category e.g. coding, shopping, reading, form_submission, searching, social_media, documentation",
  "summary": "1-2 sentence clear summary of what the user is doing on this page",
  "detected_ui_elements": ["array of main visible UI components"],
  "tags": ["array of 3-5 relevant keyword tags"],
  "confidence": 0.95
}}

Return ONLY valid JSON without markdown wrapping.
"""

def extract_base64_data_url(data_url: str) -> str:
    """
    Ensures the value is a proper base64 data URL for the OpenAI vision API.
    Accepts either a full data URL (data:image/jpeg;base64,...) or a raw base64 string.
    """
    if data_url.startswith("data:"):
        return data_url
    return f"data:image/jpeg;base64,{data_url}"


def _make_client() -> AsyncOpenAI:
    """
    Returns an AsyncOpenAI client pointed at GitHub Models inference endpoint.
    GitHub Models reuses the OpenAI API contract with a GitHub PAT as the API key.
    """
    return AsyncOpenAI(
        base_url=settings.GITHUB_MODELS_BASE_URL,
        api_key=settings.GITHUB_TOKEN,
    )


async def analyze_screenshot_with_gemini(
    data_url: str,
    domain: str = "",
    url: str = "",
    max_retries: int = 3,
) -> Dict[str, Any]:
    """
    Sends a screenshot to GPT-4o mini via GitHub Models and returns structured JSON analysis.
    The function name retains `gemini` in the signature for call-site compatibility.
    Includes exponential backoff retry handling for transient API errors.
    """
    if not settings.GITHUB_TOKEN or settings.GITHUB_TOKEN.startswith("your-"):
        logger.warning("GITHUB_TOKEN not configured. Returning fallback summary.")
        return {
            "activity_type": "browsing",
            "summary": f"User is viewing {domain or 'web page'}.",
            "detected_ui_elements": ["web_page"],
            "tags": ["web", domain] if domain else ["web"],
            "confidence": 0.50,
        }

    image_data_url = extract_base64_data_url(data_url)
    prompt_text = PROMPT_TEMPLATE.format(domain=domain or "unknown", url=url or "unknown")
    client = _make_client()

    for attempt in range(1, max_retries + 1):
        try:
            response = await client.chat.completions.create(
                model=settings.VISION_MODEL,  # "gpt-4o-mini"
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image_url",
                                "image_url": {"url": image_data_url, "detail": "low"},
                            },
                            {"type": "text", "text": prompt_text},
                        ],
                    }
                ],
                temperature=0.2,
                max_tokens=512,
            )

            response_text = (response.choices[0].message.content or "").strip()

            # Strip potential markdown code fence if present
            if response_text.startswith("```"):
                lines = response_text.splitlines()
                if lines[0].startswith("```"):
                    lines = lines[1:]
                if lines and lines[-1].startswith("```"):
                    lines = lines[:-1]
                response_text = "\n".join(lines).strip()

            parsed_json = json.loads(response_text)
            return {
                "activity_type": parsed_json.get("activity_type", "browsing"),
                "summary": parsed_json.get("summary", "Page viewed."),
                "detected_ui_elements": parsed_json.get("detected_ui_elements", []),
                "tags": parsed_json.get("tags", []),
                "confidence": float(parsed_json.get("confidence", 0.90)),
            }

        except Exception as err:
            logger.warning(f"GPT-4o mini (GitHub Models) attempt {attempt}/{max_retries} failed: {err}")
            if attempt == max_retries:
                logger.error("Max retries reached for GPT-4o mini vision analysis.")
                raise err
            await asyncio.sleep(2 ** attempt)

    return {
        "activity_type": "browsing",
        "summary": f"User is viewing {domain or 'web page'}.",
        "detected_ui_elements": [],
        "tags": [],
        "confidence": 0.50,
    }
