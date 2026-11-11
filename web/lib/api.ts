export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const errMsg = (e: unknown) => (e instanceof ApiError ? e.message : "Algo deu errado. Tente de novo.");

const cookie = (name: string) =>
  document.cookie.split("; ").find((c) => c.startsWith(name + "="))?.slice(name.length + 1) ?? "";

async function ensureCsrf() {
  if (!cookie("csrftoken")) await fetch("/api/auth/csrf", { credentials: "include" });
}

function detailOf(status: number, data: { detail?: unknown } | null): string {
  const d = data?.detail;
  if (typeof d === "string") return /too many/i.test(d) ? "Muitas tentativas. Aguarde alguns minutos." : d;
  if (Array.isArray(d)) {
    const fields = d.map((x) => (Array.isArray(x?.loc) ? String(x.loc[x.loc.length - 1]) : "")).filter(Boolean);
    return "Confira os campos" + (fields.length ? `: ${fields.join(", ")}.` : ".");
  }
  if (status === 429) return "Muitas tentativas. Aguarde alguns minutos.";
  return `Erro no servidor (${status}).`;
}

type Opts = { method?: string; body?: unknown; form?: FormData };

/** Same-origin JSON call with the Django session cookie and CSRF header. 401 on a protected call goes to /entrar. */
// Identical GETs in flight share one request. GET /api/jobs marks jobs as seen, so React's
// dev double-effect would otherwise make the second call report zero new jobs.
const inflight = new Map<string, Promise<unknown>>();

export function api<T>(path: string, opts: Opts = {}): Promise<T> {
  const m = opts.method ?? (opts.body !== undefined || opts.form ? "POST" : "GET");
  if (m !== "GET") return request<T>(path, m, opts);
  let p = inflight.get(path) as Promise<T> | undefined;
  if (!p) {
    p = request<T>(path, m, opts).finally(() => inflight.delete(path));
    inflight.set(path, p);
  }
  return p;
}

async function request<T>(path: string, m: string, { body, form }: Opts): Promise<T> {
  const headers: Record<string, string> = {};
  if (m !== "GET") {
    await ensureCsrf();
    headers["X-CSRFToken"] = cookie("csrftoken");
  }
  let payload: BodyInit | undefined = form;
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  let res: Response;
  try {
    res = await fetch(path, { method: m, headers, body: payload, credentials: "include" });
  } catch {
    throw new ApiError(0, "Sem conexão com o servidor. Tente de novo.");
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    // /auth/* answers 401 for wrong credentials/password; only /auth/me means "not logged in".
    if (res.status === 401 && (path === "/api/auth/me" || !path.startsWith("/api/auth/"))) {
      window.location.assign("/entrar");
    }
    throw new ApiError(res.status, detailOf(res.status, data));
  }
  return data as T;
}

// ---- Types (mirror src/jobhunter/api.py) ----

export type Why = { matched: string[]; missing: string[]; salary: string; skills_points: number; salary_points: number };
export type Job = {
  id: number; title: string; company: string; company_logo: string; url: string; source: string;
  level: string; area: string; contract: string; work_model: string; city: string; state: string;
  salary: string | number | null; published_at: string | null; deadline: string | null;
  stacks: string[]; score: number; why: Why; is_new: boolean;
  application_id: number | null; application_status: string | null;
};
export type JobDetail = Job & { description: string };
export type JobPage = { count: number; new_count: number; page: number; pages: number; items: Job[] };
export type Analysis = { text: string; created_at: string };
export type Application = {
  id: number; job_id: number | null; title: string; company: string; url: string; status: string;
  rejected_at_stage: string; notes: string; salary: string | number | null; created_at: string;
  updated_at: string; job_closed: boolean; company_logo: string; analysis: Analysis | null;
};
export type Profile = {
  areas: string[]; levels: string[]; work_models: string[]; state: string; city: string;
  salary_expectation: string | number | null; stack_ids: number[]; resume_text: string;
};
export type Option = { value: string; label: string };
export type Options = {
  areas: Option[]; levels: Option[]; work_models: Option[]; statuses: Option[]; states: string[];
  stacks: { id: number; name: string }[];
};

