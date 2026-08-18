# Página pública de agendamento

Projeto separado do PsiApp, mas conectado ao mesmo Supabase. Pacientes escolhem
um horário livre (checado em tempo real contra o Google Calendar), preenchem
os dados e a solicitação entra como **pendente** na tabela `agenda`. A
aprovação (e criação do evento no Google Calendar) continua acontecendo
dentro do PsiApp.

## 1. Rodar a migração no Supabase

Abra o SQL Editor do projeto Supabase do PsiApp e rode o conteúdo de
`migracao.sql`. Ele só adiciona colunas novas (`status`, `origem`,
`paciente_nome`, etc) — não altera nem apaga nada existente.

## 2. Deploy no Vercel

1. Suba esta pasta como um **novo projeto** no Vercel (repo Git separado do
   PsiApp, ou upload direto).
2. Em **Settings → Environment Variables**, adicione as variáveis do
   `.env.example`:
   - `SUPABASE_URL` — mesma URL do PsiApp
   - `SUPABASE_SERVICE_ROLE_KEY` — pegue em Supabase → Settings → API
     (⚠️ nunca coloque essa chave no frontend, só nas env vars do Vercel)
   - `PSIAPP_USER_ID` — o UUID do usuário autenticado (já usado no PsiApp)
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — mesmos do PsiApp
   - `GOOGLE_CALENDAR_ID` — opcional, padrão é `primary`
3. Deploy.

## 3. No PsiApp: tela de aprovação

Falta criar, dentro do PsiApp, uma tela/listagem de agendamentos com
`status = 'pendente'` e `origem = 'publico'`, com botões de:

- **Aprovar** → chama a lógica existente de criação de evento no Google
  Calendar e muda `status` para `confirmado`
- **Recusar** → muda `status` para `recusado`

Isso ainda não foi implementado neste projeto — é o próximo passo, do lado
do PsiApp.

## Sobre o fallback

Se o refresh token do Google estiver expirado (mais de 7 dias sem
reconectar, por causa do modo "Testing" do OAuth), `/api/disponibilidade`
não quebra: devolve `fallback: true` e a página mostra uma mensagem pedindo
para entrar em contato diretamente, em vez de travar.

## Estrutura

```
public/            → frontend (HTML/CSS/JS puro, sem build step)
api/disponibilidade.js       → GET, calcula horários livres do dia
api/solicitar-agendamento.js → POST, cria solicitação pendente
api/_lib/google-auth.js      → renova o access token do Google
api/_lib/supabase.js         → helpers REST pro Supabase
migracao.sql                 → colunas novas na tabela agenda
```
