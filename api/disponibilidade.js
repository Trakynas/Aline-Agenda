// GET /api/disponibilidade?data=YYYY-MM-DD
//
// Devolve os horários livres de um dia específico, cruzando:
//   1. O Google Calendar dela (via freebusy.query)
//   2. A tabela `agenda` do Supabase (compromissos pendentes/confirmados)
//
// Se a renovação do token do Google falhar (ex: passou dos 7 dias sem
// reconectar), devolve fallback=true em vez de quebrar, pra página pública
// mostrar uma mensagem amigável em vez de erro.

const { getGoogleAccessToken } = require("./_lib/google-auth");
const { getAgendaOcupada } = require("./_lib/supabase");

// Horário comercial fixo — ajuste conforme a rotina real
const EXPEDIENTE = {
  inicio: 8, // 08:00
  fim: 18, // 18:00
  duracaoConsultaMin: 50,
  intervaloMin: 10, // intervalo entre consultas
  diasBloqueados: [0, 6], // 0 = domingo, 6 = sábado
};

const TIMEZONE = "America/Sao_Paulo";
const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || "primary";

function gerarSlotsDoDia() {
  const slots = [];
  const passo = EXPEDIENTE.duracaoConsultaMin + EXPEDIENTE.intervaloMin;
  let minutos = EXPEDIENTE.inicio * 60;
  const fimMinutos = EXPEDIENTE.fim * 60;

  while (minutos + EXPEDIENTE.duracaoConsultaMin <= fimMinutos) {
    const h = String(Math.floor(minutos / 60)).padStart(2, "0");
    const m = String(minutos % 60).padStart(2, "0");
    slots.push(`${h}:${m}`);
    minutos += passo;
  }
  return slots;
}

async function buscarBusyDoGoogle(accessToken, data) {
  const timeMin = `${data}T00:00:00-03:00`;
  const timeMax = `${data}T23:59:59-03:00`;

  const res = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      timeMin,
      timeMax,
      timeZone: TIMEZONE,
      items: [{ id: CALENDAR_ID }],
    }),
  });

  if (!res.ok) {
    throw new Error(`Falha ao consultar freebusy do Google (${res.status})`);
  }

  const dataRes = await res.json();
  const busy = dataRes.calendars?.[CALENDAR_ID]?.busy || [];

  // Converte pra lista de horários "ocupados" no formato HH:MM (início) respeitando o fuso de Brasília
  return busy.map((b) => {
    const inicio = new Date(b.start);
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: TIMEZONE,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(inicio);

    const h = parts.find((p) => p.type === "hour").value;
    const m = parts.find((p) => p.type === "minute").value;
    return `${h}:${m}`;
  });
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const { data } = req.query;
  if (!data) {
    return res.status(400).json({ erro: "Parâmetro 'data' (YYYY-MM-DD) é obrigatório" });
  }

  const diaSemana = new Date(`${data}T12:00:00`).getDay();
  if (EXPEDIENTE.diasBloqueados.includes(diaSemana)) {
    return res.status(200).json({ slots: [], motivo: "fora_do_expediente" });
  }

  const todosSlots = gerarSlotsDoDia();

  try {
    const [accessToken, ocupadosInternos] = await Promise.all([
      getGoogleAccessToken(),
      getAgendaOcupada(data, data),
    ]);

    const busyGoogle = await buscarBusyDoGoogle(accessToken, data);
    const busyInterno = ocupadosInternos
      .filter((a) => a.data === data)
      .map((a) => a.horario?.slice(0, 5));

    const ocupados = new Set([...busyGoogle, ...busyInterno]);
    const livres = todosSlots.filter((s) => !ocupados.has(s));

    return res.status(200).json({ slots: livres, fallback: false });
  } catch (err) {
    console.error("Erro ao calcular disponibilidade:", err.message);
    // Fallback: não quebra a página, só avisa que não dá pra checar agora
    return res.status(200).json({
      slots: [],
      fallback: true,
      mensagem:
        "No momento não conseguimos consultar a agenda automaticamente. " +
        "Entre em contato diretamente para marcar seu horário.",
    });
  }
};
