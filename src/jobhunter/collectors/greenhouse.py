"""Greenhouse public job boards (official API) of Brazilian tech companies. Level/area come from the title."""

from datetime import datetime

from ..matching import _fold, detect_state
from ..models import WorkModel
from . import favicon, get, html_to_text

BOARDS = {
    "nubank": "Nubank",
    "quintoandar": "QuintoAndar",
    "wildlifestudios": "Wildlife Studios",
    "vtex": "VTEX",
    "stone": "Stone",
    "ebanx": "EBANX",
    "inter": "Inter",
    "c6bank": "C6 Bank",
}
DOMAINS = {
    "nubank": "nubank.com.br", "quintoandar": "quintoandar.com.br", "wildlifestudios": "wildlifestudios.com",
    "vtex": "vtex.com", "stone": "stone.com.br", "ebanx": "ebanx.com", "inter": "inter.co", "c6bank": "c6bank.com.br",
}


def to_item(slug, company, j):
    location = (j.get("location") or {}).get("name", "")
    loc = _fold(location)
    state = detect_state(location)
    remote = "remot" in loc
    if not (state or remote or "brasil" in loc or "brazil" in loc):
        return None  # job abroad
    published = j.get("first_published") or j.get("updated_at")
    return {
        "external_id": f"{slug}:{j['id']}",
        "url": j["absolute_url"],
        "title": j["title"].strip(),
        "company": company,
        "company_logo": favicon(DOMAINS[slug]),
        "description": html_to_text(j.get("content")),
        "work_model": WorkModel.REMOTE if remote else "",
        "city": location.split(",")[0].strip() if state else "",
        "state": state,
        "published_at": datetime.fromisoformat(published) if published else None,
    }


def fetch():
    items = []
    for slug, company in BOARDS.items():
        jobs = get(f"https://boards-api.greenhouse.io/v1/boards/{slug}/jobs", robots=False,
                   params={"content": "true"}).json()["jobs"]
        items += [item for j in jobs if (item := to_item(slug, company, j))]
    return items
