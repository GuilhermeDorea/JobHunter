"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { ApiError, api, errMsg, type Cv, type CvEntry, type CvReview } from "@/lib/api";
import { ErrorBox, useFetch } from "@/lib/ui";

const BLANK: Cv = { name: "", location: "", contacts: "", summary: "", experiences: [], projects: [], education: [], skills: [], achievements: [] };
const ENTRY: CvEntry = { title: "", org: "", place: "", period: "", bullets: [] };
type Key = "experiences" | "projects" | "education";
const SECTIONS: { key: Key; label: string; title: string; org: string }[] = [
  { key: "experiences", label: "Experiência", title: "Cargo", org: "Empresa" },
  { key: "projects", label: "Projetos", title: "Projeto", org: "Tecnologias" },
  { key: "education", label: "Formação", title: "Curso", org: "Instituição" },
];

const iaMsg = (e: unknown) =>
  e instanceof ApiError && (e.status === 502 || e.status === 503) ? "IA indisponível agora. Tente de novo em instantes." : errMsg(e);

export default function Curriculo() {
  const got = useFetch<{ cv: Cv | null; review: CvReview | null; has_text: boolean }>("/api/profile/cv");
  const [cv, setCv] = useState<Cv | null>(null);
  const [review, setReview] = useState<CvReview | null>(null);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [paste, setPaste] = useState("");

  useEffect(() => {
    if (!got.data) return;
    setCv(got.data.cv);
    setReview(got.data.review);
  }, [got.data]);

  if (got.error) return <section className="screen"><ErrorBox message={got.error} retry={got.reload} /></section>;
  if (!got.data) return <section className="screen" aria-busy="true"><h1>Currículo</h1><div className="sk-box" style={{ marginTop: 20 }} /></section>;

  const edit = (next: Cv) => { setCv(next); setDirty(true); setMsg(null); };

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      setMsg({ ok: false, text: iaMsg(e) });
    } finally {
      setBusy("");
    }
  }

  const importCv = (text = "") => run("import", async () => {
    edit(await api<Cv>("/api/profile/cv/import", { body: { text } }));
    setMsg({ ok: true, text: "Importado. Confira os campos e salve." });
  });

  const onPdf = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    run("import", async () => {
      const form = new FormData();
      form.append("file", file);
      await api("/api/profile/resume", { form });
      edit(await api<Cv>("/api/profile/cv/import", { body: { text: "" } }));
      setMsg({ ok: true, text: "PDF lido. Confira os campos e salve." });
    });
  };

  const save = (cur: Cv) => run("save", async () => {
    await api("/api/profile/cv", { method: "PUT", body: cur });
    setDirty(false);
    setMsg({ ok: true, text: "Currículo salvo" });
  });

  const evaluate = () => run("review", async () => {
    if (cv && dirty) {
      await api("/api/profile/cv", { method: "PUT", body: cv });
      setDirty(false);
    }
    setReview(await api<CvReview>("/api/profile/cv/review", { method: "POST" }));
  });

  // Swaps a reviewed bullet for the suggested one, wherever it is.
  const apply = (before: string, after: string) => {
    if (!cv) return;
    const swap = (b: string) => (b.trim() === before.trim() ? after : b);
    const next = { ...cv, achievements: cv.achievements.map(swap) };
    for (const { key } of SECTIONS) next[key] = cv[key].map((e) => ({ ...e, bullets: e.bullets.map(swap) }));
    edit(next);
  };
  const hasBullet = (b: string) => !!cv && [...SECTIONS.flatMap(({ key }) => cv[key].flatMap((e) => e.bullets)), ...cv.achievements].some((x) => x.trim() === b.trim());

  const actions = (
    <div className="cvbar">
      <label className="btn" style={{ cursor: "pointer" }}>
        {busy === "import" ? "Lendo..." : cv ? "Substituir por PDF" : "Enviar PDF"}
        <input type="file" accept="application/pdf" className="sr" onChange={onPdf} disabled={!!busy} />
      </label>
      {cv && <>
        <button className="btn pri" onClick={() => save(cv)} disabled={!!busy || !dirty}>{busy === "save" ? "Salvando..." : dirty ? "Salvar" : "Salvo"}</button>
        <button className="btn" onClick={() => window.print()}>Baixar PDF</button>
        <button className="btn" onClick={evaluate} disabled={!!busy}>{busy === "review" ? "Avaliando..." : "Avaliar com IA"}</button>
      </>}
      {msg && <span className={`msg ${msg.ok ? "ok" : "bad"}`} role={msg.ok ? "status" : "alert"}>{msg.text}</span>}
    </div>
  );

  return (
    <section className="screen">
      <h1>Currículo</h1>
      <p className="sub">Edite à esquerda, veja o PDF à direita. Só vai à IA quando você clica.</p>
      {actions}
      {!cv ? (
        <div className="note cvstart">
          <p>Envie o PDF, cole o texto ou{" "}
            <button className="linkbtn" onClick={() => edit({ ...BLANK, experiences: [{ ...ENTRY }], education: [{ ...ENTRY }] })}>comece do zero</button>.</p>
          {got.data.has_text && (
            <button className="btn" onClick={() => importCv()} disabled={!!busy}>{busy === "import" ? "Lendo..." : "Usar o currículo já salvo"}</button>
          )}
          <textarea className="in" rows={6} maxLength={50000} aria-label="Texto do currículo" placeholder="Cole aqui o texto do seu currículo" value={paste} onChange={(e) => setPaste(e.target.value)} />
          <button className="btn" onClick={() => importCv(paste)} disabled={!!busy || !paste.trim()}>Importar texto</button>
        </div>
      ) : (
        <>
          {review && <Review r={review} apply={apply} has={hasBullet} />}
          <div className="cvgrid">
            <Editor cv={cv} set={edit} />
            <Paper cv={cv} />
          </div>
        </>
      )}
    </section>
  );
}

