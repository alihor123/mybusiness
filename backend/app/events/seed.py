"""Idempotent loader for demo Leader-ID event cards."""

import json
from datetime import datetime
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5

from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.events.models import Event

SEED_FILE = Path(__file__).resolve().parents[2] / "seed_data" / "demo" / "events.json"


async def import_demo_events(db: AsyncSession) -> int:
    """Upsert event cards; the caller controls the transaction and commit."""
    events = json.loads(SEED_FILE.read_text(encoding="utf-8"))["events"]
    rows = [
        {
            "id": uuid5(NAMESPACE_URL, f"mybusines:event:{item['slug']}"),
            "stable_key": item["slug"],
            "title": item["title"],
            "description": item["description"],
            "starts_at": datetime.fromisoformat(item["starts_at"]),
            "url": item["url"],
            "location": item["location"],
            "active": True,
        }
        for item in events
    ]
    statement = insert(Event)
    await db.execute(
        statement.values(rows).on_conflict_do_update(
            index_elements=[Event.stable_key],
            set_={key: getattr(statement.excluded, key) for key in rows[0] if key != "id"},
        )
    )
    return len(rows)
