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
