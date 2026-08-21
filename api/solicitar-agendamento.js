// POST /api/solicitar-agendamento
// body: { nome, telefone, email?, data, horario, observacoes? }
//
// Insere uma solicitação com status "pendente" na tabela `agenda`.
// Não mexe no Google Calendar — isso só acontece quando ela aprova
// dentro do PsiApp (reaproveitando a lógica que já existe lá).

const { criarSolicitacao, getAgendaOcupada } = require("./_lib/supabase");
const { notificarNovaSolicitacao } = require("./_lib/email");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.method !== "POST") {
    return res.status(405).json({ erro: "Método não permitido" });
  }

  const { nome, telefone, email, data, horario, observacoes, duracao } = req.body || {};

  if (!nome || !telefone || !data || !horario) {
    return res.status(400).json({ erro: "Campos obrigatórios: nome, telefone, data, horario" });
  }

  try {
    // Checagem de segurança: alguém pode ter marcado esse mesmo horário
    // entre o paciente abrir a página e enviar o form.
    const ocupados = await getAgendaOcupada(data, data);
    const conflito = ocupados.some(
      (a) => a.data === data && a.horario?.slice(0, 5) === horario
    );

    if (conflito) {
      return res.status(409).json({
        erro: "Esse horário acabou de ser reservado por outra pessoa. Escolha outro horário.",
      });
    }

    const solicitacao = await criarSolicitacao({
      paciente_nome: nome,
      paciente_telefone: telefone,
      paciente_email: email || null,
      data,
      horario,
      duracao: duracao || 50,
      observacoes: observacoes || null,
    });

    // Não usa "await" de propósito — não faz sentido o paciente esperar o
    // e-mail ser enviado pra ver a tela de sucesso, e se o e-mail falhar
    // (fora do ar, chave errada etc.) isso nunca deve derrubar o agendamento.
    notificarNovaSolicitacao(solicitacao).catch((err) =>
      console.error("Notificação por e-mail falhou:", err.message)
    );

    return res.status(201).json({ ok: true, solicitacao });
  } catch (err) {
    console.error("Erro ao criar solicitação:", err.message);
    return res.status(500).json({
      erro: "Não foi possível registrar sua solicitação. Tente novamente ou entre em contato diretamente.",
    });
  }
};
