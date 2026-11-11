"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import { Mark } from "@/lib/ui";

const TABS = [
  { href: "/", label: "Vagas" },
  { href: "/corrida", label: "Corrida" },
  { href: "/radar", label: "Radar" },
  { href: "/curriculo", label: "Currículo" },
  { href: "/perfil", label: "Perfil" },
];

export default function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const urlQ = useSearchParams().get("q") ?? "";
  const [q, setQ] = useState(urlQ);
  const [email, setEmail] = useState("");
  const onHome = path === "/";

  useEffect(() => {
    api<{ email: string }>("/api/auth/me").then((m) => setEmail(m.email), () => {});
  }, []);
  useEffect(() => setQ(urlQ), [urlQ]);
  useEffect(() => {
    if (!onHome || q === urlQ) return;
    const t = setTimeout(() => router.replace(q ? `/?q=${encodeURIComponent(q)}` : "/"), 300);
    return () => clearTimeout(t);
  }, [q, urlQ, onHome, router]);

  const active = (href: string) => (href === "/" ? path === "/" || path.startsWith("/vagas") : path.startsWith(href));

  return (
    <>
      <header className="top">
        <Link className="brand" href="/" aria-label="JobHunter, início">
          <Mark />
          <span>JobHunter</span>
        </Link>
        <nav className="tabs" aria-label="Principal">
          {TABS.map((t) => (
            <Link key={t.href} className="tab" href={t.href} aria-current={active(t.href) ? "page" : undefined}>
              {t.label}
            </Link>
          ))}
        </nav>
        {onHome && (
          <label className="search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
            <span className="sr">Buscar cargo ou empresa</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cargo ou empresa" type="search" />
          </label>
        )}
        <Link className="me" href="/perfil" title={email} aria-label={`Conta ${email}`}>{email.slice(0, 2).toUpperCase() || "··"}</Link>
      </header>
      <main>{children}</main>
    </>
  );
}
