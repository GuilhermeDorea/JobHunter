"""Pure-ish rules: classify a posting (level, area, stacks, salary, UF) and score it against a profile."""

import re
import unicodedata
from decimal import Decimal

from django.db.models import Q
from django.utils import timezone

from .models import Area, Job, Level, WorkModel


def _fold(text):
    """Lowercase without accents, so 'Estágio' and 'estagio' match the same rule."""
    return unicodedata.normalize("NFKD", text or "").encode("ascii", "ignore").decode().lower()


def _rx(*words):
    return re.compile(r"(?<![\w+#.])(" + "|".join(words) + r")(?![\w+#])")


# ponytail: keyword heuristics on the title; misclassify edge cases ("Desenvolvimento Humano"), refine lists as they show up.
_SENIOR = _rx(r"pleno", r"senior", r"sr\.?", r"ii", r"iii", r"iv", r"especialista", r"lead", r"lider",
              r"coordenador\w*", r"gerente", r"head", r"principal", r"staff", r"tech lead", r"aprendiz")
_LEVELS = [
    (Level.INTERNSHIP, _rx(r"estagi\w*", r"intern", r"internship")),
    (Level.TRAINEE, _rx(r"trainee")),
    (Level.JUNIOR, _rx(r"junior", r"jr\.?", r"i", r"assistente", r"auxiliar", r"entry level")),
]
# Order matters: "Engenharia de Dados" is DATA, "Suporte de TI" is INFRA.
_AREAS = [
    (Area.DATA, _rx(r"dados", r"data", r"bi", r"business intelligence", r"analytics", r"cientista",
                    r"machine learning", r"inteligencia artificial", r"ia", r"ai")),
    (Area.INFRA, _rx(r"infra(estrutura)? (de )?(ti|cloud|redes)", r"redes?(?! sociais)",
                     r"suporte (tecnico|de ti|ti|n[123])", r"help ?desk",
                     r"seguranca da informacao", r"ciberseguranca", r"cybersecurity", r"security", r"cloud",
                     r"devops", r"sre", r"sysadmin", r"service desk")),
    (Area.SOFTWARE, _rx(r"desenvolvedor\w*", r"developer", r"programador\w*", r"programacao", r"software",
                        r"front[- ]?end", r"back[- ]?end", r"full[- ]?stack", r"mobile", r"android", r"ios",
                        r"qa", r"quality assurance", r"sistemas(?! de gestao)", r"ti", r"tecnologia da informacao",
                        r"desenvolvimento (de software|web|de sistemas)", r"web", r"dev")),
    (Area.ENGINEERING, _rx(r"engenharia", r"engenheir\w*", r"mecatronica", r"automacao industrial",
                           r"eletrotecnica", r"eletronica")),
]


# Engenharias alheias à computação: não valem como "Engenharia" relevante (nem coletadas, nem ranqueadas).
# Sem fronteira de palavra para servir também de iregex no banco; "mecatrônica" não casa "mecânic".
ALIEN_ENG = r"civil|produ[cç][aã]o|mec[aâ]nic|qu[ií]mic|el[eé]trica|ambiental|minas|petr[oó]leo|naval|agr[oô]nom|sanit[aá]ri|de alimentos|t[eê]xtil|metal[uú]rgic"
_ALIEN = re.compile(ALIEN_ENG, re.I)


# Engenharias alheias à computação: não valem como "Engenharia" relevante (nem coletadas, nem ranqueadas).
# Sem fronteira de palavra para servir também de iregex no banco; "mecatrônica" não casa "mecânic".
ALIEN_ENG = r"civil|produ[cç][aã]o|mec[aâ]nic|qu[ií]mic|el[eé]trica|ambiental|minas|petr[oó]leo|naval|agr[oô]nom|sanit[aá]ri|de alimentos|t[eê]xtil|metal[uú]rgic"
_ALIEN = re.compile(ALIEN_ENG, re.I)


def detect_level(title, hint=None):
    """hint: level already stated by the source (e.g. Gupy's vacancy type)."""
    if hint:
        return hint
    t = _fold(title)
    if _SENIOR.search(t):
        return None
    return next((lvl for lvl, rx in _LEVELS if rx.search(t)), None)


def detect_area(title):
    t = _fold(title)
    area = next((area for area, rx in _AREAS if rx.search(t)), None)
    return None if area == Area.ENGINEERING and _ALIEN.search(title or "") else area


_stack_cache = {}


def detect_stacks(text, stacks):
    """Return the Stack objects whose aliases appear in text. `stacks` is an iterable of Stack."""
    t = (text or "").lower()
    found = []
    for s in stacks:
        key = (s.pk, tuple(s.aliases))
        if key not in _stack_cache:
            _stack_cache[key] = _rx(*s.aliases)
        if _stack_cache[key].search(t):
            found.append(s)
    return found


