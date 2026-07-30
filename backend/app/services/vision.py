import asyncio
import base64
import json
import logging
from typing import Dict, Any, Optional
from google import genai
from google.genai import types
from app.config import settings

logger = logging.getLogger("visual_ai_agent.vision")

PROMPT_TEMPLATE = """
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

def extract_base64_bytes(data_url: str) -> bytes:
  """
  Extracts raw bytes from base64 data URL string or raw base64 string.
  """
  if "," in data_url:
    _, base64_str = data_url.split(",", 1)
  else:
    base64_str = data_url
  return base64.b64decode(base64_str)


async def analyze_screenshot_with_gemini(
    data_url: str,
    domain: str = "",
    url: str = "",
    max_retries: int = 3
) -> Dict[str, Any]:
  """
  Sends a screenshot to Gemini 2.5 Flash Vision API and returns structured JSON analysis.
  Includes exponential backoff retry handling for transient API errors.
  """
  if not settings.GEMINI_API_KEY or settings.GEMINI_API_KEY.startswith("your-"):
    logger.warning("GEMINI_API_KEY not configured. Returning fallback summary.")
    return {
        "activity_type": "browsing",
        "summary": f"User is viewing {domain or 'web page'}.",
        "detected_ui_elements": ["web_page"],
        "tags": ["web", domain] if domain else ["web"],
        "confidence": 0.50
    }

  image_bytes = extract_base64_bytes(data_url)
  prompt_text = PROMPT_TEMPLATE.format(domain=domain or "unknown", url=url or "unknown")

  client = genai.Client(api_key=settings.GEMINI_API_KEY)

  # Create image Part for Gemini API
  image_part = types.Part.from_bytes(
      data=image_bytes,
      mime_type="image/jpeg"
  )

  for attempt in range(1, max_retries + 1):
    try:
      # Call Gemini 2.5 Flash model
      response = await asyncio.to_thread(
          client.models.generate_content,
          model="gemini-2.5-flash",
          contents=[image_part, prompt_text],
          config=types.GenerateContentConfig(
              temperature=0.2,
              response_mime_type="application/json"
          )
      )

      response_text = response.text.strip()
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
          "confidence": float(parsed_json.get("confidence", 0.90))
      }

    except Exception as err:
      logger.warning(f"Gemini 2.5 Flash API attempt {attempt}/{max_retries} failed: {err}")
      if attempt == max_retries:
        logger.error("Max retries reached for Gemini 2.5 Flash vision analysis.")
        raise err
      await asyncio.sleep(2 ** attempt)

  return {
      "activity_type": "browsing",
      "summary": f"User is viewing {domain or 'web page'}.",
      "detected_ui_elements": [],
      "tags": [],
      "confidence": 0.50
  }
