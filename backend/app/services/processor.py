import logging
import uuid
from app.database import async_session_maker
from app.models import AISummary
from app.services.vision import analyze_screenshot_with_gemini

logger = logging.getLogger("visual_ai_agent.processor")

async def process_screenshot_summary_background(
    screenshot_id: uuid.UUID,
    data_url: str,
    domain: str,
    url: str
) -> None:
  """
  Asynchronous background task executing Gemini 2.5 Flash Vision analysis
  and persisting results into PostgreSQL ai_summaries table.
  """
  try:
    analysis = await analyze_screenshot_with_gemini(
        data_url=data_url,
        domain=domain,
        url=url
    )

    async with async_session_maker() as db:
      ai_summary = AISummary(
          id=uuid.uuid4(),
          screenshot_id=screenshot_id,
          model="gemini-2.5-flash",
          summary_text=analysis.get("summary", ""),
          tags={
              "activity_type": analysis.get("activity_type"),
              "detected_ui_elements": analysis.get("detected_ui_elements", []),
              "tags": analysis.get("tags", [])
          },
          confidence=analysis.get("confidence", 0.90)
      )

      db.add(ai_summary)
      await db.commit()
      logger.info(f"Persisted AI summary for screenshot {screenshot_id} (model: gemini-2.5-flash).")

  except Exception as err:
    logger.error(f"Error in background AI vision processing for screenshot {screenshot_id}: {err}", exc_info=True)
