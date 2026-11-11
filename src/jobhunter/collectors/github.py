"""Job boards kept as GitHub issues (frontendbr/vagas, backend-br/vagas). Official REST API; labels carry level/place."""

import os
from datetime import datetime

from ..matching import detect_state
from ..models import Area, Contract, Level, WorkModel
from . import get

REPOS = {
    "frontendbr/vagas": {"Estágio": Level.INTERNSHIP, "Júnior": Level.JUNIOR},
    "backend-br/vagas": {"Estagiário": Level.INTERNSHIP, "Júnior": Level.JUNIOR},
}
_WORK = {"Remoto": WorkModel.REMOTE, "Híbrido": WorkModel.HYBRID, "Presencial": WorkModel.ON_SITE}
_CONTRACT = {"CLT": Contract.CLT, "PJ": Contract.PJ}
MAX_PAGES = 3


def to_item(repo, issue, level):
    labels = [lb["name"] for lb in issue["labels"]]
    title = issue["title"].strip()
    # Titles usually look like "[Remoto] Dev Júnior - Empresa".
    company = title.rsplit(" - ", 1)[1].strip() if " - " in title else "Não informado"
    return {
        "external_id": f"{repo}#{issue['number']}",
        "url": issue["html_url"],
        "title": title,
        "company": company,
        "description": issue.get("body") or "",
        "level": level,
        "area": Area.SOFTWARE,
        "contract": next((_CONTRACT[lb] for lb in labels if lb in _CONTRACT), ""),
        "work_model": next((_WORK[lb] for lb in labels if lb in _WORK), ""),
        "state": next((uf for lb in labels if (uf := detect_state(lb))), ""),
        "published_at": datetime.fromisoformat(issue["created_at"].replace("Z", "+00:00")),
    }


def fetch():
    headers = {"Accept": "application/vnd.github+json"}
    if token := os.environ.get("GITHUB_TOKEN"):
        headers["Authorization"] = f"Bearer {token}"
    items = {}
    for repo, labels in REPOS.items():
        for label, level in labels.items():
            for page in range(1, MAX_PAGES + 1):
                issues = get(
                    f"https://api.github.com/repos/{repo}/issues",
                    robots=False,
                    headers=headers,
                    params={"state": "open", "labels": label, "per_page": 100, "page": page},
                ).json()
                for issue in issues:
                    if "pull_request" not in issue:
                        item = to_item(repo, issue, level)
                        items[item["external_id"]] = item
                if len(issues) < 100:
                    break
    return list(items.values())