function Review({ r, apply, has }: { r: CvReview; apply: (b: string, a: string) => void; has: (b: string) => boolean }) {
  const tone = r.score >= 75 ? "var(--green)" : r.score >= 50 ? "var(--yellow)" : "var(--red)";
  return (
    <details className="cvrev">
      <summary className="cvscore">
        <span className="big num" style={{ color: tone }}>{r.score}</span>
        <div>
          <span className="lbl">Avaliação da IA · {new Date(r.created_at).toLocaleDateString("pt-BR")} · ver detalhes</span>
          <p>{r.summary}</p>
        </div>
      </summary>
      <div className="cvcols">
        <div>
          <h2 className="lbl">Sem comprovação</h2>
          {r.unsupported.length ? <ul>{r.unsupported.map((u, i) => <li key={i}><b>{u.skill}</b>: {u.fix}</li>)}</ul> : <p className="small">Nada.</p>}
        </div>
        <div>
          <h2 className="lbl">Faltando para as vagas</h2>
          {r.gaps.length ? <ul>{r.gaps.map((g, i) => <li key={i}><b>{g.skill}</b>: {g.why}</li>)}</ul> : <p className="small">Nada.</p>}
        </div>
      </div>
      {!!r.rewrites.length && (
        <div>
          <h2 className="lbl">Reescrever</h2>
          {r.rewrites.map((w, i) => (
            <div key={i} className="cvrw">
              <p className="small" style={{ textDecoration: "line-through" }}>{w.before}</p>
              <p>{w.after}</p>
              {has(w.before) && <button className="linkbtn" onClick={() => apply(w.before, w.after)}>Aplicar</button>}
            </div>
          ))}
        </div>
      )}
      {!!r.next_steps.length && <div><h2 className="lbl">Próximos passos</h2><ol>{r.next_steps.map((s, i) => <li key={i}>{s}</li>)}</ol></div>}
    </details>
  );
}