_MONEY = re.compile(r"R\$\s?(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{2}))?")


def detect_salary(text):
    """First 'R$ x' in a plausible monthly range; ignores daily allowances like 'R$ 10,50 por dia'."""
    for whole, cents in _MONEY.findall(text or ""):
        value = Decimal(whole.replace(".", "") + "." + (cents or "00"))
        if 500 <= value <= 30000:
            return value
    return None


UFS = {
    "AC": "acre", "AL": "alagoas", "AP": "amapa", "AM": "amazonas", "BA": "bahia", "CE": "ceara",
    "DF": "distrito federal", "ES": "espirito santo", "GO": "goias", "MA": "maranhao", "MT": "mato grosso",
    "MS": "mato grosso do sul", "MG": "minas gerais", "PA": "para", "PB": "paraiba", "PR": "parana",
    "PE": "pernambuco", "PI": "piaui", "RJ": "rio de janeiro", "RN": "rio grande do norte",
    "RS": "rio grande do sul", "RO": "rondonia", "RR": "roraima", "SC": "santa catarina", "SP": "sao paulo",
    "SE": "sergipe", "TO": "tocantins",
}
# Longest names first so "mato grosso do sul" wins over "mato grosso".
_UF_BY_NAME = sorted(((name, uf) for uf, name in UFS.items()), key=lambda p: -len(p[0]))
_UF_CODE = re.compile(r"(?<![A-Za-z])(" + "|".join(UFS) + r")(?![A-Za-z])")


def detect_state(text):
    """UF from a free-text location ('São Paulo, Brazil', 'Belo Horizonte, MG', 'Brasília')."""
    if m := _UF_CODE.search(text or ""):
        return m.group(1)
    t = _fold(text)
    if "brasilia" in t:
        return "DF"
    return next((uf for name, uf in _UF_BY_NAME if re.search(rf"\b{name}\b", t)), "")


def classify(item, stacks):
    """Fill level/area/stacks/salary on a normalized collector item. Returns None if out of scope."""
    level = detect_level(item["title"], item.get("level"))
    area = item.get("area") or detect_area(item["title"])
    if not level or not area:
        return None
    text = f"{item['title']}\n{item.get('description', '')}"
    return {
        **item,
        "level": level,
        "area": area,
        "stacks": detect_stacks(text, stacks),
        "salary": item.get("salary") or detect_salary(item.get("description")),
    }


# ---- Profile matching ----

SKILL_WEIGHT = 85
SALARY_WEIGHT = 15


def jobs_for(profile):
    """Hard filters: open, area, level, work model, location (remote and unknown location always pass)."""
    qs = Job.objects.filter(closed_at=None).exclude(deadline__lt=timezone.now())
    qs = qs.exclude(area=Area.ENGINEERING, title__iregex=ALIEN_ENG)  # vagas já coletadas de engenharias alheias
    qs = qs.exclude(area=Area.ENGINEERING, title__iregex=ALIEN_ENG)  # vagas já coletadas de engenharias alheias
    if profile.areas:
        qs = qs.filter(area__in=profile.areas)
    if profile.levels:
        qs = qs.filter(level__in=profile.levels)
    if profile.work_models:
        qs = qs.filter(Q(work_model__in=profile.work_models) | Q(work_model=""))
    if profile.state:
        qs = qs.filter(Q(work_model=WorkModel.REMOTE) | Q(state=profile.state) | Q(state=""))
    return qs


def score(job_stack_names, job_salary, my_stack_names, salary_expectation):
    """0-100 plus the 'why'. Missing info (no stacks / no salary) counts as neutral 0.5."""
    job_stacks, mine = set(job_stack_names), set(my_stack_names)
    matched, missing = sorted(job_stacks & mine), sorted(job_stacks - mine)
    skill = len(matched) / len(job_stacks) if job_stacks else 0.5

    if job_salary is None or not salary_expectation:
        salary, salary_note = 0.5, "Bolsa/salário não informado"
    else:
        ratio = float(job_salary) / float(salary_expectation)
        salary = max(0.0, min(1.0, (ratio - 0.5) / 0.5))  # 50% of expectation or less = 0, at/above = 1
        salary_note = "Paga o que você espera ou mais" if ratio >= 1 else f"Paga {ratio:.0%} do que você espera"

    total = round(SKILL_WEIGHT * skill + SALARY_WEIGHT * salary)
    skills_points = min(total, round(SKILL_WEIGHT * skill))  # the two parts always add up to the total
    return total, {"matched": matched, "missing": missing, "salary": salary_note,
                   "skills_points": skills_points, "salary_points": total - skills_points}