export const PAGE_SIZE = 20;
export const PIPELINE = ["SAVED", "APPLIED", "TEST", "INTERVIEW", "OFFER"] as const;
export const FINAL = ["REJECTED", "WITHDRAWN"] as const;
export const STATUS_LABEL: Record<string, string> = {
  SAVED: "Salva", APPLIED: "Aplicada", TEST: "Teste/Case", INTERVIEW: "Entrevista", OFFER: "Oferta",
  REJECTED: "Reprovada", WITHDRAWN: "Desisti",
};
export const STATUS_CLASS: Record<string, string> = {
  SAVED: "s-saved", APPLIED: "s-applied", TEST: "s-test", INTERVIEW: "s-int", OFFER: "s-offer",
  REJECTED: "s-rej", WITHDRAWN: "s-wd",
};
export const LEVEL_LETTER: Record<string, string> = { INTERNSHIP: "E", TRAINEE: "T", JUNIOR: "J" };
export const LEVEL_LABEL: Record<string, string> = { INTERNSHIP: "Estágio", TRAINEE: "Trainee", JUNIOR: "Júnior" };
export const WORK_LABEL: Record<string, string> = { ON_SITE: "Presencial", HYBRID: "Híbrido", REMOTE: "Remoto" };

// First page of the ranking, kept so going back from a job does not lose the "Nova" flags
// (the API marks them as seen on the first load of page 1).
let firstPage: JobPage | null = null;
export const getFirstPage = () => firstPage;
export const setFirstPage = (p: JobPage | null) => {
  firstPage = p;
};

// Skill catalog grouping (names come from src/jobhunter/stacks.py). Unknown names fall into "Outras".
const SKILL_GROUPS: Record<string, string[]> = {
  "Linguagens": ["Python", "Java", "JavaScript", "TypeScript", "C", "C++", "C#", "Go", "Rust", "Kotlin", "Swift", "PHP", "Ruby", "R", "Scala", "Dart", "Elixir", "Delphi", "VBA", "Shell/Bash"],
  "Frameworks e web": ["HTML/CSS", "React", "React Native", "Next.js", "Vue", "Angular", "Node.js", "NestJS", "Express", "Django", "Flask", "FastAPI", "Spring", ".NET", "Laravel", "Flutter", "Tailwind", "GraphQL", "REST"],
  "Dados e IA": ["SQL", "PostgreSQL", "MySQL", "SQL Server", "Oracle", "MongoDB", "Redis", "Excel", "Power BI", "Tableau", "Pandas", "NumPy", "Spark", "Airflow", "dbt", "Machine Learning", "Deep Learning", "Estatística", "LLM/IA generativa"],
  "Infra e cloud": ["Linux", "Windows Server", "Docker", "Kubernetes", "AWS", "Azure", "GCP", "Terraform", "CI/CD", "Redes", "Segurança da informação"],
  "Ferramentas e processos": ["Git", "Testes automatizados", "Scrum/Ágil", "Lean/Six Sigma", "Pacote Office", "SAP"],
  "Engenharia": ["AutoCAD", "SolidWorks", "Revit", "MATLAB", "CLP/PLC", "Arduino/Embarcados", "Inventor", "CATIA", "Ansys/FEA"],
  "Idiomas": ["Inglês", "Espanhol"],
};
const SKILL_GROUP = new Map(Object.entries(SKILL_GROUPS).flatMap(([g, names]) => names.map((n) => [n, g] as const)));

export function groupSkills<T extends { name: string }>(skills: T[]): [string, T[]][] {
  const out = new Map<string, T[]>(Object.keys(SKILL_GROUPS).map((g) => [g, []]));
  out.set("Outras", []);
  for (const s of skills) out.get(SKILL_GROUP.get(s.name) ?? "Outras")!.push(s);
  return [...out].filter(([, list]) => list.length);
}
