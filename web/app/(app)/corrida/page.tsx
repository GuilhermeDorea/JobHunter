"use client";

import Link from "next/link";
import { useState, type DragEvent, type FormEvent } from "react";
import Markdown from "react-markdown";
import {
  api, errMsg, FINAL, PIPELINE, STATUS_CLASS, STATUS_LABEL, type Analysis, type Application,
} from "@/lib/api";
import { ago, brl, ErrorBox, Logo, Modal, useFetch } from "@/lib/ui";

const stageIndex = (a: Application) => {
  const s = a.status === "REJECTED" ? a.rejected_at_stage : a.status;
  return Math.max(0, (PIPELINE as readonly string[]).indexOf(s));
};

export default function Corrida() {
  const { data, error, loading, reload, mutate } = useFetch<Application[]>("/api/applications");
  const [openId, setOpenId] = useState<number | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [moveError, setMoveError] = useState("");

  const replace = (a: Application) => mutate((d) => d.map((x) => (x.id === a.id ? a : x)));

  async function move(id: number, status: string) {
    const prev = data?.find((a) => a.id === id);
    if (!prev || prev.status === status) return;
    setMoveError("");
    replace({
      ...prev, status,
      rejected_at_stage: status === "REJECTED" ? prev.status : prev.rejected_at_stage,
    });
    try {
      replace(await api<Application>(`/api/applications/${id}`, { method: "PATCH", body: { status } }));
    } catch (e) {
      replace(prev);
      setMoveError(errMsg(e));
    }
  }

  const onDrop = (e: DragEvent, status: string) => {
    e.preventDefault();
    setDragOver(null);
    const id = Number(e.dataTransfer.getData("text/plain"));
    if (id) move(id, status);
  };

  const column = (status: string, cls = "") => {
    const cards = (data ?? []).filter((a) => a.status === status);
    return (
      <div
        key={status}
        className={`col ${STATUS_CLASS[status]} ${cls}${dragOver === status ? " over" : ""}`}
        role="group"
        aria-label={STATUS_LABEL[status]}
        onDragOver={(e) => { e.preventDefault(); setDragOver(status); }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null); }}
        onDrop={(e) => onDrop(e, status)}
      >
        <h3>
          <span className="nm">{STATUS_LABEL[status]}</span>
          <span className="right">
            <button className="add" aria-label={`Novo card em ${STATUS_LABEL[status]}`} onClick={() => setAdding(status)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
            </button>
            <span className="n num">{cards.length}</span>
          </span>
        </h3>
        <div className="cards">
          {adding === status && <NewCard status={status} onCancel={() => setAdding(null)} onCreated={(a) => { mutate((d) => [a, ...d]); setAdding(null); }} />}
          {cards.map((a) => <Card key={a.id} a={a} open={() => setOpenId(a.id)} />)}
          {!cards.length && adding !== status && status !== "REJECTED" && status !== "WITHDRAWN" && (
            <div className="empty">{status === "OFFER" ? "Sua primeira oferta chega aqui." : "Arraste um card para cá."}</div>
          )}
        </div>
      </div>
    );
  };

  const open = data?.find((a) => a.id === openId);

  return (
    <section className="screen">
      <h1>Sua corrida</h1>
      <p className="sub">Arraste o card quando o processo avançar, ou abra-o para mudar a etapa. Reprovou? Ele vai para os abandonos e você pode pedir uma análise.</p>
      {error && !data && <ErrorBox message={error} retry={reload} />}
      {moveError && <p className="msg bad" role="alert">{moveError}</p>}
      {loading && !data && (
        <div className="board" aria-busy="true">
          {PIPELINE.map((s) => <div key={s} className={`col sk-box ${STATUS_CLASS[s]}`} />)}
        </div>
      )}
      {data && (
        <>
          {data.length === 0 && (
            <div className="empty big">Nenhuma candidatura ainda. Salve vagas pela <Link href="/">classificação</Link> ou use o + de uma coluna para criar um card.</div>
          )}
          <div className="board">{PIPELINE.map((s) => column(s))}</div>
          <div className="dnf">{FINAL.map((s) => column(s))}</div>
        </>
      )}
      {open && (
        <Detail
          key={open.id}
          a={open}
          onClose={() => setOpenId(null)}
          onChange={replace}
          onDeleted={() => { mutate((d) => d.filter((x) => x.id !== open.id)); setOpenId(null); }}
        />
      )}
    </section>
  );
}

function Card({ a, open }: { a: Application; open: () => void }) {
  const idx = stageIndex(a);
  return (
    <article
      className="card"
      draggable
      onDragStart={(e) => { e.dataTransfer.setData("text/plain", String(a.id)); e.dataTransfer.effectAllowed = "move"; }}
    >
      <div className="prog" aria-hidden="true">
        {PIPELINE.map((s, k) => <i key={s} className={k <= idx ? "on" : ""} />)}
      </div>
      <button className="hd open" onClick={open} aria-label={`Abrir ${a.title}, ${a.company}`}>
        <Logo company={a.company} src={a.company_logo} size={30} />
        <span style={{ minWidth: 0 }}>
          <span className="ti">{a.title}</span>
          <span className="co">{a.company}</span>
        </span>
      </button>
      <div className="ln">
        <span>{ago(a.updated_at)}{a.job_closed && <span className="closed"> · vaga encerrada</span>}</span>
        {a.status === "REJECTED" && (
          <>
            <span className="rej"><i />{a.rejected_at_stage ? `caiu em ${STATUS_LABEL[a.rejected_at_stage]}` : "reprovada"}</span>
            <button className={`ana${a.analysis ? " done" : ""}`} onClick={open}>{a.analysis ? "Ver análise" : "Analisar com IA"}</button>
          </>
        )}
      </div>
    </article>
  );
}

