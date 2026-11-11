# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js (App Router), definido em `docs/beta-spec.md`. Backend Django + django-ninja em `/api/*` (sessão por cookie + CSRF). Cloudflare Tunnel: `/api/*` e `/admin/*` → Django, o resto → Next.

## Users

Estudantes e recém-formados buscando **estágio, trainee ou júnior** em Software, Dados, Infra/Redes/Segurança e Engenharias, no Brasil. Usam celular e desktop igualmente: celular para checar vagas novas no dia, desktop para kanban e perfil. Cadastro aberto (e-mail + senha).

## Product Purpose

Juntar vagas de início de carreira de várias fontes (Gupy, GitHub issues, Greenhouse, Lever…), filtrar pelo perfil e ranquear por aderência, mostrando o porquê do score. Acompanhar as candidaturas num kanban e, quando reprovado, pedir uma análise ao Gemini. Sucesso: o usuário abre, vê o que entrou desde a última visita, salva e aplica.

## Positioning

Gratuito, focado só em vagas de entrada (vaga sem nível explícito fica de fora), com score transparente (skills ~85%, salário ≤15%) e um radar das skills mais pedidas que o usuário ainda não marcou. Guarda histórico de vagas fechadas.

## Operating Context

Tela inicial após login: lista de vagas ranqueadas, com destaque para as novas desde a última visita. Fluxo: cadastro → perfil (áreas, níveis, UF/cidade, modelos de trabalho, faixa salarial, skills do catálogo, currículo em PDF→texto) → vagas → salvar no kanban → mover entre colunas → reprovada → "Analisar".

## Capabilities and Constraints

- Kanban com colunas fixas: Salva → Aplicada → Teste/Case → Entrevista → Oferta; finais Reprovada e Desisti. Card manual (título, empresa, link).
- Análise do Gemini só em candidatura reprovada; ~10 por dia por usuário.
- Exclusão de conta com todos os dados (pede senha). Página de privacidade: currículo vai ao Gemini só ao clicar "Analisar"; no plano grátis o Google pode usar o conteúdo.
- Login/cadastro com limite por IP.
- Interface em pt-BR; código e API em inglês.

## Brand Commitments

Nome: JobHunter. Sem logo nem cores prévias. O usuário pediu tema **preto**, moderno e chamativo.

## Evidence on Hand

Nenhum depoimento, número de usuários ou métrica. Não inventar.

## Product Principles

1. O que é novo desde a última visita aparece primeiro.
2. Todo score se explica: skills que batem, que faltam, e salário.
3. Nada de vaga fora do nível de entrada.
4. Dados do usuário são dele: exclusão total, IA só sob clique.