function Editor({ cv, set }: { cv: Cv; set: (c: Cv) => void }) {
  const field = (k: "name" | "location" | "contacts", label: string, max: number) => (
    <div className="f"><label className="lbl" htmlFor={`cv-${k}`}>{label}</label><input id={`cv-${k}`} className="in" maxLength={max} value={cv[k]} onChange={(e) => set({ ...cv, [k]: e.target.value })} /></div>
  );
  return (
    <div className="cved">
      {field("name", "Nome", 120)}
      {field("location", "Cidade", 100)}
      {field("contacts", "Contatos, separados por •", 300)}
      <div className="f"><label className="lbl" htmlFor="cv-sum">Resumo</label><textarea id="cv-sum" className="in" rows={3} maxLength={1000} value={cv.summary} onChange={(e) => set({ ...cv, summary: e.target.value })} /></div>

      {SECTIONS.map(({ key, label, title, org }) => (
        <fieldset key={key} className="cvsec">
          <legend className="lbl">{label}</legend>
          {cv[key].map((e, i) => {
            const put = (patch: Partial<CvEntry>) => set({ ...cv, [key]: cv[key].map((x, j) => (j === i ? { ...x, ...patch } : x)) });
            const move = (d: number) => { const l = [...cv[key]]; [l[i], l[i + d]] = [l[i + d], l[i]]; set({ ...cv, [key]: l }); };
            return (
              <div key={i} className="cventry">
                <div className="cv2">
                  <input className="in" aria-label={title} placeholder={title} maxLength={200} value={e.title} onChange={(x) => put({ title: x.target.value })} />
                  <input className="in" aria-label={org} placeholder={org} maxLength={200} value={e.org} onChange={(x) => put({ org: x.target.value })} />
                  <input className="in" aria-label="Local" placeholder="Local" maxLength={100} value={e.place} onChange={(x) => put({ place: x.target.value })} />
                  <input className="in" aria-label="Período" placeholder="Período (Jan 2025–atual)" maxLength={60} value={e.period} onChange={(x) => put({ period: x.target.value })} />
                </div>
                <textarea className="in" rows={Math.max(3, e.bullets.length + 1)} aria-label={`Tópicos de ${e.title || label}`} placeholder="Um tópico por linha"
                  value={e.bullets.join("\n")} onChange={(x) => put({ bullets: x.target.value.split("\n") })} />
                <div className="cvrow">
                  <button className="icb" aria-label="Subir" title="Subir" disabled={i === 0} onClick={() => move(-1)}>↑</button>
                  <button className="icb" aria-label="Descer" title="Descer" disabled={i === cv[key].length - 1} onClick={() => move(1)}>↓</button>
                  <button className="icb" aria-label="Remover" title="Remover" onClick={() => set({ ...cv, [key]: cv[key].filter((_, j) => j !== i) })}>×</button>
                </div>
              </div>
            );
          })}
          <button className="btn" onClick={() => set({ ...cv, [key]: [...cv[key], { ...ENTRY }] })}>+ {label}</button>
        </fieldset>
      ))}

      <fieldset className="cvsec">
        <legend className="lbl">Habilidades e idiomas</legend>
        {cv.skills.map((s, i) => {
          const put = (patch: Partial<typeof s>) => set({ ...cv, skills: cv.skills.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
          return (
            <div key={i} className="cvskill">
              <input className="in" aria-label="Grupo" placeholder="Grupo (Backend)" maxLength={60} value={s.group} onChange={(x) => put({ group: x.target.value })} />
              <input className="in" aria-label="Itens" placeholder="Python, Django, SQL" maxLength={400} value={s.items} onChange={(x) => put({ items: x.target.value })} />
              <button className="icb" aria-label="Remover grupo" title="Remover" onClick={() => set({ ...cv, skills: cv.skills.filter((_, j) => j !== i) })}>×</button>
            </div>
          );
        })}
        <button className="btn" onClick={() => set({ ...cv, skills: [...cv.skills, { group: "", items: "" }] })}>+ Grupo</button>
      </fieldset>

      <div className="f"><label className="lbl" htmlFor="cv-ach">Conquistas (uma por linha)</label>
        <textarea id="cv-ach" className="in" rows={3} value={cv.achievements.join("\n")} onChange={(e) => set({ ...cv, achievements: e.target.value.split("\n") })} /></div>
    </div>
  );
}

function Paper({ cv }: { cv: Cv }) {
  const lines = (l: string[]) => l.filter((b) => b.trim());
  return (
    <article className="paper" aria-label="Prévia do currículo">
      <h2 className="pn">{cv.name || "Seu nome"}</h2>
      <p className="pc">{cv.location && <span>{cv.location}</span>}{contacts(cv.contacts).map((c, i) => <Contact key={i} text={c} />)}</p>
      {cv.summary && <><h3>Resumo</h3><p>{cv.summary}</p></>}
      {SECTIONS.map(({ key, label }) => !!cv[key].length && (
        <section key={key}>
          <h3>{label}</h3>
          {cv[key].map((e, i) => (
            <div key={i} className="pe">
              <div className="pr"><b>{key !== "projects" ? e.org : e.title}</b><span>{e.place}</span></div>
              <div className="pr"><i>{key !== "projects" ? e.title : e.org}</i><span>{e.period}</span></div>
              {!!lines(e.bullets).length && <ul>{lines(e.bullets).map((b, j) => <li key={j}>{b}</li>)}</ul>}
            </div>
          ))}
        </section>
      ))}
      {!!cv.skills.length && <section><h3>Habilidades, Idiomas e Certificações</h3>{cv.skills.map((s, i) => <p key={i}>{s.group && <b>{s.group}: </b>}{s.items}</p>)}</section>}
      {!!lines(cv.achievements).length && <section><h3>Conquistas e Premiações</h3><ul>{lines(cv.achievements).map((a, i) => <li key={i}>{a}</li>)}</ul></section>}
    </article>
  );
}

// Contacts render as links with icons, so the printed PDF has clickable e-mail/GitHub/LinkedIn.
const contacts = (s: string) => s.split(/\s*[•|·]\s*/).map((c) => c.trim()).filter(Boolean);
const ICON: Record<string, string> = {
  mail: "M2 5h20v14H2zM2 5l10 8 10-8",
  phone: "M5 3h4l2 5-3 2a12 12 0 0 0 6 6l2-3 5 2v4a2 2 0 0 1-2 2A18 18 0 0 1 3 5a2 2 0 0 1 2-2",
  github: "M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1-.7.1-.7.1-.7 1.2 0 1.9 1.2 1.9 1.2 1 1.8 2.8 1.3 3.5 1 0-.8.4-1.3.7-1.6-2.7-.3-5.5-1.3-5.5-6 0-1.2.5-2.3 1.3-3.1-.2-.4-.6-1.6 0-3.2 0 0 1-.3 3.4 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.6.2 2.8 0 3.2.9.8 1.3 1.9 1.3 3.2 0 4.6-2.8 5.6-5.5 5.9.5.4.9 1 .9 2.2v3.3c0 .3.1.7.8.6A12 12 0 0 0 12 .3",
  linkedin: "M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z",
  link: "M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1",
};
function Contact({ text }: { text: string }) {
  const url = text.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const [kind, href] = /^\S+@\S+\.\S+$/.test(text) ? ["mail", "mailto:" + text]
    : /^[+(\d][\d\s().-]{7,}$/.test(text) ? ["phone", "tel:" + text.replace(/[^\d+]/g, "")]
    : /github\.com/i.test(text) ? ["github", "https://" + url]
    : /linkedin\.com/i.test(text) ? ["linkedin", "https://" + url]
    : /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(url) ? ["link", "https://" + url]
    : ["", ""];
  if (!kind) return <span>{text}</span>;
  const solid = kind === "github" || kind === "linkedin";
  return (
    <a href={href} target="_blank" rel="noreferrer">
      <svg viewBox="0 0 24 24" aria-hidden="true" fill={solid ? "currentColor" : "none"} stroke={solid ? "none" : "currentColor"} strokeWidth="2" strokeLinejoin="round"><path d={ICON[kind]} /></svg>
      {url}
    </a>
  );
}
