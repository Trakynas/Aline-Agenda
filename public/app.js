const state = {
  data: null,
  horario: null, // sempre no horário de Brasília — é o que vai pra API
  duracao: 50,
};

// O Brasil não tem mais horário de verão desde 2019, então -03:00 é fixo
// pra São Paulo/Curitiba o ano inteiro.
const FUSO_CLINICA = "America/Sao_Paulo";

function getFusoVisitante() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || FUSO_CLINICA;
  } catch {
    return FUSO_CLINICA;
  }
}

// Converte um horário de Brasília (ex: "14:00" no dia "2026-03-20") pro
// fuso do visitante. Se for o mesmo fuso (efetivamente), retorna igual.
function converterParaVisitante(dataStr, horarioBrasilia) {
  const isoUtc = `${dataStr}T${horarioBrasilia}:00-03:00`;
  const instante = new Date(isoUtc);
  const fusoVisitante = getFusoVisitante();

  const horaLocal = instante.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: fusoVisitante,
  });
  const dataLocal = instante.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: fusoVisitante,
  });
  const dataOriginalFormatada = new Date(`${dataStr}T12:00:00-03:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });

  const diferente = horaLocal !== horarioBrasilia || dataLocal !== dataOriginalFormatada;

  return { horaLocal, dataLocal, diferente };
}

const el = {
  inputData: document.getElementById("input-data"),
  slotsStatus: document.getElementById("slots-status"),
  slotsGrid: document.getElementById("slots-grid"),
  stepData: document.getElementById("step-data"),
  stepForm: document.getElementById("step-form"),
  stepSucesso: document.getElementById("step-sucesso"),
  selectedSummary: document.getElementById("selected-summary"),
  btnVoltar: document.getElementById("btn-voltar"),
  btnEnviar: document.getElementById("btn-enviar"),
  sucessoTexto: document.getElementById("sucesso-texto"),
};

// Data mínima = hoje
const hoje = new Date().toISOString().split("T")[0];
el.inputData.min = hoje;
el.inputData.value = hoje;

el.inputData.addEventListener("change", () => {
  state.data = el.inputData.value;
  state.horario = null;
  carregarSlots(state.data);
});

async function carregarSlots(data) {
  el.slotsGrid.innerHTML = "";
  el.slotsStatus.classList.remove("erro");
  el.slotsStatus.textContent = "Buscando horários disponíveis...";

  try {
    const res = await fetch(`/api/disponibilidade?data=${data}`);
    const json = await res.json();
    state.duracao = json.duracaoMin || 50;

    if (json.fallback) {
      el.slotsStatus.classList.add("erro");
      el.slotsStatus.textContent = json.mensagem;
      return;
    }

    if (json.motivo === "fora_do_expediente") {
      el.slotsStatus.textContent = "Sem atendimento nesse dia. Escolha outra data.";
      return;
    }

    if (!json.slots.length) {
      el.slotsStatus.textContent = "Nenhum horário livre nesse dia. Tente outra data.";
      return;
    }

    const fusoDiferente = converterParaVisitante(data, json.slots[0]).diferente;
    el.slotsStatus.textContent = fusoDiferente
      ? "Escolha um horário (convertido pro seu fuso — horário de Brasília em cinza):"
      : "Escolha um horário (horário de Brasília):";

    json.slots.forEach((slotBrasilia) => {
      const conv = converterParaVisitante(data, slotBrasilia);

      const btn = document.createElement("button");
      btn.className = "slot-btn";
      btn.type = "button";

      if (conv.diferente) {
        // Mostra o horário do visitante em destaque, e o de Brasília pequeno embaixo
        btn.innerHTML = `<span class="slot-hora">${conv.horaLocal}</span><span class="slot-ref">${slotBrasilia} Brasília</span>`;
      } else {
        btn.innerHTML = `<span class="slot-hora">${slotBrasilia}</span>`;
      }

      btn.addEventListener("click", () => selecionarSlot(slotBrasilia, btn));
      el.slotsGrid.appendChild(btn);
    });
  } catch (err) {
    el.slotsStatus.classList.add("erro");
    el.slotsStatus.textContent = "Não foi possível carregar os horários. Tente novamente.";
  }
}

function selecionarSlot(slot, btnEl) {
  document.querySelectorAll(".slot-btn.selected").forEach((b) => b.classList.remove("selected"));
  btnEl.classList.add("selected");
  state.horario = slot;
  irParaFormulario();
}

function irParaFormulario() {
  const dataFormatada = new Date(`${state.data}T12:00:00`).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });

  const conv = converterParaVisitante(state.data, state.horario);
  el.selectedSummary.textContent = conv.diferente
    ? `${dataFormatada}, às ${conv.horaLocal} (seu horário) — ${state.horario} em Brasília`
    : `${dataFormatada}, às ${state.horario}`;

  el.stepData.dataset.active = "false";
  el.stepForm.dataset.active = "true";
}

el.btnVoltar.addEventListener("click", () => {
  el.stepForm.dataset.active = "false";
  el.stepData.dataset.active = "true";
});

el.btnEnviar.addEventListener("click", async () => {
  const nome = document.getElementById("input-nome").value.trim();
  const telefone = document.getElementById("input-telefone").value.trim();
  const email = document.getElementById("input-email").value.trim();
  const observacoes = document.getElementById("input-observacoes").value.trim();

  if (!nome || !telefone) {
    alert("Preencha nome e telefone para continuar.");
    return;
  }

  el.btnEnviar.disabled = true;
  el.btnEnviar.textContent = "Enviando...";

  try {
    const res = await fetch("/api/solicitar-agendamento", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome,
        telefone,
        email: email || undefined,
        data: state.data,
        horario: state.horario,
        duracao: state.duracao,
        observacoes: observacoes || undefined,
      }),
    });

    const json = await res.json();

    if (!res.ok) {
      alert(json.erro || "Não foi possível enviar sua solicitação.");
      el.btnEnviar.disabled = false;
      el.btnEnviar.textContent = "Solicitar horário";
      return;
    }

    const dataFormatada = new Date(`${state.data}T12:00:00`).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
    });
    const conv = converterParaVisitante(state.data, state.horario);
    el.sucessoTexto.textContent = conv.diferente
      ? `Seu horário para ${dataFormatada} às ${conv.horaLocal} (seu horário) foi solicitado.`
      : `Seu horário para ${dataFormatada} às ${state.horario} foi solicitado.`;

    el.stepForm.dataset.active = "false";
    el.stepSucesso.dataset.active = "true";
    animarCheckSucesso();
  } catch (err) {
    alert("Erro de conexão. Tente novamente em instantes.");
    el.btnEnviar.disabled = false;
    el.btnEnviar.textContent = "Solicitar horário";
  }
});

function animarCheckSucesso() {
  const ring = document.getElementById("success-ring");
  const check = document.getElementById("success-check");
  if (!ring || !check) return;

  ring.style.transition = "none";
  check.style.transition = "none";
  ring.style.strokeDashoffset = "170";
  check.style.strokeDashoffset = "40";

  requestAnimationFrame(() => {
    ring.style.transition = "stroke-dashoffset 0.6s cubic-bezier(0.16,1,0.3,1)";
    check.style.transition = "stroke-dashoffset 0.4s cubic-bezier(0.16,1,0.3,1) 0.5s";
    ring.style.strokeDashoffset = "0";
    check.style.strokeDashoffset = "0";
  });
}

// Carrega os slots do dia atual assim que a página abre
carregarSlots(state.data || hoje);
state.data = state.data || hoje;
