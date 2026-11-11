from datetime import date, datetime
from datetime import timezone as dt_tz
from decimal import Decimal
from typing import Annotated

from django.conf import settings
from django.contrib.auth import authenticate, get_user_model, login, logout
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db import IntegrityError, transaction
from django.db.models import Count, Q
from django.middleware.csrf import get_token
from django.shortcuts import get_object_or_404
from django.utils import timezone
from ninja import File, NinjaAPI, Schema, UploadedFile
from ninja.errors import HttpError
from ninja.security import django_auth
from ninja.throttling import AnonRateThrottle
from ninja.utils import check_csrf
from pydantic import Field, HttpUrl

from .matching import UFS, jobs_for, score
from .models import Analysis, Application, Area, Job, Level, Profile, Stack, WorkModel

api = NinjaAPI(title="JobHunter API", auth=django_auth, urls_namespace="api")
User = get_user_model()
PAGE_SIZE = 20
AUTH_THROTTLE = [AnonRateThrottle("10/15m")]


def _profile(request):
    return Profile.objects.get_or_create(user=request.user)[0]


def _csrf(request):
    # Login/signup are unauthenticated, so ninja skips CSRF there; enforce it by hand.
    if check_csrf(request):
        raise HttpError(403, "CSRF inválido. Chame GET /api/auth/csrf antes.")


# ---------- Auth ----------

class Credentials(Schema):
    email: str = Field(max_length=254)
    password: str


class Me(Schema):
    email: str


class PasswordIn(Schema):
    password: str


@api.get("/auth/csrf", auth=None)
def csrf(request):
    """Sets the csrftoken cookie; send it back as X-CSRFToken on every POST/PUT/PATCH/DELETE."""
    return {"csrftoken": get_token(request)}


@api.post("/auth/signup", auth=None, throttle=AUTH_THROTTLE, response={201: Me})
def signup(request, data: Credentials):
    _csrf(request)
    email = data.email.strip().lower()
    try:
        validate_email(email)
    except ValidationError:
        raise HttpError(400, "E-mail inválido.")
    user = User(username=email, email=email)
    try:
        validate_password(data.password, user)
    except ValidationError as e:
        raise HttpError(400, " ".join(e.messages))
    if User.objects.filter(username=email).exists():
        raise HttpError(400, "Já existe uma conta com esse e-mail.")
    user.set_password(data.password)
    user.save()
    login(request, user)
    return 201, {"email": email}


@api.post("/auth/login", auth=None, throttle=AUTH_THROTTLE, response=Me)
def login_view(request, data: Credentials):
    _csrf(request)
    user = authenticate(request, username=data.email.strip().lower(), password=data.password)
    if not user:
        raise HttpError(401, "E-mail ou senha incorretos.")
    login(request, user)
    return {"email": user.email}


@api.post("/auth/logout", response={204: None})
def logout_view(request):
    logout(request)
    return 204, None


@api.get("/auth/me", response=Me)
def me(request):
    return {"email": request.user.email}


@api.post("/auth/delete", response={204: None})
def delete_account(request, data: PasswordIn):
    """Deletes the user and everything that hangs off it (profile, cards, analyses)."""
    if not request.user.check_password(data.password):
        raise HttpError(401, "Senha incorreta.")
    user = request.user
    logout(request)
    user.delete()
    return 204, None


# ---------- Options ----------

@api.get("/options", auth=None)
def options(request):
    pairs = lambda choices: [{"value": v, "label": lbl} for v, lbl in choices]  # noqa: E731
    return {
        "areas": pairs(Area.choices),
        "levels": pairs(Level.choices),
        "work_models": pairs(WorkModel.choices),
        "statuses": pairs(Application.Status.choices),
        "states": sorted(UFS),
        "stacks": list(Stack.objects.values("id", "name")),
    }


# ---------- Profile ----------

class ProfileIn(Schema):
    areas: list[Area] = []
    levels: list[Level] = []
    work_models: list[WorkModel] = []
    state: str = Field("", max_length=2)
    city: str = Field("", max_length=100)
    salary_expectation: Decimal | None = Field(None, ge=0, le=100000)
    stack_ids: list[int] = []
    resume_text: str = Field("", max_length=50000)


class ProfileOut(ProfileIn):
    pass


