"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { getFirstPage, PAGE_SIZE, setFirstPage, type Job, type JobPage, type Profile } from "@/lib/api";
import { ErrorBox, Logo, Telemetry, Tyre, useFetch, useMedia, useSaveJob, where } from "@/lib/ui";

export default function Vagas() {
  return (
    <Suspense>
      <Tower />
    </Suspense>
  );
}

function Tower() {
  const params = useSearchParams();
  const page = Math.max(1, Number(params.get("page")) || 1);
  const q = params.get("q") ?? "";
  // key: switching page or query remounts, so we never show the previous page under the new one.
  return <Page key={`${page}|${q}`} page={page} q={q} />;
}

function Page({ page, q }: { page: number; q: string }) {
  const router = useRouter();
  const narrow = useMedia("(max-width:1100px)");
  const isFirst = page === 1 && !q;
  const cached = isFirst ? getFirstPage() : null;
  const jobs = useFetch<JobPage>(`/api/jobs?page=${page}${q ? `&q=${encodeURIComponent(q)}` : ""}`, cached ?? undefined);
  const profile = useFetch<Profile>("/api/profile");
  const [selId, setSelId] = useState<number | null>(null);
  const { saving, error, save } = useSaveJob((jobId, appId, status) =>
    jobs.mutate((d) => ({
      ...d,
      items: d.items.map((j) => (j.id === jobId ? { ...j, application_id: appId, application_status: status } : j)),
    })),
  );

  const data = jobs.data;
  useEffect(() => {
    if (isFirst && data) setFirstPage(data);
  }, [isFirst, data]);

  const go = (p: number) => router.push(`/?${new URLSearchParams({ ...(q && { q }), ...(p > 1 && { page: String(p) }) })}`);
  const emptyProfile = profile.data && !profile.data.areas.length && !profile.data.levels.length;
  const sel = data?.items.find((j) => j.id === selId) ?? data?.items[0];
  const from = (page - 1) * PAGE_SIZE;

  return (
    <>
      {data && data.new_count > 0 && page === 1 && (
        <div className="rc" role="status">
          <span className="flag" />
          <div>
            <div className="t">Controle de prova</div>
            <div className="m"><b className="num">{data.new_count}</b> {data.new_count === 1 ? "vaga nova desde" : "vagas novas desde"} sua última visita.</div>
          </div>
        </div>
      )}
      {emptyProfile && (
        <div className="rc" role="status">
          <span className="flag" />
          <div>
            <div className="t">Grid vazio</div>
            <div className="m">Seu perfil não tem áreas nem níveis. <Link href="/perfil">Monte o perfil</Link> para filtrar e ranquear as vagas.</div>
          </div>
        </div>
      )}
      <section className="screen">
        <div className="grid">
          <div>
            <h1>Classificação</h1>
            <p className="sub">
              {data ? <><b className="num" style={{ color: "var(--tx)" }}>{data.count}</b> vagas no seu grid{q && <> para “{q}”</>}, ordenadas pelo quanto batem com seu perfil.</> : "Carregando o grid..."}
            </p>

            {jobs.error && !data && <ErrorBox message={jobs.error} retry={jobs.reload} />}
            {jobs.loading && !data && (
              <ol className="tower" aria-busy="true" aria-label="Carregando vagas">
                {Array.from({ length: 8 }, (_, i) => <li key={i} className="r sk" />)}
              </ol>
            )}
            {data && data.items.length === 0 && (
              <div className="empty big">
                {q ? <>Nenhuma vaga para “{q}”.</> : emptyProfile ? <>Nada no grid ainda. <Link href="/perfil">Complete o perfil</Link>.</> : <>Nenhuma vaga bate com seus filtros agora. Ajuste o <Link href="/perfil">perfil</Link> ou volte amanhã.</>}
              </div>
            )}
            {data && data.items.length > 0 && (
              <>
                <ol className="tower" role="listbox" aria-label="Vagas">
                  {data.items.map((j, i) => {
                    const best = isFirst && i === 0;
                    const open = () => (narrow ? router.push(`/vagas/${j.id}`) : setSelId(j.id));
                    return (
                      <li
                        key={j.id}
                        className={`r${j.is_new ? " fresh" : ""}`}
                        role="option"
                        tabIndex={0}
                        aria-selected={!narrow && sel?.id === j.id}
                        style={{ animationDelay: `${i * 40}ms` }}
                        onClick={open}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            open();
                          }
                        }}
                      >
                        <span className="pos num">{from + i + 1}</span>
                        <Logo company={j.company} src={j.company_logo} />
                        <span className="who">
                          <div className="ti">{j.title}{j.is_new && <span className="new">Nova</span>}</div>
                          <div className="co">{j.company} · {where(j)}</div>
                          <Sectors j={j} best={best} mobile />
                        </span>
                        <Tyre level={j.level} />
                        <Sectors j={j} best={best} />
                        <span className={`pts num${best ? " best" : ""}`}>{j.score}</span>
                      </li>
                    );
                  })}
                </ol>
                <div className="pager">
                  <span>Vagas {from + 1}–{from + data.items.length} de {data.count}</span>
                  <span style={{ display: "flex", gap: 8 }}>
                    {page > 1 && <button className="btn" onClick={() => go(page - 1)}>Anteriores</button>}
                    {page < data.pages && <button className="btn" onClick={() => go(page + 1)}>Próximas {PAGE_SIZE}</button>}
                  </span>
                </div>
              </>
            )}
          </div>
          {!narrow && sel && (
            <aside className="tele" aria-live="polite" aria-label="Telemetria da vaga">
              <Telemetry job={sel} best={isFirst && sel.id === data?.items[0].id} saving={saving} error={error} onSave={() => save(sel.id)} />
            </aside>
          )}
        </div>
      </section>
    </>
  );
}

function Sectors({ j, best, mobile }: { j: Job; best: boolean; mobile?: boolean }) {
  const none = j.why.matched.length + j.why.missing.length === 0;
  return (
    <span className={`sectors${mobile ? " msec" : ""}${none ? " none" : ""}`} aria-hidden={mobile || undefined}
      title={none ? "Nenhuma skill identificada na vaga" : `${j.why.matched.length} de ${j.stacks.length} skills`}>
      {none ? [0, 1, 2, 3, 4].map((k) => <i key={k} />) : <>
        {j.why.matched.map((s) => <i key={s} className={best ? "p" : "g"} />)}
        {j.why.missing.map((s) => <i key={s} />)}
      </>}
    </span>
  );
}
