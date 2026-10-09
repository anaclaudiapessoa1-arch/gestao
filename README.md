# Comercial · MinasLab

Painel de gestão do setor comercial: metas × realizado, pontos a melhorar,
feedback individual, ocorrências, avaliação e bônus, plano de ação. Lê o CRM e
o painel da MinasLab; só a direção entra.

## Como funciona

- **Front:** React + Vite, CSS próprio com as cores da MinasLab (sem framework de UI).
- **Login:** o mesmo do Painel de Gestão (Edge Function `ml-sync`, ação `entrar`).
  Só contas com papel `direcao` passam.
- **Dados próprios** (equipe, metas, ocorrências, avaliações, feedbacks,
  estratégias, regras): coleções `rh_comercial_*` em `ml_registros`, gravadas
  pela porta do painel (`ml-sync`). O prefixo `rh_` faz o servidor restringir
  leitura e escrita à direção. Nenhuma tabela nova.
- **Números do CRM:** Edge Function `ml-comercial` (pasta
  `supabase/functions/ml-comercial`), só leitura. Confere o mesmo crachá do
  painel e devolve propostas somadas por mês e responsável, e a lista de
  propostas sem responsável. Regras de soma em `agregar.mjs`, com testes.
- **Regras de avaliação:** `src/lib/calculos.js`, com testes. A tela só mostra.

Supabase: projeto **Projetos Léo** (compartilhado; tudo da MinasLab leva o prefixo `ml_`).

## Rodar

```
npm install
npm run dev     # http://localhost:5176
npm test        # regras e soma do CRM
npm run build
```

## Publicar o site

Push na `main` publica no GitHub Pages (`.github/workflows/deploy.yml`), em
`/gestao/`. Os testes rodam antes; se falharem, o site no ar não muda.

## Publicar a função do CRM

```
supabase functions deploy ml-comercial --project-ref reoghclxripktzpdwhiy --no-verify-jwt
```

Usa o segredo `ML_JWT_SECRET`, que já existe no projeto (é o mesmo do painel).

## Telas

- **Resultado:** Cockpit do dia (previsão do mês, alertas, ações do dia), Visão do mês, Funil, Qualidade do dado.
- **Pessoas:** Pessoas e feedback (roteiro de 1:1, PDI, estágio e estilo de liderança), Avaliação e bônus, Ocorrências.
- **Clientes:** Carteira (curva ABC, clientes em risco, contratos e recorrências), Satisfação (NPS), Licitações.
- **Gestão:** Estratégias e objetivos do trimestre, Decisões (diário com revisão), Funções e cargos, Equipe e metas (inclui desligamento).
- **Desenvolvimento:** Reuniões prontas (apresentação + roteiro + ata, impressão em PDF), Treinamentos (9 trilhas, registro e eficácia).

Função `ml-comercial` (só leitura): `resumo`, `semResponsavel`, `cockpit`, `funil`, `carteira`, `licitacoes`, `nps`.
