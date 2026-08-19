// GET /api/disponibilidade?data=YYYY-MM-DD
//
// Devolve os horários livres de um dia específico, cruzando:
//   1. O expediente configurado pela Aline no PsiApp (tela Configurações)
//   2. O Google Calendar dela (via freebusy.query) — bloqueia qualquer
//      evento, seja consulta ou compromisso pessoal
//   3. A tabela `agenda` do Supabase (compromissos pendentes/confirmados)
//
// Se algo falhar (token do Google expirado, config indisponível, etc),
// devolve fallback=true em vez de quebrar, pra página pública mostrar uma
// mensagem amigável em vez de erro.

const { getGoogleAccessToken } = require("./_lib/google-auth");
const {
  getAgendaOcupada,
  getConfiguracaoExpediente,
  getConfiguracaoGeral,
} = require("./_lib/supabase");

const TIMEZONE = "America/Sao_Paulo";

function gerarSlotsDoDia(horaInicio, horaFim, duracaoMin, intervaloMin) {
  const slots = [];
  const [hi, mi] = horaInicio.slice(0, 5).split(":").map(Number);
  const [hf, mf] = horaFim.slice(0, 5).split(":").map(Number);

  const passo = duracaoMin + intervaloMin;
  let minutos = hi * 60 + mi;
  const fimMinutos = hf * 60 + mf;

  while (minutos + duracaoMin <= fimMinutos) {
    const h = String(Math.floor(minutos / 60)).padStart(2, "0");
    const m = String(minutos % 60).padStart(2, "0");
    slots.push(`${h}:${m}`);
    minutos += passo;
  }
  return slots;
}

async function buscarBusyDoGoogle(accessToken, data, calendarIds) {
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
      items: calendarIds.map((id) => ({ id })),
    }),
  });

  if (!res.ok) {
    throw new Error(`Falha ao consultar freebusy do Google (${res.status})`);
  }

  const dataRes = await res.json();
  const calendars = dataRes.calendars || {};

  // Junta os intervalos ocupados de TODOS os calendários selecionados
  const busy = [];
  for (const id of calendarIds) {
    const doCalendario = calendars[id]?.busy || [];
    for (const b of doCalendario) busy.push(b);
  }

  // Devolve os intervalos como instantes absolutos (Date) — comparar assim
  // evita qualquer confusão de fuso horário entre o servidor (UTC na Vercel)
  // e o horário de Brasília usado na agenda.
  return busy.map((b) => ({ inicio: new Date(b.start), fim: new Date(b.end) }));
}

// Um slot (HH:MM, no fuso de Brasília) vira um intervalo absoluto de tempo,
// pra poder comparar com os busy do Google sem depender do fuso do servidor.
function slotParaIntervalo(data, horarioHHMM, duracaoMin) {
  const inicio = new Date(`${data}T${horarioHHMM}:00-03:00`);
  const fim = new Date(inicio.getTime() + duracaoMin * 60000);
  return { inicio, fim };
}

function seSobrepoe(a, b) {
  return a.inicio < b.fim && a.fim > b.inicio;
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const { data, debug } = req.query;
  if (!data) {
    return res.status(400).json({ erro: "Parâmetro 'data' (YYYY-MM-DD) é obrigatório" });
  }

  const diaSemana = new Date(`${data}T12:00:00`).getDay();

  try {
    const [accessToken, ocupadosInternos, configExpediente, configGeral] = await Promise.all([
      getGoogleAccessToken(),
      getAgendaOcupada(data, data),
      getConfiguracaoExpediente(),
      getConfiguracaoGeral(),
    ]);

    const diaConfig = configExpediente.find((c) => c.dia_semana === diaSemana);

    if (!diaConfig || !diaConfig.ativo) {
      return res.status(200).json({ slots: [], motivo: "fora_do_expediente" });
    }

    const todosSlots = gerarSlotsDoDia(
      diaConfig.hora_inicio,
      diaConfig.hora_fim,
      configGeral.duracao_consulta_min,
      configGeral.intervalo_min
    );

    const calendarIds = configGeral.calendarios_google?.length ? configGeral.calendarios_google : ["primary"];
    const busyGoogle = await buscarBusyDoGoogle(accessToken, data, calendarIds);
    const horariosInternosOcupados = new Set(
      ocupadosInternos.filter((a) => a.data === data).map((a) => a.horario?.slice(0, 5))
    );

    const duracao = configGeral.duracao_consulta_min;
    const livres = todosSlots.filter((horario) => {
      if (horariosInternosOcupados.has(horario)) return false;

      const intervaloSlot = slotParaIntervalo(data, horario, duracao);
      return !busyGoogle.some((b) => seSobrepoe(intervaloSlot, b));
    });

    const resposta = {
      slots: livres,
      fallback: false,
      duracaoMin: configGeral.duracao_consulta_min,
    };

    // Modo de depuração: ?debug=1 na URL mostra o que o Google devolveu de fato
    if (debug === "1") {
      resposta.debug = {
        calendarIdsUsados: calendarIds,
        totalSlotsAntesDoFiltro: todosSlots.length,
        busyGoogleBruto: busyGoogle.map((b) => ({
          inicio: b.inicio.toISOString(),
          fim: b.fim.toISOString(),
        })),
        horariosInternosOcupados: [...horariosInternosOcupados],
      };
    }

    return res.status(200).json(resposta);
  } catch (err) {
    console.error("Erro ao calcular disponibilidade:", err.message);
    const resposta = {
      slots: [],
      fallback: true,
      mensagem:
        "No momento não conseguimos consultar a agenda automaticamente. " +
        "Entre em contato diretamente para marcar seu horário.",
    };
    if (debug === "1") resposta.debug = { erro: err.message };
    return res.status(200).json(resposta);
  }
};
