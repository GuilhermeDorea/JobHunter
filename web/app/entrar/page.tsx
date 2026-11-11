"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api, errMsg, setFirstPage } from "@/lib/api";
import { Mark } from "@/lib/ui";

export default function Entrar() {
  const router = useRouter();
  const [signup, setSignup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setErr("");
    try {
      await api(signup ? "/api/auth/signup" : "/api/auth/login", { body: { email: f.get("email"), password: f.get("password") } });
      setFirstPage(null);
      router.push(signup ? "/perfil" : "/");
    } catch (x) {
      setErr(errMsg(x));
      setBusy(false);
    }
  }

  return (
    <main className="auth">
      <div className="authlogo"><Mark size={120} /></div>
      <h1>JobHunter</h1>
      <p className="sub">Vagas de estágio, trainee e júnior, ranqueadas pelo seu perfil.</p>
      <form className="authform" onSubmit={submit}>
        <h2 className="h2">{signup ? "Criar conta" : "Entrar"}</h2>
        <div className="f">
          <label htmlFor="email">E-mail</label>
          <input id="email" name="email" className="in" type="email" autoComplete="email" required maxLength={254} />
        </div>
        <div className="f">
          <label htmlFor="password">Senha</label>
          <input id="password" name="password" className="in" type="password" autoComplete={signup ? "new-password" : "current-password"} required minLength={signup ? 8 : undefined} />
          {signup && <p className="small">Mínimo de 8 caracteres, nada óbvio demais.</p>}
        </div>
        {err && <p className="msg bad" role="alert">{err}</p>}
        <button className="btn pri wide-btn" disabled={busy}>{busy ? "Aguarde..." : signup ? "Criar conta" : "Entrar"}</button>
        <button type="button" className="linkbtn" onClick={() => { setSignup(!signup); setErr(""); }}>
          {signup ? "Já tenho conta" : "Ainda não tenho conta"}
        </button>
        <p className="small">Ao continuar você concorda com o que está na <Link href="/privacidade">política de privacidade</Link>.</p>
      </form>
    </main>
  );
}