def _profile_out(p):
    return {
        "areas": p.areas, "levels": p.levels, "work_models": p.work_models, "state": p.state, "city": p.city,
        "salary_expectation": p.salary_expectation, "stack_ids": list(p.stacks.values_list("id", flat=True)),
        "resume_text": p.resume_text,
    }


@api.get("/profile", response=ProfileOut)
def get_profile(request):
    return _profile_out(_profile(request))


@api.put("/profile", response=ProfileOut)
def put_profile(request, data: ProfileIn):
    state = data.state.upper()
    if state and state not in UFS:
        raise HttpError(400, "UF inválida.")
    p = _profile(request)
    for field in ("areas", "levels", "work_models", "city", "salary_expectation", "resume_text"):
        setattr(p, field, getattr(data, field))
    p.state = state
    p.save()
    p.stacks.set(Stack.objects.filter(id__in=data.stack_ids))
    return _profile_out(p)


@api.post("/profile/resume", response=ProfileOut)
def upload_resume(request, file: File[UploadedFile]):
    """PDF -> plain text. Only the text is kept."""
    from pypdf import PdfReader
    from pypdf.errors import PdfReadError

    if file.size > 5 * 1024 * 1024:
        raise HttpError(400, "PDF maior que 5 MB.")
    try:
        text = "\n".join(page.extract_text() or "" for page in PdfReader(file).pages).strip()
    except (PdfReadError, ValueError):
        raise HttpError(400, "Não consegui ler esse PDF.")
    if not text:
        raise HttpError(400, "O PDF não tem texto (é uma imagem?). Cole o texto no perfil.")
    p = _profile(request)
    p.resume_text = text[:50000]
    p.save(update_fields=["resume_text"])
    return _profile_out(p)


SKILLS_PROMPT = """Do currículo abaixo, liste as skills do candidato que existem EXATAMENTE neste catálogo (use os nomes idênticos):
{catalog}

Inclua só o que o currículo evidencia (projetos, cursos, experiência). Responda apenas com um array JSON de strings.

Currículo:
{resume}
"""


class SkillsOut(Schema):
    stack_ids: list[int]


@api.post("/profile/extract-skills", response=SkillsOut)
def extract_skills(request):
    """Gemini picks catalog skills evidenced in the saved resume text. Returns ids; the front merges and saves."""
    import json

    p = _profile(request)
    if not p.resume_text.strip():
        raise HttpError(400, "Envie o currículo (ou cole o texto) antes de gerar as skills.")
    if not settings.GEMINI_API_KEY:
        raise HttpError(503, "Indisponível: servidor sem chave do Gemini.")
    stacks = {s.name.lower(): s.id for s in Stack.objects.all()}
    from google import genai

    try:
        client = genai.Client(api_key=settings.GEMINI_API_KEY)  # keep a reference: a temporary Client is GC-closed mid-request
        resp = client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=SKILLS_PROMPT.format(catalog=", ".join(Stack.objects.values_list("name", flat=True)),
                                          resume=p.resume_text[:20000]),
            config={"response_mime_type": "application/json"},
        )
        names = json.loads(resp.text)
    except Exception as e:
        raise HttpError(502, f"Gemini falhou: {e.__class__.__name__}")
    if not isinstance(names, list):
        raise HttpError(502, "Gemini devolveu um formato inesperado.")
    return {"stack_ids": sorted({stacks[n.lower()] for n in names if isinstance(n, str) and n.lower() in stacks})}


# ---------- CV builder + review ----------

def _gemini(contents, as_json=False):
    """One Gemini call, retried on 5xx ("high demand" is common). 503 without a key, 502 on failure or bad JSON."""
    import json
    import time

    if not settings.GEMINI_API_KEY:
        raise HttpError(503, "Indisponível: servidor sem chave do Gemini.")
    from google import genai
    from google.genai.errors import ServerError

    client = genai.Client(api_key=settings.GEMINI_API_KEY)  # keep a reference: a temporary Client is GC-closed mid-request
    for attempt in range(3):
        try:
            text = client.models.generate_content(
                model=settings.GEMINI_MODEL, contents=contents,
                config={"response_mime_type": "application/json"} if as_json else None,
            ).text
            break
        except ServerError as e:
            if attempt == 2:
                raise HttpError(502, f"Gemini falhou: {e.__class__.__name__}")
            time.sleep(3 * (attempt + 1))
        except Exception as e:
            raise HttpError(502, f"Gemini falhou: {e.__class__.__name__}")
    if not text:
        raise HttpError(502, "Gemini não retornou texto.")
    try:
        return json.loads(text) if as_json else text
    except ValueError:
        raise HttpError(502, "Gemini devolveu um formato inesperado.")


