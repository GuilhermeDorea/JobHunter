"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ChangeEvent } from "react";
import { api, errMsg, setFirstPage, type Option, type Options, type Profile } from "@/lib/api";
import { ErrorBox, Modal, useFetch } from "@/lib/ui";

const MAX_VISIBLE = 60;

function Toggles({ label, options, value, onChange }: { label: string; options: Option[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="f" role="group" aria-labelledby={`l-${label}`}>
      <span className="lbl" id={`l-${label}`}>{label}</span>
      <div className="tog">
        {options.map((o) => {
          const on = value.includes(o.value);
          return (
            <button key={o.value} type="button" aria-pressed={on} onClick={() => onChange(on ? value.filter((v) => v !== o.value) : [...value, o.value])}>
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function Perfil() {
  const opts = useFetch<Options>("/api/options");
  const prof = useFetch<Profile>("/api/profile");
  const [p, setP] = useState<Profile | null>(null);
  const [skillQ, setSkillQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [upload, setUpload] = useState<{ busy: boolean; err: string }>({ busy: false, err: "" });

  useEffect(() => {
    if (prof.data) setP(prof.data);
  }, [prof.data]);

  if (opts.error || prof.error) return <section className="screen"><ErrorBox message={(opts.error || prof.error)!} retry={() => { opts.reload(); prof.reload(); }} /></section>;
  if (!p || !opts.data) {
    return (
      <section className="screen" aria-busy="true">
        <h1>Perfil</h1>
        <div className="form">{Array.from({ length: 6 }, (_, i) => <div key={i} className="sk-box" style={{ height: 90 }} />)}</div>
      </section>
    );
  }
  const o = opts.data;
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => { setP({ ...p, [k]: v }); setMsg(null); };

  const skills = new Map(o.stacks.map((s) => [s.id, s.name]));
  const chosen = p.stack_ids.filter((id) => skills.has(id));
  const needle = skillQ.trim().toLowerCase();
  const pool = o.stacks.filter((s) => !p.stack_ids.includes(s.id) && s.name.toLowerCase().includes(needle));

  async function save() {
    if (!p) return;
    setBusy(true);
    setMsg(null);
    try {
      await api("/api/profile", { method: "PUT", body: { ...p, state: p.state, salary_expectation: p.salary_expectation === "" ? null : p.salary_expectation } });
      setFirstPage(null);
      setMsg({ ok: true, text: "Perfil salvo" });
    } catch (e) {
      setMsg({ ok: false, text: errMsg(e) });
    } finally {
      setBusy(false);
    }
  }

  async function onPdf(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUpload({ busy: true, err: "" });
    try {
      const form = new FormData();
      form.append("file", file);
      const r = await api<Profile>("/api/profile/resume", { form });
      setP((cur) => (cur ? { ...cur, resume_text: r.resume_text } : cur));
      setUpload({ busy: false, err: "" });
    } catch (x) {
      setUpload({ busy: false, err: errMsg(x) });
    }
  }

  return (
    <section className="screen">
      <h1>Perfil</h1>
      <p className="sub">É daqui que sai o filtro e o ranking das vagas.</p>
      <div className="form">
        <Toggles label="Áreas" options={o.areas} value={p.areas} onChange={(v) => set("areas", v)} />
        <Toggles label="Nível" options={o.levels} value={p.levels} onChange={(v) => set("levels", v)} />
        <Toggles label="Modelo de trabalho" options={o.work_models} value={p.work_models} onChange={(v) => set("work_models", v)} />
        <div className="f">
          <span className="lbl">Local</span>
          <div style={{ display: "grid", gridTemplateColumns: "90px 1fr", gap: 8 }}>
            <select className="in" aria-label="UF" value={p.state} onChange={(e) => set("state", e.target.value)}>
              <option value="">UF</option>
              {o.states.map((s) => <option key={s}>{s}</option>)}
            </select>
            <input className="in" aria-label="Cidade" placeholder="Cidade" maxLength={100} value={p.city} onChange={(e) => set("city", e.target.value)} />
          </div>
          <p className="small">Vaga remota ignora o local.</p>
        </div>
        <div className="f">
          <label className="lbl" htmlFor="sal">Bolsa ou salário esperado (R$)</label>
          <input id="sal" className="in num" type="number" min={0} max={100000} step={50} value={p.salary_expectation ?? ""} onChange={(e) => set("salary_expectation", e.target.value)} />
        </div>

        <div className="f wide">
          <label className="lbl" htmlFor="sk">Skills</label>
          <div className="tog" aria-label="Skills marcadas">
            {chosen.map((id) => (
              <button key={id} type="button" aria-pressed="true" onClick={() => set("stack_ids", p.stack_ids.filter((x) => x !== id))}>{skills.get(id)}</button>
            ))}
            {!chosen.length && <span className="small">Nenhuma skill marcada.</span>}
          </div>
          <input id="sk" className="in" type="search" placeholder="Buscar no catálogo (Python, SQL, Docker...)" value={skillQ} onChange={(e) => setSkillQ(e.target.value)} style={{ marginTop: 12 }} />
          <div className="tog" style={{ marginTop: 8 }}>
            {pool.slice(0, MAX_VISIBLE).map((s) => (
              <button key={s.id} type="button" aria-pressed="false" onClick={() => set("stack_ids", [...p.stack_ids, s.id])}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg> {s.name}</button>
            ))}
          </div>
          {pool.length > MAX_VISIBLE && <p className="small">Mostrando {MAX_VISIBLE} de {pool.length}. Digite para filtrar.</p>}
          {!pool.length && needle && <p className="small">Nenhuma skill com “{skillQ}” no catálogo.</p>}
        </div>

        <div className="drop">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5M4 20h16" /></svg>
          <div style={{ flex: 1 }}>
            <b>Currículo em PDF</b><br />Guardamos só o texto. Ele vai ao Gemini apenas quando você clicar em Analisar.
            <div style={{ marginTop: 10 }}>
              <label className="btn" style={{ cursor: "pointer" }}>
                {upload.busy ? "Lendo o PDF..." : "Enviar PDF"}
                <input type="file" accept="application/pdf" className="sr" onChange={onPdf} disabled={upload.busy} />
              </label>
              {upload.err && <p className="msg bad" role="alert">{upload.err}</p>}
            </div>
          </div>
        </div>
        <div className="f wide">
          <label className="lbl" htmlFor="resume">Texto do currículo</label>
          <textarea id="resume" className="in" rows={10} maxLength={50000} value={p.resume_text} onChange={(e) => set("resume_text", e.target.value)} placeholder="Cole aqui ou envie o PDF acima. Você pode editar o texto." />
        </div>

        <div className="wide savebar">
          <button className="btn pri" onClick={save} disabled={busy}>{busy ? "Salvando..." : "Salvar perfil"}</button>
          {msg && <span className={`msg ${msg.ok ? "ok" : "bad"}`} role="status">{msg.text}</span>}
        </div>
      </div>
      <Account />
    </section>
  );
}

function Account() {
  const router = useRouter();
  const { data } = useFetch<{ email: string }>("/api/auth/me");
  const [del, setDel] = useState(false);
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function logout() {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    setFirstPage(null);
    router.push("/entrar");
  }

  async function remove() {
    setBusy(true);
    setErr("");
    try {
      await api("/api/auth/delete", { body: { password: pw } });
      setFirstPage(null);
      router.push("/entrar");
    } catch (e) {
      setErr(errMsg(e));
      setBusy(false);
    }
  }

  return (
    <div className="account">
      <h2 className="h2">Conta</h2>
      <p>{data?.email ?? "..."}</p>
      <div className="row">
        <button className="btn" onClick={logout}>Sair</button>
        <button className="btn danger" onClick={() => { setDel(true); setPw(""); setErr(""); }}>Excluir conta</button>
      </div>
      {del && (
        <Modal label="Excluir conta" onClose={() => setDel(false)}>
          <h2 className="dt">Excluir conta</h2>
          <p className="warn">Isto apaga tudo: perfil, currículo, candidaturas e análises. Não tem volta.</p>
          <form onSubmit={(e) => { e.preventDefault(); remove(); }}>
            <div className="f">
              <label htmlFor="delpw">Confirme com sua senha</label>
              <input id="delpw" className="in" type="password" autoComplete="current-password" required value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
            </div>
            {err && <p className="msg bad" role="alert">{err}</p>}
            <div className="dfoot">
              <button className="btn danger" disabled={busy || !pw}>{busy ? "Excluindo..." : "Excluir tudo"}</button>
              <button type="button" className="btn" onClick={() => setDel(false)}>Cancelar</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
