"""Gupy public job search (portal.gupy.io). The search page embeds results as Next.js JSON; robots.txt allows all.

Each term returns at most 100 jobs (12 per page), newest first, so older jobs fall out of the window
while still open: they are only closed after a grace period or when their deadline passes.
"""

import json
import re
from datetime import datetime
from urllib.parse import quote

from ..matching import detect_state
from ..models import Contract, Level, WorkModel
from . import get, html_to_text

CLOSE_AFTER_DAYS = 14
MAX_PAGES = 9

TERMS = [
    "estágio desenvolvimento", "estágio ti", "estágio tecnologia da informação", "estágio dados",
    "estágio sistemas", "estágio infraestrutura", "estágio suporte", "estágio engenharia",
    "estágio programação", "desenvolvedor júnior", "analista de dados júnior", "analista de sistemas júnior",
    "suporte técnico júnior", "engenheiro júnior", "trainee tecnologia", "trainee engenharia",
]

_LEVEL = {"vacancy_type_internship": Level.INTERNSHIP, "vacancy_type_trainee": Level.TRAINEE}
_WORK = {"on-site": WorkModel.ON_SITE, "hybrid": WorkModel.HYBRID, "remote": WorkModel.REMOTE}
_NEXT_DATA = re.compile(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', re.S)


def _date(value):
    return datetime.fromisoformat(value.replace("Z", "+00:00")) if value else None


def _page(term, page):
    r = get(f"https://portal.gupy.io/job-search/term={quote(term)}&page={page}")
    data = json.loads(_NEXT_DATA.search(r.text).group(1))["props"]["pageProps"]["initialJobList"]
    return data["data"], data["pagination"]


def to_item(j):
    if j.get("type") == "vacancy_type_apprentice":
        return None
    return {
        "external_id": str(j["id"]),
        "url": j["jobUrl"],
        "title": j["name"].strip(),
        "company": j.get("careerPageName") or "Não informado",
        "description": html_to_text(j.get("description")),
        "level": _LEVEL.get(j.get("type")),
        "contract": Contract.INTERNSHIP if j.get("type") == "vacancy_type_internship" else "",
        "work_model": _WORK.get(j.get("workplaceType"), ""),
        "city": j.get("city") or "",
        "state": detect_state(j.get("state")),
        "published_at": _date(j.get("publishedDate")),
        "deadline": _date(j.get("applicationDeadline")),
    }


def fetch():
    items = {}
    for term in TERMS:
        for page in range(1, MAX_PAGES + 1):
            jobs, pag = _page(term, page)
            for j in jobs:
                if item := to_item(j):
                    items[item["external_id"]] = item
            if not jobs or pag["offset"] + pag["limit"] >= pag["total"]:
                break
    return list(items.values())
