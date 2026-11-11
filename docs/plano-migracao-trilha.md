# Plano: migrar a "Trilha Dev do Gui" e a rotina semanal para o JobHunter

Situação em 11/11/2026. As 12 candidaturas ativas do painel já estão na conta (id 2) com a nota "Migrado da Trilha Dev do Gui".
Vagas encerradas/descartadas do painel não foram migradas: ficam como histórico no artefato.

## O que a rotina "Varredura semanal de vagas" faz e o JobHunter não

| # | Verificação da rotina | JobHunter hoje | Lacuna |
|---|---|---|---|
| 1 | Fontes: LinkedIn, Programathor, Coodesh, Trampos, Remotar, Glassdoor, Salvador Tech, Parque Tecnológico, sites de carreira | Gupy, Greenhouse, Lever, GitHub | Faltam Programathor, Coodesh, Remotar (APIs/HTML públicos) e páginas de programas de estágio |
| 2 | Programas de estágio/trainee de grandes empresas (iFood, Nubank, Blip, Serasa...) com calendário de abertura | Só pega o que estiver no Gupy/Greenhouse no momento | Sem lista de programas monitorados nem aviso "abre em julho/2027" |
| 3 | Regra de nível: abre a vaga e rejeita "1+/3+ anos", pleno, sênior mesmo com título júnior | `detect_level` olha só o título | Ler requisitos de experiência na descrição |
| 4 | Linguagens excluídas (Java, C#, Go, PHP) exceto programas sem linguagem fixa | Score por stacks, não exclui | Campo "stacks que não quero" no perfil, com exceção para estágio/trainee |
| 5 | Piso sobre remuneração total (bolsa + auxílios em dinheiro), benefícios não-dinheiro à parte | Um número `salary`; `detect_salary` pega o primeiro valor | Separar bolsa e auxílios; "confirmar auxílios" quando faltar |
| 6 | Localização: presencial/híbrido fora da BA é descartado | `jobs_for` já filtra por UF + remoto | Coberto. Só falta tratar programas multi-cidade |
| 7 | Compatibilidade de horário (manhã/início da tarde ou remoto flexível) | Não existe | Campo de disponibilidade + detecção de "horário flexível"/carga horária |
| 8 | Prazos: destaca inscrições que fecham em 14 dias | Guarda `deadline` (Gupy) e fecha vencidas | Destaque na Corrida/Radar e prazo também nas candidaturas |
| 9 | Requisito de ano de formatura (ex.: jul/2027–jan/2029) | Não existe | Campo "formatura prevista" no perfil + detecção na descrição |
| 10 | Não repetir empresas/vagas já tratadas | Card por vaga (`one_card_per_job`) | Coberto para vagas coletadas; falta "ocultar empresa" |
| 11 | Resumo semanal (até 6 vagas, 2 prioridades, leitura do mercado) | Radar na tela, sem envio | Resumo semanal gerado com Gemini e enviado (e-mail ou push) |
| 12 | Notas ricas por vaga (histórico, ressalvas de verificação) | `notes` em texto livre | Coberto |

## Ordem sugerida (cada passo é entregável sozinho)

1. **Prazos visíveis** (8): campo `deadline` na Application, badge "fecha em N dias" no Radar e na Corrida. Barato e é o que mais pesa hoje (iFood GEN IA fecha 17/11).
2. **Filtro de nível pela descrição** (3): regex de "N+ anos", "pleno", "sênior" no texto; vaga reprovada não entra no Radar. Teste em `tests.py`.
3. **Perfil completo** (4, 7, 9): stacks excluídas, disponibilidade de horário e formatura prevista; filtros em `jobs_for`.
4. **Remuneração total** (5): `salary` vira bolsa + `benefits_cash`; score usa o total, e falta de auxílio é neutra, não penaliza.
5. **Novos coletores** (1): Programathor e Coodesh primeiro (mais vagas júnior remoto BR).
6. **Programas de estágio** (2): tabela de programas monitorados (empresa, link, janela típica) com aviso quando abre.
7. **Resumo semanal** (11): comando `weekly_digest` no container `collector`, segunda 10h, top 6 do Radar + prazos + análise Gemini, enviado por e-mail.

Quando 1–7 estiverem prontos, a rotina na nuvem (`trig_01YA9KBy8oh8GPTQr5KhhZx2`) pode ser desligada e o artefato vira só histórico.
Até lá, mantê-la ligada e cadastrar no JobHunter o que ela encontrar.
