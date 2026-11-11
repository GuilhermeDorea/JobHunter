"""Job sources. Each module exposes `fetch() -> list[dict]` with normalized items:

external_id, url, title, company, description, and optionally company_logo, level/area (hints), contract,
work_model, city, state (UF), salary, published_at, deadline.
Optional module attribute CLOSE_AFTER_DAYS: how long a job may be missing before it's marked closed.
"""

import html
import re
import time
from urllib.parse import urlsplit
from urllib.robotparser import RobotFileParser

import httpx

USER_AGENT = "JobHunter/0.1 (+https://jobhunter.guilhermedorea.com)"
DELAY_SECONDS = 2.0

_client = httpx.Client(headers={"User-Agent": USER_AGENT}, timeout=30, follow_redirects=True)
_last_hit = {}
_robots = {}


class Blocked(Exception):
    """robots.txt disallows this URL."""


def _allowed(url):
    parts = urlsplit(url)
    base = f"{parts.scheme}://{parts.netloc}"
    if base not in _robots:
        rp = RobotFileParser()
        r = _client.get(base + "/robots.txt")
        if r.status_code in (401, 403):
            rp.disallow_all = True
        elif r.status_code >= 400:
            rp.allow_all = True
        else:
            rp.parse(r.text.splitlines())
        _robots[base] = rp
    return _robots[base].can_fetch(USER_AGENT, url)


def get(url, *, robots=True, **kwargs):
    """Polite GET: honors robots.txt (skip with robots=False for official APIs) and waits DELAY_SECONDS per host."""
    if robots and not _allowed(url):
        raise Blocked(url)
    host = urlsplit(url).netloc
    wait = DELAY_SECONDS - (time.monotonic() - _last_hit.get(host, 0))
    if wait > 0:
        time.sleep(wait)
    try:
        r = _client.get(url, **kwargs)
    finally:
        _last_hit[host] = time.monotonic()
    r.raise_for_status()
    return r


def html_to_text(raw):
    text = html.unescape(raw or "")  # Greenhouse double-escapes its HTML
    text = re.sub(r"<(br|/?(?:p|li|div|ul|ol|h\d))\b[^>]*>", "\n", text, flags=re.I)
    text = html.unescape(re.sub(r"<[^>]+>", "", text))
    return re.sub(r"\n{3,}", "\n\n", text.replace("\xa0", " ")).strip()


def sources():
    from . import github, greenhouse, gupy, lever

    return {"gupy": gupy, "github": github, "greenhouse": greenhouse, "lever": lever}
