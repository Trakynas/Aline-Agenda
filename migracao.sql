-- Rodar no SQL Editor do Supabase (projeto do PsiApp)
-- Só adiciona colunas novas, nada é alterado ou removido.

alter table agenda
  add column if not exists status text not null default 'confirmado',
  add column if not exists origem text not null default 'interno',
  add column if not exists paciente_nome text,
  add column if not exists paciente_telefone text,
  add column if not exists paciente_email text,
  add column if not exists observacoes text;

-- status possíveis: 'pendente' | 'confirmado' | 'recusado'
-- origem possíveis: 'interno' (criado no PsiApp) | 'publico' (via página de agendamento)

-- Índice para a consulta de disponibilidade (filtra por data + status)
create index if not exists idx_agenda_data_status on agenda (data, status);


-- ==========================================
-- Configuração de expediente (usada pela tela "⚙️ Configurações" do PsiApp
-- e lida pela página pública de agendamento pra saber quais horários oferecer)
-- ==========================================

create table if not exists configuracao_expediente (
  dia_semana int primary key check (dia_semana between 0 and 6), -- 0 = domingo ... 6 = sábado
  user_id uuid not null default auth.uid(),
  ativo boolean not null default false,
  hora_inicio time not null default '08:00',
  hora_fim time not null default '18:00'
);

alter table configuracao_expediente enable row level security;

create policy "usuária autenticada vê e edita sua própria configuração de expediente"
  on configuracao_expediente for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists configuracao_geral (
  user_id uuid primary key default auth.uid(),
  duracao_consulta_min int not null default 50,
  intervalo_min int not null default 10
);

alter table configuracao_geral enable row level security;

create policy "usuária autenticada vê e edita sua própria configuração geral"
  on configuracao_geral for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Valores padrão pra já funcionar antes mesmo dela abrir a tela de Configurações
-- (segunda a sexta, 08:00-18:00, consultas de 50min com 10min de intervalo)
insert into configuracao_expediente (dia_semana, user_id, ativo, hora_inicio, hora_fim)
values
  (0, '36bc2af9-2811-460c-bf95-fe6cc909e6f1', false, '08:00', '18:00'),
  (1, '36bc2af9-2811-460c-bf95-fe6cc909e6f1', true,  '08:00', '18:00'),
  (2, '36bc2af9-2811-460c-bf95-fe6cc909e6f1', true,  '08:00', '18:00'),
  (3, '36bc2af9-2811-460c-bf95-fe6cc909e6f1', true,  '08:00', '18:00'),
  (4, '36bc2af9-2811-460c-bf95-fe6cc909e6f1', true,  '08:00', '18:00'),
  (5, '36bc2af9-2811-460c-bf95-fe6cc909e6f1', true,  '08:00', '18:00'),
  (6, '36bc2af9-2811-460c-bf95-fe6cc909e6f1', false, '08:00', '18:00')
on conflict (dia_semana) do nothing;

insert into configuracao_geral (user_id, duracao_consulta_min, intervalo_min)
values ('36bc2af9-2811-460c-bf95-fe6cc909e6f1', 50, 10)
on conflict (user_id) do nothing;
