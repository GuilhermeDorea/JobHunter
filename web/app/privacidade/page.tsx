import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Privacidade" };

export default function Privacidade() {
  return (
    <main className="prose">
      <Link className="back" href="/"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg> JobHunter</Link>
      <h1>Privacidade</h1>
      <h2 className="h2">O que guardamos</h2>
      <p>Seu e-mail e senha (a senha fica protegida por hash, ninguém a lê), o perfil que você preenche (áreas, níveis, local, modelos de trabalho, salário esperado e skills), as candidaturas do seu kanban com suas anotações e as análises que você pediu.</p>
      <h2 className="h2">Currículo</h2>
      <p>Quando você envia um PDF, extraímos o texto e guardamos só o texto. O arquivo não é armazenado. Você pode ver e editar esse texto no perfil.</p>
      <h2 className="h2">Inteligência artificial (Gemini)</h2>
      <p>O currículo, a descrição da vaga e suas anotações só vão para o Gemini, do Google, quando você clica em “Analisar” numa candidatura reprovada. Nunca antes, nunca automaticamente. No plano gratuito do Gemini, o Google pode usar o conteúdo enviado para melhorar seus produtos. Se isso não serve para você, não use o botão Analisar e não cole dados sensíveis no currículo.</p>
      <h2 className="h2">Vagas</h2>
      <p>As vagas vêm de páginas públicas de fontes como Gupy e repositórios abertos. Não vendemos nem compartilhamos seus dados com terceiros.</p>
      <h2 className="h2">Excluir sua conta</h2>
      <p>No <Link href="/perfil">perfil</Link>, seção Conta, use “Excluir conta” e confirme com sua senha. Isso apaga na hora seu perfil, currículo, candidaturas e análises. Não há como desfazer.</p>
    </main>
  );
}