Line = Annotated[str, Field(max_length=600)]


class CvEntry(Schema):
    title: str = Field("", max_length=200)  # cargo, curso ou projeto
    org: str = Field("", max_length=200)  # empresa, instituição ou tecnologias
    place: str = Field("", max_length=100)
    period: str = Field("", max_length=60)
    bullets: list[Line] = Field([], max_length=12)


class CvSkill(Schema):
    group: str = Field("", max_length=60)
    items: str = Field("", max_length=400)


class Cv(Schema):
    name: str = Field("", max_length=120)
    location: str = Field("", max_length=100)
    contacts: str = Field("", max_length=300)
    summary: str = Field("", max_length=1000)
    experiences: list[CvEntry] = Field([], max_length=15)
    projects: list[CvEntry] = Field([], max_length=15)
    education: list[CvEntry] = Field([], max_length=6)
    skills: list[CvSkill] = Field([], max_length=12)
    achievements: list[Line] = Field([], max_length=12)


class CvReview(Schema):
    score: int = Field(ge=0, le=100)
    summary: str
    unsupported: list[dict]  # [{skill, fix}] skill declarada sem experiência que comprove
    gaps: list[dict]  # [{skill, why}] pedida pelas vagas/reprovações e ausente
    rewrites: list[dict]  # [{before, after}]
    next_steps: list[str]
    created_at: str = ""


class CvOut(Schema):
    cv: Cv | None
    review: CvReview | None


CV_SECTIONS = (("experiences", "Experiência"), ("projects", "Projetos"), ("education", "Formação"))


def _cv_text(cv):
    """Plain-text render: saved as resume_text so the other AI features read the edited CV."""
    out = [cv["name"], " • ".join(x for x in (cv["location"], cv["contacts"]) if x)]
    if cv["summary"]:
        out += ["", "Resumo", cv["summary"]]
    for key, label in CV_SECTIONS:
        if cv[key]:
            out += ["", label]
            for e in cv[key]:
                out.append(" | ".join(x for x in (e["title"], e["org"], e["place"], e["period"]) if x))
                out += [f"- {b}" for b in e["bullets"]]
    if cv["skills"]:
        out += ["", "Habilidades"] + [f"{s['group']}: {s['items']}" if s["group"] else s["items"] for s in cv["skills"]]
    if cv["achievements"]:
        out += ["", "Conquistas"] + [f"- {a}" for a in cv["achievements"]]
    return "\n".join(out).strip()


def _cv_out(p):
    return {"cv": p.cv or None, "review": p.cv_review or None}


@api.get("/profile/cv", response=CvOut)
def get_cv(request):
    return _cv_out(_profile(request))


@api.put("/profile/cv", response=CvOut)
def put_cv(request, data: Cv):
    cv = data.dict()
    for key, _ in CV_SECTIONS:
        for e in cv[key]:
            e["bullets"] = [b.strip() for b in e["bullets"] if b.strip()]
    cv["achievements"] = [a.strip() for a in cv["achievements"] if a.strip()]
    p = _profile(request)
    p.cv, p.resume_text = cv, _cv_text(cv)[:50000]
    p.save(update_fields=["cv", "resume_text"])
    return _cv_out(p)


CV_IMPORT_PROMPT = """Converta o currículo abaixo (texto extraído de PDF) para JSON neste formato exato:
{{"name": "", "location": "", "contacts": "e-mail • github • linkedin numa linha", "summary": "",
 "experiences": [{{"title": "cargo", "org": "empresa", "place": "cidade ou Remoto", "period": "Jan 2025–atual", "bullets": ["..."]}}],
 "projects": [{{"title": "nome do projeto", "org": "tecnologias", "place": "", "period": "", "bullets": ["..."]}}],
 "education": [{{"title": "curso", "org": "instituição", "place": "", "period": "", "bullets": ["disciplinas, TCC..."]}}],
 "skills": [{{"group": "Backend", "items": "Python, Django"}}],
 "achievements": ["..."]}}

Regras: copie o conteúdo fielmente, sem inventar nem resumir. Corrija acentos quebrados pela extração do PDF
(ex.: "Experiˆencia" -> "Experiência", "manutenc ¸˜ao" -> "manutenção"). Idiomas e certificações entram em "skills"
(ex.: group "Inglês"). Campos ausentes ficam "" ou [].

Currículo:
{resume}
"""


