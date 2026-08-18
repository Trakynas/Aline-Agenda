// api/_lib/supabase.js
//
// Helpers finos sobre a REST API do Supabase (PostgREST), usando a
// service-role key — ela ignora RLS, então esse arquivo só deve ser
// chamado a partir de código server-side (dentro de /api), nunca exposto
// ao browser.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function headers(extra = {}) {
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

// Retorna os agendamentos (pendentes + confirmados) que já ocupam algum
// horário num intervalo de datas — usado pra não deixar dois pacientes
// marcarem o mesmo horário antes de o Google Calendar saber disso.
async function getAgendaOcupada(dataInicio, dataFim) {
  const url =
    `${SUPABASE_URL}/rest/v1/agenda` +
    `?data=gte.${dataInicio}&data=lte.${dataFim}` +
    `&status=in.(pendente,confirmado)` +
    `&select=data,horario`;

  const res = await fetch(url, { headers: headers() });
  if (!res.ok) throw new Error(`Falha ao consultar agenda (${res.status})`);
  return res.json();
}

// Insere uma nova solicitação de agendamento com status "pendente".
async function criarSolicitacao(payload) {
  const url = `${SUPABASE_URL}/rest/v1/agenda`;
  const res = await fetch(url, {
    method: "POST",
    headers: headers({ Prefer: "return=representation" }),
    body: JSON.stringify({
      ...payload,
      status: "pendente",
      origem: "publico",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Falha ao criar solicitação (${res.status}): ${err}`);
  }

  const rows = await res.json();
  return rows[0];
}

module.exports = { getAgendaOcupada, criarSolicitacao };
