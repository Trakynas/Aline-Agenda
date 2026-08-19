-- Rodar no SQL Editor do Supabase, depois do migracao.sql
-- Cria as tabelas que guardam o expediente configurável pela própria Aline
-- dentro do PsiApp (tela Configurações), que a página pública consulta
-- pra saber quais dias/horários oferecer.

-- Substitua o UUID abaixo se o user_id dela for diferente
-- (o mesmo já usado nas outras tabelas: pacientes, agenda, etc)

create table if not exists configuracao_expediente (
  dia_semana int primary key check (dia_semana between 0 and 6), -- 0 = domingo ... 6 = sábado
  user_id uuid not null,
  ativo boolean not null default false,
  hora_inicio time not null default '08:00',
  hora_fim time not null default '18:00'
);

alter table configuracao_expediente enable row level security;

create policy "expediente_select_proprio" on configuracao_expediente
  for select using (auth.uid() = user_id);
create policy "expediente_insert_proprio" on configuracao_expediente
  for insert with check (auth.uid() = user_id);
create policy "expediente_update_proprio" on configuracao_expediente
  for update using (auth.uid() = user_id);

-- Linhas padrão: segunda a sexta ativas (8h-18h), fim de semana desativado.
-- Ela pode mudar tudo isso depois pela tela de Configurações.
insert into configuracao_expediente (dia_semana, user_id, ativo, hora_inicio, hora_fim) values
  (0, '36bc2af9-2811-460c-bf95-fe6cc909e6f1', false, '08:00', '18:00'),
  (1, '36bc2af9-2811-460c-bf95-fe6cc909e6f1', true,  '08:00', '18:00'),
  (2, '36bc2af9-2811-460c-bf95-fe6cc909e6f1', true,  '08:00', '18:00'),
  (3, '36bc2af9-2811-460c-bf95-fe6cc909e6f1', true,  '08:00', '18:00'),
  (4, '36bc2af9-2811-460c-bf95-fe6cc909e6f1', true,  '08:00', '18:00'),
  (5, '36bc2af9-2811-460c-bf95-fe6cc909e6f1', true,  '08:00', '18:00'),
  (6, '36bc2af9-2811-460c-bf95-fe6cc909e6f1', false, '08:00', '18:00')
on conflict (dia_semana) do nothing;


create table if not exists configuracao_geral (
  user_id uuid primary key,
  duracao_consulta_min int not null default 50,
  intervalo_min int not null default 10
);

alter table configuracao_geral enable row level security;

create policy "geral_select_proprio" on configuracao_geral
  for select using (auth.uid() = user_id);
create policy "geral_insert_proprio" on configuracao_geral
  for insert with check (auth.uid() = user_id);
create policy "geral_update_proprio" on configuracao_geral
  for update using (auth.uid() = user_id);

insert into configuracao_geral (user_id, duracao_consulta_min, intervalo_min)
values ('36bc2af9-2811-460c-bf95-fe6cc909e6f1', 50, 10)
on conflict (user_id) do nothing;