function NewCard({ status, onCancel, onCreated }: { status: string; onCancel: () => void; onCreated: (a: Application) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    let url = String(f.get("url") ?? "").trim();
    if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`;
    setBusy(true);
    setErr("");
    try {
      onCreated(await api<Application>("/api/applications", {
        body: { title: String(f.get("title")).trim(), company: String(f.get("company")).trim(), url: url || null, status },
      }));
    } catch (x) {
      setErr(errMsg(x));
      setBusy(false);
    }
  }

  return (
    <form className="card newcard" onSubmit={submit} onKeyDown={(e) => e.key === "Escape" && onCancel()}>
      <label>Título<input className="in" name="title" required maxLength={300} autoFocus /></label>
      <label>Empresa<input className="in" name="company" required maxLength={200} /></label>
      <label>Link (opcional)<input className="in" name="url" inputMode="url" placeholder="https://" /></label>
      {err && <p className="msg bad" role="alert">{err}</p>}
      <div className="row">
        <button className="btn pri" disabled={busy}>{busy ? "Salvando..." : "Salvar"}</button>
        <button type="button" className="btn" onClick={onCancel}>Cancelar</button>
      </div>
    </form>
  );
}

function Detail({ a, onClose, onChange, onDeleted }: {
  a: Application; onClose: () => void; onChange: (a: Application) => void; onDeleted: () => void;
}) {
  const [status, setStatus] = useState(a.status);
  const [notes, setNotes] = useState(a.notes);
  const [salary, setSalary] = useState(a.salary == null ? "" : String(Number(a.salary)));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [anaErr, setAnaErr] = useState("");

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      onChange(await api<Application>(`/api/applications/${a.id}`, {
        method: "PATCH", body: { status, notes, salary: salary === "" ? null : Number(salary) },
      }));
      setMsg({ ok: true, text: "Salvo" });
    } catch (e) {
      setMsg({ ok: false, text: errMsg(e) });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Excluir o card “${a.title}”? Isso não tem volta.`)) return;
    try {
      await api(`/api/applications/${a.id}`, { method: "DELETE" });
      onDeleted();
    } catch (e) {
      setMsg({ ok: false, text: errMsg(e) });
    }
  }

  async function analyze() {
    setAnalyzing(true);
    setAnaErr("");
    try {
      const analysis = await api<Analysis>(`/api/applications/${a.id}/analyze`, { method: "POST" });
      onChange({ ...a, analysis });
    } catch (e) {
      setAnaErr(errMsg(e));
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <Modal label={`Detalhes de ${a.title}`} onClose={onClose}>
      <div className={`dh ${STATUS_CLASS[a.status]}`}>
        <Logo company={a.company} src={a.company_logo} />
        <div style={{ minWidth: 0 }}>
          <h2 className="dt">{a.title}</h2>
          <div className="small">{a.company}{a.job_closed && " · vaga encerrada"}</div>
        </div>
      </div>
      <div className="dlinks">
        {a.job_id && <Link href={`/vagas/${a.job_id}`}>Ver vaga na classificação</Link>}
        {a.url && <a href={a.url} target="_blank" rel="noopener noreferrer">Abrir link da vaga</a>}
      </div>
      <div className="f">
        <label htmlFor="d-status">Etapa</label>
        <select id="d-status" className="in" value={status} onChange={(e) => setStatus(e.target.value)}>
          {[...PIPELINE, ...FINAL].map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
      </div>
      <div className="f">
        <label htmlFor="d-salary">Bolsa ou salário (R$)</label>
        <input id="d-salary" className="in num" type="number" min={0} max={100000} step={50} value={salary} onChange={(e) => setSalary(e.target.value)} placeholder={a.salary == null ? "não informado" : brl(a.salary)} />
      </div>
      <div className="f">
        <label htmlFor="d-notes">Anotações</label>
        <textarea id="d-notes" className="in" rows={5} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Datas, nomes, o que perguntaram, o que errou." />
      </div>

      {a.status === "REJECTED" && (
        <div className="ana-box">
          <h3 className="h2">Análise com IA</h3>
          {a.analysis ? (
            <div className="md"><Markdown>{a.analysis.text}</Markdown></div>
          ) : (
            <p className="small">O Gemini lê a vaga, suas anotações e seu currículo e aponta o que provavelmente pesou. Só roda quando você clica.</p>
          )}
          <button className="btn" onClick={analyze} disabled={analyzing} style={{ marginTop: 10 }}>
            {analyzing ? "Analisando, pode levar alguns segundos..." : a.analysis ? "Analisar de novo" : "Analisar com IA"}
          </button>
          {anaErr && <p className="msg bad" role="alert">{anaErr}</p>}
        </div>
      )}

      <div className="dfoot">
        <button className="btn pri" onClick={save} disabled={busy}>{busy ? "Salvando..." : "Salvar"}</button>
        <button className="btn" onClick={onClose}>Fechar</button>
        <button className="btn danger" onClick={remove}>Excluir</button>
        {msg && <span className={`msg ${msg.ok ? "ok" : "bad"}`} role="status">{msg.text}</span>}
      </div>
    </Modal>
  );
}
