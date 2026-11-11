"use client";

import Link from "next/link";
import { useState } from "react";
import { api, errMsg, setFirstPage, type Profile } from "@/lib/api";
import { ErrorBox, useFetch } from "@/lib/ui";

type Radar = { total_jobs: number; stacks: { id: number; name: string; jobs: number }[] };

export default function RadarPage() {
  const { data, error, loading, reload, mutate } = useFetch<Radar>("/api/radar?limit=15");
  const [busy, setBusy] = useState<number | null>(null);
  const [err, setErr] = useState("");

  async function know(id: number) {
    setBusy(id);
    setErr("");
    try {
      const p = await api<Profile>("/api/profile");
      await api("/api/profile", { method: "PUT", body: { ...p, stack_ids: [...new Set([...p.stack_ids, id])] } });
      setFirstPage(null);
      mutate((d) => ({ ...d, stacks: d.stacks.filter((s) => s.id !== id) }));
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy(null);
    }
  }

  const top = data?.stacks[0];
  const max = top?.jobs ?? 1;

  return (
    <section className="screen">
      <h1>Radar de skills</h1>
      <p className="sub">O que as vagas do seu grid mais pedem e você ainda não marcou.</p>
      {error && <ErrorBox message={error} retry={reload} />}
      {err && <p className="msg bad" role="alert">{err}</p>}
      {loading && !data && <div className="rad" aria-busy="true"><div>{Array.from({ length: 6 }, (_, i) => <div key={i} className="rrow sk" />)}</div></div>}
      {data && !data.stacks.length && (
        <div className="empty big">
          {data.total_jobs ? "Você já marcou todas as skills que as vagas do grid pedem." : <>Nenhuma vaga no grid ainda. <Link href="/perfil">Ajuste o perfil</Link>.</>}
        </div>
      )}
      {data && top && (
        <div className="rad">
          <ol className="rlist">
            {data.stacks.map((s, i) => (
              <li key={s.id} className="rrow">
                <span className="pos num">{i + 1}</span>
                <span className="nm">{s.name}</span>
                <span className="tr"><i style={{ width: `${(s.jobs / max) * 100}%` }} /></span>
                <span className="v num">{s.jobs}</span>
                <button className="btn" onClick={() => know(s.id)} disabled={busy === s.id} aria-label={`Eu sei ${s.name}`}>{busy === s.id ? "..." : "Eu sei"}</button>
              </li>
            ))}
          </ol>
          <div className="note">
            <b>{top.name} aparece em {top.jobs} das {data.total_jobs} vagas.</b> Marcar uma skill que você já sabe sobe o seu score nessas vagas na hora.
          </div>
        </div>
      )}
    </section>
  );
}