@api.post("/profile/cv/import", response=Cv)
def import_cv(request):
    """Gemini turns the saved resume text into the CV editor structure. Not saved: the front reviews then PUTs."""
    p = _profile(request)
    if not p.resume_text.strip():
        raise HttpError(400, "Envie o PDF ou cole o texto do currículo no Perfil antes de importar.")
    out = _gemini(CV_IMPORT_PROMPT.format(resume=p.resume_text[:20000]), as_json=True)
    try:
        return Cv(**out)
    except (TypeError, ValueError):
        raise HttpError(502, "Gemini devolveu um formato inesperado.")


CV_REVIEW_PROMPT = """Você é recrutador técnico de vagas de estágio, trainee e júnior em TI e engenharia no Brasil.
Avalie o currículo abaixo com rigor e responda em português, apenas com JSON neste formato:
{{"score": 0-100, "summary": "2-3 frases: o que o currículo comunica hoje e o maior problema",
 "unsupported": [{{"skill": "...", "fix": "como comprovar: projeto, bullet ou tirar do currículo"}}],
 "gaps": [{{"skill": "...", "why": "quantas vagas pedem / em que reprovação pesou"}}],
 "rewrites": [{{"before": "bullet atual, copiado", "after": "versão melhor, com verbo de ação, tecnologia e resultado"}}],
 "next_steps": ["ação concreta, em ordem de prioridade"]}}

Critérios:
- "unsupported": skills que o candidato declara (seção Habilidades ou skills marcadas) mas que NENHUMA experiência,
  projeto ou formação mostra sendo usada. Recrutador desconfia disso. Seja literal: só conta se aparece no texto de uma entrada.
- "gaps": skills pedidas com frequência pelas vagas compatíveis ou ligadas às reprovações e que não aparecem no currículo.
  Priorize as que se repetem nas reprovações.
- "rewrites": até 5 bullets fracos (sem resultado, vagos, longos). Não invente números; use [X] onde faltar dado.
- Não invente fatos sobre o candidato.

## Perfil
Áreas: {areas}. Nível buscado: {levels}.
Skills marcadas no perfil: {skills}

## Skills mais pedidas nas {total} vagas compatíveis (vagas que pedem)
{demand}

## Reprovações recentes (vaga, etapa, skills da vaga que faltam no perfil, anotações)
{rejections}

## Currículo
{cv}
"""


@api.post("/profile/cv/review", response=CvReview)
def review_cv(request):
    """Gemini reviews the CV against job demand and the user's rejections. Last review is kept on the profile."""
    p = _profile(request)
    text = _cv_text(p.cv) if p.cv else p.resume_text
    if not text.strip():
        raise HttpError(400, "Monte ou importe o currículo antes de avaliar.")
    mine = set(p.stacks.values_list("name", flat=True))
    jobs = jobs_for(p)
    demand = Stack.objects.filter(job__in=jobs).annotate(n=Count("job")).order_by("-n")[:20]
    rejected = (Application.objects.filter(user=request.user, status=Application.Status.REJECTED)
                .select_related("job").order_by("-updated_at")[:10])
    rejections = []
    for a in rejected:
        missing = sorted(set(a.job.stacks.values_list("name", flat=True)) - mine) if a.job else []
        stage = Application.Status(a.rejected_at_stage).label if a.rejected_at_stage else "?"
        rejections.append(f"- {a.title} ({a.company}), etapa {stage}; faltam: {', '.join(missing) or '-'}; "
                          f"notas: {a.notes[:300] or '-'}")
    out = _gemini(CV_REVIEW_PROMPT.format(
        areas=", ".join(p.areas) or "-", levels=", ".join(p.levels) or "-", skills=", ".join(sorted(mine)) or "(nenhuma)",
        total=jobs.count(), demand="\n".join(f"- {s.name}: {s.n}" for s in demand) or "(sem vagas compatíveis)",
        rejections="\n".join(rejections) or "(nenhuma reprovação registrada)", cv=text[:20000],
    ), as_json=True)
    try:
        review = CvReview(**out, created_at=timezone.now().isoformat()).dict()
    except (TypeError, ValueError):
        raise HttpError(502, "Gemini devolveu um formato inesperado.")
    p.cv_review = review
    p.save(update_fields=["cv_review"])
    return review


