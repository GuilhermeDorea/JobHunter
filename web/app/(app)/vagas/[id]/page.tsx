"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { setFirstPage, type JobDetail } from "@/lib/api";
import { day, ErrorBox, Telemetry, useFetch, useSaveJob } from "@/lib/ui";

export default function VagaDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: job, error, loading, reload, mutate } = useFetch<JobDetail>(`/api/jobs/${id}`);
  const { saving, error: saveError, save } = useSaveJob((_j, appId, status) => {
    setFirstPage(null); // the cached ranking no longer knows this job's card
    mutate((d) => ({ ...d, application_id: appId, application_status: status }));
  });

  return (
    <section className="screen">
      <Link className="back" href="/"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg> Classificação</Link>
      {error && <ErrorBox message={error} retry={reload} />}
      {loading && !job && <div className="tele sk-box" aria-busy="true" />}
      {job && (
        <div className="detail">
          <div className="tele flat">
            <Telemetry job={job} saving={saving} error={saveError} onSave={() => save(job.id)}>
              <div className="blk">
                <dl className="facts">
                  <div><dt>Publicada</dt><dd>{day(job.published_at) || "não informado"}</dd></div>
                  <div><dt>Prazo</dt><dd>{day(job.deadline) || "sem prazo"}</dd></div>
                  <div><dt>Fonte</dt><dd>{job.source}</dd></div>
                </dl>
              </div>
            </Telemetry>
          </div>
          <article className="desc">
            <h2 className="h2">Descrição</h2>
            <p>{job.description || "A fonte não trouxe descrição. Abra a vaga original."}</p>
          </article>
        </div>
      )}
    </section>
  );
}
