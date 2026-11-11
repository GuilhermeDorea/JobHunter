# JobHunter — escopo do beta

Definido em 2026-11-11. Hospedagem: jobhunter.guilhermedorea.com, no PC do autor, via Cloudflare Tunnel.

## Produto
- Multiusuário, cadastro aberto (e-mail + senha). Interface pt-BR; código e API em inglês.
- Vagas de **estágio, trainee e júnior** (`INTERNSHIP` / `TRAINEE` / `JUNIOR`) nas áreas Software, Dados, Infra/Redes/Segurança e Engenharias.
  Vaga sem nível explícito no título fica de fora (normalmente é pleno).
- Perfil: áreas, níveis, localização (UF/cidade), modelos de trabalho, faixa salarial, skills (do catálogo de stacks) e texto do currículo (PDF → `pypdf`, só o texto é guardado).
- Filtro rígido: área, nível, localização, modelo de trabalho (remoto ignora localização).
- Ranking 0–100: skills (~85%) + salário (≤15%; vaga sem bolsa = neutro). O "porquê" do score é exibido.
- Kanban com colunas fixas: Salva → Aplicada → Teste/Case → Entrevista → Oferta; finais Reprovada e Desisti. Card manual permitido (título, empresa, link).
- Radar de skills: stacks mais pedidas nas vagas compatíveis que o usuário ainda não marcou.
- Gemini só como **analista**: botão "Analisar" numa candidatura reprovada. Resultado salvo. Limite ~10 análises/dia/usuário (cota grátis compartilhada).
- Exclusão de conta com todos os dados. Página de privacidade (currículo vai ao Gemini só ao clicar "Analisar"; no plano grátis o Google pode usar o conteúdo).
- Limite de tentativas de login/cadastro por IP.

## Coleta
- Fontes: Gupy (página pública de busca), GitHub issues (frontendbr/vagas, backend-br/vagas), Greenhouse/Lever (lista de empresas), Programathor, Nube, Trampos. Um módulo por fonte (`collectors/<fonte>.py`, função `fetch()`).
- Respeita robots.txt (`urllib.robotparser`), 1 req / 2 s por domínio, teto de páginas por execução.
- 1 execução por dia; fonte que falhar tenta de novo em 6 h. Cada execução gera um `CollectorRun`.
- Dedupe por (fonte, id externo). Vaga que some da fonte ganha `closed_at`, não é apagada (base para prever reabertura).
- Nível: tipo informado pela fonte, senão palavras-chave do título. Skills: catálogo com apelidos, por regex.
- Bolsa: regex "R$ ..." na descrição; o usuário também pode anotar no card.

## Infra
- Django + django-ninja + Postgres; Next.js (App Router).
- Docker Compose: postgres, django, next, collector, cloudflared.
- Tunnel: `/api/*` e `/admin/*` → Django; resto → Next. Sessão por cookie + CSRF.
- `pg_dump` diário, mantém os 7 últimos.

## Fora do beta (dados já guardados)
- Previsão de reabertura de vagas por empresa.
- Feedback agregado de padrões entre reprovações.
- Notificações por e-mail.

## Beta pronto quando
1. Coleta roda sozinha 3 dias seguidos.
2. Cadastro → perfil → lista ranqueada com o porquê.
3. Kanban completo com card manual.
4. Análise do Gemini numa reprovação.
5. Radar de skills.
6. Tudo em jobhunter.guilhermedorea.com com HTTPS.

O front tem sessão própria de direção visual depois do backend.
