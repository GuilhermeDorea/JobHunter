## Job Hunter
[![Build Status](https://travis-ci.org/akashnimare/foco.svg?branch=master)](https://travis-ci.org/akashnimare/foco)
[![Windows Build Status](https://ci.appveyor.com/api/projects/status/github/akashnimare/foco?branch=master&svg=true)](https://ci.appveyor.com/project/akashnimare/foco/branch/master)
[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat)](https://github.com/feross/standard)

This repo main focus is to assist the user to find and organize job oportunities. It consists in a growing databank with job vacancy, manly focoused in the software development and data science market.

**Why should I use it, insted of other web options or a good old spreadsheet?**

The bigest differential of this tools is that its **completly free** and will keep a track record of:
- The closed job vacancy, so that JobHunter can estimate when a big company is going to open again its selection process;
- Every personal success or failure. With this data, the tool can give the user a customized feedback, with the main personal improvement points;

## Motivation

This project was made to help me undestand and learn the implemented tecnologies, while it also helped me search for job vacancies so I could aply it.

## Installation
It is adivised to run the application localy, so you can use your own API key, insted of the public one that is divided for each user. I personaly recomend the free gemini AI studio API, with 500 RPD in weakest models (gemini-3.5-lite) being more than enough for a single user.

## Built with
- Django
- Next.js
- Postgres



## Running (beta)
Scope and decisions: [docs/beta-spec.md](docs/beta-spec.md).

```bash
cp .env.example .env      # fill in the secrets
docker compose up -d --build                     # db, API (localhost:8000), daily collector, daily backup
docker compose --profile public up -d            # + Cloudflare Tunnel (needs TUNNEL_TOKEN)
```

Deploy: every push to `main` runs the tests on GitHub and then `docker compose up -d --build` on the self-hosted runner `jobhunter-pc` (label `jobhunter`), using `D:/jobhunter/.env`. Backups go to `D:/jobhunter/backups`.

```bash
docker compose exec web python manage.py createsuperuser   # admin at /admin
```

Front (`web/`, Next.js App Router): in dev, run Django on :8000, then `cd web && npm install && npm run dev` and open http://localhost:3000.
Next proxies `/api` and `/admin` to Django (`API_URL`, default `http://localhost:8000`; set at build time, so in Docker it is a build arg), keeping the browser same-origin.
Django checks the `Origin` header on POSTs, so add `DJANGO_CSRF_TRUSTED_ORIGINS=http://localhost:3000` to `.env` (or the shell) when using the dev server.

Dev without Docker (SQLite): `cd src && uv run python manage.py migrate && uv run python manage.py createcachetable && uv run python manage.py runserver`.
Collect once: `uv run python manage.py collect [--source gupy]`. Tests: `uv run python manage.py test jobhunter`.
API docs: `/api/docs`.
