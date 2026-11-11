"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  api, errMsg, LEVEL_LABEL, LEVEL_LETTER, STATUS_LABEL, WORK_LABEL, type Job, type JobDetail,
} from "./api";

export function Mark({ size = 40 }: { size?: number }) {
  return (
    <svg viewBox="0 0 120 100" width={size} height={size * 0.85} aria-hidden="true" fill="currentColor">
      <path d="M2 49 L32 38 L118 21 L110 35 L30 50 Z" />
      <path d="M33 46 L46 43 L44 80 C43 92 35 97 23 97 L2 99 L14 89 L24 88 C31 88 33 85 33 79 Z" />
      <path d="M63 19 L75 9 L73 83 L61 93 Z" />
      <path d="M98 9 L111 0 L109 76 L97 85 Z" />
    </svg>
  );
}

const initials = (c: string) =>
  c.split(/[^\p{L}\p{N}]+/u).filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

export function Logo({ company, src, size }: { company: string; src?: string; size?: number }) {
  const [broken, setBroken] = useState(false);
  const style = size ? { width: size, height: size } : undefined;
  return (
    <span className="logo" aria-hidden="true" style={style}>
      {src && !broken ? <img src={src} alt="" loading="lazy" onError={() => setBroken(true)} /> : initials(company)}
    </span>
  );
}

export function Tyre({ level }: { level: string }) {
  const l = LEVEL_LETTER[level] ?? "?";
  return <span className={`tyre ${l}`} title={LEVEL_LABEL[level]}>{l}</span>;
}

export const brl = (v: string | number | null | undefined) =>
  v == null || v === "" ? "" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "");

/** "fecha em N dias" when the deadline is within 14 days; nothing otherwise. */
export function DeadlineTag({ iso }: { iso: string | null }) {
  if (!iso) return null;
  const d = Math.ceil((new Date(iso.length === 10 ? iso + "T23:59:59" : iso).getTime() - Date.now()) / 86400000);
  if (d < 0 || d > 14) return null;
  return <span className="due" title={`Prazo: ${day(iso)}`}>{d === 0 ? "fecha hoje" : d === 1 ? "fecha amanhã" : `fecha em ${d} dias`}</span>;
}

export function ago(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });
  if (s < 3600) return rtf.format(-Math.max(1, Math.round(s / 60)), "minute");
  if (s < 86400) return rtf.format(-Math.round(s / 3600), "hour");
  return rtf.format(-Math.round(s / 86400), "day");
}

export const where = (j: Job) =>
  [WORK_LABEL[j.work_model], j.work_model === "REMOTE" ? "" : j.state || j.city].filter(Boolean).join(" · ") || "Local não informado";

export function useMedia(query: string) {
  const [m, setM] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const f = () => setM(mq.matches);
    f();
    mq.addEventListener("change", f);
    return () => mq.removeEventListener("change", f);
  }, [query]);
  return m;
}

type State<T> = { data?: T; error?: string; loading: boolean };

/** GET on mount / path change. `seed` skips the first request (data we already hold). */
export function useFetch<T>(path: string | null, seed?: T) {
  const [st, setSt] = useState<State<T>>({ data: seed, loading: !seed });
  const [n, setN] = useState(0);
  const skip = useRef(!!seed);
  useEffect(() => {
    if (path === null) return;
    if (skip.current) {
      skip.current = false;
      return;
    }
    let live = true;
    setSt((s) => ({ data: s.data, loading: true }));
    api<T>(path).then(
      (data) => live && setSt({ data, loading: false }),
      (e) => live && setSt({ error: errMsg(e), loading: false }),
    );
    return () => {
      live = false;
    };
  }, [path, n]);
  const reload = useCallback(() => setN((x) => x + 1), []);
  const mutate = useCallback((fn: (d: T) => T) => setSt((s) => (s.data ? { ...s, data: fn(s.data) } : s)), []);
  return { ...st, reload, mutate };
}

export function ErrorBox({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div className="err" role="alert">
      <span>{message}</span>
      {retry && <button className="btn" onClick={retry}>Tentar de novo</button>}
    </div>
  );
}

export function Modal({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-label={label}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && ref.current?.close()}
    >
      <div className="dlg">{children}</div>
    </dialog>
  );
}

function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div className="bar">
      <span>{label}</span>
      <span className="tr"><i style={{ width: `${(value / max) * 100}%`, background: color }} /></span>
      <span className="v">{value}/{max}</span>
    </div>
  );
}

/** Side panel / detail header: why the job scored what it scored. */
export function Telemetry({
  job, best, onSave, saving, error, children,
}: {
  job: Job | JobDetail; best?: boolean; onSave: () => void; saving: boolean; error?: string; children?: ReactNode;
}) {
  const { why } = job;
  return (
    <>
      <div className="hd">
        <div className="co"><Logo company={job.company} src={job.company_logo} /><span>{job.company}</span></div>
        <h2 className="ti">{job.title}</h2>
        <div className="meta">
          <span>{where(job)}</span>
          <span>{LEVEL_LABEL[job.level]}</span>
          <span>{job.salary ? brl(job.salary) : "Bolsa não informada"}</span>
          <DeadlineTag iso={job.deadline} />
        </div>
        <div className="score">
          <span className="big num" style={{ color: best ? "var(--purple)" : undefined }}>{job.score}</span>
          <small>pontos de 100</small>
        </div>
      </div>
      <div className="blk">
        <h3 className="h2">Telemetria do score</h3>
        <Bar label="Skills" value={why.skills_points} max={85} color="var(--green)" />
        <Bar label="Salário" value={why.salary_points} max={15} color="var(--white)" />
        <p className="small">{job.stacks.length ? why.salary : `Sem skills identificadas na vaga (neutro). ${why.salary}`}</p>
      </div>
      <div className="blk">
        <h3 className="h2">Você tem</h3>
        <div className="chips">
          {why.matched.length ? why.matched.map((s) => <span key={s} className="chip ok">{s}</span>) : <span className="small">Nenhuma ainda.</span>}
        </div>
        <h3 className="h2" style={{ marginTop: 14 }}>Falta</h3>
        <div className="chips">
          {why.missing.length ? why.missing.map((s) => <span key={s} className="chip no">{s}</span>) : <span className="small">Nada. Você cobre a vaga.</span>}
        </div>
      </div>
      {children}
      <div className="ft">
        {job.application_id ? (
          <Link className="btn" href="/corrida">
            Na corrida: {STATUS_LABEL[job.application_status ?? "SAVED"]}
          </Link>
        ) : (
          <button className="btn pri" onClick={onSave} disabled={saving}>{saving ? "Salvando..." : "Salvar na corrida"}</button>
        )}
        <a className="btn" href={job.url} target="_blank" rel="noopener noreferrer">Ver vaga original</a>
      </div>
      {error && <p className="msg bad" role="alert" style={{ padding: "0 18px 14px" }}>{error}</p>}
    </>
  );
}

/** POST /applications {job_id} with local saving/error state. */
export function useSaveJob(onSaved: (jobId: number, appId: number, status: string) => void) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const save = async (jobId: number) => {
    setSaving(true);
    setError("");
    try {
      const a = await api<{ id: number; status: string }>("/api/applications", { body: { job_id: jobId } });
      onSaved(jobId, a.id, a.status);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setSaving(false);
    }
  };
  return { saving, error, save };
}
