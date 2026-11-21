"""Idempotent loader for the public demo mentor catalog."""

import json
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5

from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.mentors.models import Mentor

SEED_FILE = Path(__file__).resolve().parents[2] / "seed_data" / "demo" / "mentors.json"


async def import_demo_mentors(db: AsyncSession) -> int:
    """Upsert the 15 catalog profiles; transaction ownership stays with the caller."""
    payload = json.loads(SEED_FILE.read_text(encoding="utf-8"))
    mentors = payload["mentors"]
    rows = []
    for item in mentors:
        slug = item["slug"]
        showcase = item["showcase_login"]
        rows.append(
            {
                "id": uuid5(NAMESPACE_URL, f"mybusines:mentor:{slug}"),
                "user_id": None,
                "stable_key": item["teacher_seed_key"],
                "name": item["name"],
                "headline": item["headline"],
                "about": item["about"],
                "experience_label": item["experience_label"],
                "experience_anchor_year": item["experience_anchor_year"],
                "industry_codes": item["industry_codes"],
                "project_stage_codes": item["project_stage_codes"],
                "help_topics": item["help_topics"],
                "meeting_format": item["meeting_format"],
                "bio_sources": item["bio_sources"],
                "portrait_url": item["portrait"]["url"],
                "contacts": (
                    {
                        "email": f"{slug}@demo.example",
                        "max": f"@demo-{slug}",
                    }
                    if showcase
                    else {}
                ),
                "is_demo": item["is_demo"],
                "accepts_demo_applications": item["accepts_demo_applications"],
                "showcase_login": showcase,
                "active": True,
            }
        )

    update_fields = {
        key: getattr(insert(Mentor).excluded, key)
        for key in rows[0]
        if key not in {"id", "user_id"}
    }
    await db.execute(
        insert(Mentor)
        .values(rows)
        .on_conflict_do_update(index_elements=[Mentor.stable_key], set_=update_fields)
    )
    return len(rows)