# ---------- Jobs ----------

class Why(Schema):
    matched: list[str]
    missing: list[str]
    salary: str
    skills_points: int
    salary_points: int


class JobOut(Schema):
    id: int
    title: str
    company: str
    company_logo: str
    url: str
    source: str
    level: str
    area: str
    contract: str
    work_model: str
    city: str
    state: str
    salary: Decimal | None
    published_at: datetime | None
    deadline: datetime | None
    stacks: list[str]
    score: int
    why: Why
    is_new: bool
    application_id: int | None
    application_status: str | None


class JobDetail(JobOut):
    description: str


class JobPage(Schema):
    count: int
    new_count: int
    page: int
    pages: int
    items: list[JobOut]


def _scored(job, profile, my_stacks, seen_before, cards):
    names = [s.name for s in job.stacks.all()]
    total, why = score(names, job.salary, my_stacks, profile.salary_expectation)
    card = cards.get(job.id)
    return {
        **{f: getattr(job, f) for f in ("id", "title", "company", "company_logo", "url", "source", "level", "area", "contract",
                                        "work_model", "city", "state", "salary", "published_at", "deadline")},
        "stacks": names,
        "score": total,
        "why": why,
        "is_new": bool(seen_before and job.first_seen > seen_before),
        "application_id": card.id if card else None,
        "application_status": card.status if card else None,
    }


def _cards(user):
    return {a.job_id: a for a in Application.objects.filter(user=user, job__isnull=False)}


