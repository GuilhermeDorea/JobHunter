"""Lever public postings API (official) of Brazilian tech companies."""

from datetime import datetime, timezone

from ..matching import detect_level, detect_state
from ..models import WorkModel
from . import get, html_to_text

BOARDS = {"neon": "Neon", "ciandt": "CI&T"}
_WORK = {"remote": WorkModel.REMOTE, "hybrid": WorkModel.HYBRID, "onsite": WorkModel.ON_SITE}


def to_item(slug, company, p):
    cats = p.get("categories") or {}
    location = cats.get("location") or ""
    sections = "\n\n".join(f"{s.get('text', '')}\n{html_to_text(s.get('content'))}" for s in p.get("lists") or [])
    return {
        "external_id": f"{slug}:{p['id']}",
        "url": p["hostedUrl"],
        "title": p["text"].strip(),
        "company": company,
        "description": "\n\n".join(filter(None, [p.get("descriptionPlain"), sections, p.get("additionalPlain")])),
        "level": detect_level(cats.get("commitment") or "") if cats.get("commitment") else None,
        "work_model": _WORK.get(p.get("workplaceType"), ""),
        "city": location.split(",")[0].strip(),
        "state": detect_state(location),
        "published_at": datetime.fromtimestamp(p["createdAt"] / 1000, tz=timezone.utc) if p.get("createdAt") else None,
    }


def fetch():
    items = []
    for slug, company in BOARDS.items():
        postings = get(f"https://api.lever.co/v0/postings/{slug}", robots=False, params={"mode": "json"}).json()
        items += [to_item(slug, company, p) for p in postings]
    return items