@api.get("/jobs", response=JobPage)
def list_jobs(request, page: int = 1, q: str = ""):
    """Hard-filtered by the profile, ranked by score (then newest). is_new = first seen since your last visit."""
    profile = _profile(request)
    qs = jobs_for(profile).prefetch_related("stacks")
    if q:
        qs = qs.filter(Q(title__icontains=q) | Q(company__icontains=q))
    my_stacks = list(profile.stacks.values_list("name", flat=True))
    cards = _cards(request.user)
    # ponytail: scores every matching job in Python per request; fine for a few thousand, precompute if it grows.
    items = [_scored(j, profile, my_stacks, profile.last_seen_jobs_at, cards) for j in qs]
    items.sort(key=lambda i: (i["score"], i["published_at"] or datetime.min.replace(tzinfo=dt_tz.utc)),
               reverse=True)
    if page == 1 and not q:
        profile.last_seen_jobs_at = timezone.now()
        profile.save(update_fields=["last_seen_jobs_at"])
    pages = max(1, -(-len(items) // PAGE_SIZE))
    start = (page - 1) * PAGE_SIZE
    new_count = sum(i["is_new"] for i in items)
    return {"count": len(items), "new_count": new_count, "page": page, "pages": pages, "items": items[start:start + PAGE_SIZE]}


@api.get("/jobs/{job_id}", response=JobDetail)
def job_detail(request, job_id: int):
    profile = _profile(request)
    job = get_object_or_404(Job.objects.prefetch_related("stacks"), id=job_id)
    my_stacks = list(profile.stacks.values_list("name", flat=True))
    return {**_scored(job, profile, my_stacks, None, _cards(request.user)), "description": job.description}


PREPARE_PROMPT = """Você ajuda um candidato a se candidatar. Use APENAS fatos presentes no currículo; não invente nada.
Escreva em português do Brasil, a menos que a vaga esteja em inglês (então em inglês).
Responda só JSON com as chaves:
"cover_letter": carta de apresentação curta, 120 a 180 palavras;
"why_company": 2 a 3 frases sobre por que a empresa/vaga interessa ao candidato;
"email_body": a carta adaptada para corpo de e-mail, terminando com uma linha pedindo que vejam o currículo em anexo.

## Vaga: {title} na {company}
{description}

## Currículo
{resume}
"""


class PrepareOut(Schema):
    cover_letter: str
    why_company: str
    email: dict | None


@api.post("/jobs/{job_id}/prepare-application", response=PrepareOut)
def prepare_application(request, job_id: int):
    """Gemini drafts cover letter, 'why this company' and (if the posting lists an e-mail) an application e-mail."""
    import json
    import re

    p = _profile(request)
    if not p.resume_text.strip():
        raise HttpError(400, "Envie o currículo (ou cole o texto) antes de preparar a candidatura.")
    if not settings.GEMINI_API_KEY:
        raise HttpError(503, "Indisponível: servidor sem chave do Gemini.")
    job = get_object_or_404(Job, id=job_id)
    from google import genai

    try:
        client = genai.Client(api_key=settings.GEMINI_API_KEY)  # keep a reference: a temporary Client is GC-closed mid-request
        resp = client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=PREPARE_PROMPT.format(title=job.title, company=job.company,
                                           description=job.description[:8000], resume=p.resume_text[:20000]),
            config={"response_mime_type": "application/json"},
        )
        out = json.loads(resp.text)
        letter, why, body = (str(out[k]) for k in ("cover_letter", "why_company", "email_body"))
    except (KeyError, TypeError, ValueError):
        raise HttpError(502, "Gemini devolveu um formato inesperado.")
    except Exception as e:
        raise HttpError(502, f"Gemini falhou: {e.__class__.__name__}")
    m = re.search(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+", job.description)
    email = {"to": m.group(0), "subject": f"Candidatura: {job.title}", "body": body} if m else None
    return {"cover_letter": letter, "why_company": why, "email": email}


@api.get("/radar")
def radar(request, limit: int = 10):
    """Stacks most requested by the jobs that fit your filters, that you haven't marked yet."""
    profile = _profile(request)
    jobs = jobs_for(profile)
    total = jobs.count()
    top = (
        Stack.objects.filter(job__in=jobs)
        .exclude(id__in=profile.stacks.all())
        .annotate(jobs=Count("job"))
        .order_by("-jobs")[: min(limit, 30)]
    )
    return {"total_jobs": total, "stacks": [{"id": s.id, "name": s.name, "jobs": s.jobs} for s in top]}


# ---------- Applications (kanban) ----------

class AnalysisOut(Schema):
    text: str
    created_at: datetime


class ApplicationIn(Schema):
    job_id: int | None = None
    title: str = Field("", max_length=300)
    company: str = Field("", max_length=200)
    url: HttpUrl | None = None
    status: Application.Status = Application.Status.SAVED
    notes: str = Field("", max_length=20000)


class ApplicationPatch(Schema):
    status: Application.Status | None = None
    notes: str | None = Field(None, max_length=20000)
    salary: Decimal | None = Field(None, ge=0, le=100000)
    deadline: date | None = None


class ApplicationOut(Schema):
    id: int
    job_id: int | None
    title: str
    company: str
    url: str
    status: str
    rejected_at_stage: str
    notes: str
    salary: Decimal | None
    deadline: date | None
    created_at: datetime
    updated_at: datetime
    job_closed: bool
    company_logo: str
    analysis: AnalysisOut | None


def _app_out(a):
    last = max(a.analyses.all(), key=lambda x: x.created_at, default=None)
    return {
        **{f: getattr(a, f) for f in ("id", "job_id", "title", "company", "url", "status", "rejected_at_stage",
                                      "notes", "salary", "created_at", "updated_at")},
        "deadline": a.deadline or (a.job.deadline.date() if a.job and a.job.deadline else None),
        "job_closed": bool(a.job and a.job.closed_at),
        "company_logo": a.job.company_logo if a.job else "",
        "analysis": last,
    }


def _my_app(request, app_id):
    return get_object_or_404(Application.objects.select_related("job"), id=app_id, user=request.user)


@api.get("/applications", response=list[ApplicationOut])
def list_applications(request):
    qs = Application.objects.filter(user=request.user).select_related("job").prefetch_related("analyses")
    return [_app_out(a) for a in qs.order_by("-updated_at")]


@api.post("/applications", response={201: ApplicationOut})
def create_application(request, data: ApplicationIn):
    """Either job_id (collected job) or title + company (manual card)."""
    if data.job_id:
        job = get_object_or_404(Job, id=data.job_id)
        fields = {"job": job, "title": job.title, "company": job.company, "url": job.url}
    elif data.title.strip() and data.company.strip():
        fields = {"title": data.title.strip(), "company": data.company.strip(), "url": str(data.url or "")}
    else:
        raise HttpError(400, "Informe job_id ou título + empresa.")
    try:
        with transaction.atomic():
            a = Application.objects.create(user=request.user, status=data.status, notes=data.notes, **fields)
    except IntegrityError:
        raise HttpError(409, "Essa vaga já está no seu kanban.")
    return 201, _app_out(a)


@api.patch("/applications/{app_id}", response=ApplicationOut)
def update_application(request, app_id: int, data: ApplicationPatch):
    a = _my_app(request, app_id)
    changes = data.dict(exclude_unset=True)
    for field in ("status", "notes"):  # not nullable; null means "leave as is"
        if changes.get(field, "") is None:
            changes.pop(field)
    new_status = changes.get("status")
    if new_status == Application.Status.REJECTED and a.status != Application.Status.REJECTED:
        a.rejected_at_stage = a.status
    for field, value in changes.items():
        setattr(a, field, value)
    a.save()
    return _app_out(a)


@api.delete("/applications/{app_id}", response={204: None})
def delete_application(request, app_id: int):
    _my_app(request, app_id).delete()
    return 204, None


ANALYST_PROMPT = """Você é um analista de carreira para estudantes e profissionais em início de carreira (estágio, trainee, júnior) em TI e engenharia no Brasil.
O candidato foi reprovado no processo abaixo. Com base na vaga, no currículo, no perfil e nas anotações dele, responda em português, direto e prático, em markdown:

1. **O que provavelmente pesou** (2–4 hipóteses, da mais à menos provável, citando requisitos da vaga vs. o currículo)
2. **O que estudar** (tópicos concretos, em ordem de prioridade)
3. **Ajustes no currículo** para vagas parecidas (frases e seções específicas)
4. **Próximo passo** em uma frase

Não invente fatos sobre o candidato. Se faltar informação (ex.: currículo vazio), diga o que ele deveria registrar.

## Vaga
Título: {title}
Empresa: {company}
Etapa em que foi reprovado: {stage}
Descrição:
{description}

## Perfil
Skills marcadas: {skills}
Nível buscado: {levels}

## Anotações do candidato sobre o processo
{notes}

## Currículo
{resume}
"""


@api.post("/applications/{app_id}/analyze", response=AnalysisOut)
def analyze(request, app_id: int):
    """Gemini reviews a rejected application. Limited per user per day (shared free quota)."""
    a = _my_app(request, app_id)
    if a.status != Application.Status.REJECTED:
        raise HttpError(400, "A análise é para candidaturas reprovadas.")
    if not settings.GEMINI_API_KEY:
        raise HttpError(503, "Análise indisponível: servidor sem chave do Gemini.")
    used = Analysis.objects.filter(application__user=request.user, created_at__date=timezone.localdate()).count()
    if used >= settings.ANALYSES_PER_DAY:
        raise HttpError(429, f"Limite de {settings.ANALYSES_PER_DAY} análises por dia atingido.")

    profile = _profile(request)
    stage = Application.Status(a.rejected_at_stage).label if a.rejected_at_stage else "não informada"
    prompt = ANALYST_PROMPT.format(
        title=a.title, company=a.company, stage=stage,
        description=(a.job.description if a.job else "") or "(card manual, sem descrição)",
        skills=", ".join(profile.stacks.values_list("name", flat=True)) or "(nenhuma)",
        levels=", ".join(profile.levels) or "(não definido)",
        notes=a.notes or "(nenhuma)",
        resume=profile.resume_text or "(currículo não enviado)",
    )
    from google import genai

    try:
        client = genai.Client(api_key=settings.GEMINI_API_KEY)  # keep a reference: a temporary Client is GC-closed mid-request
        resp = client.models.generate_content(
            model=settings.GEMINI_MODEL, contents=prompt
        )
        text = resp.text
    except Exception as e:
        raise HttpError(502, f"Gemini falhou: {e.__class__.__name__}")
    if not text:
        raise HttpError(502, "Gemini não retornou texto.")
    return Analysis.objects.create(application=a, text=text)
