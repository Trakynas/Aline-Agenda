// api/_lib/email.js
//
// Notifica por e-mail quando uma nova solicitação de agendamento chega.
// Usa a API do Resend (https://resend.com) via fetch simples — sem precisar
// de pacote npm.
//
// Importante: sem verificar um domínio próprio no Resend, só é possível
// mandar e-mail pro próprio endereço usado pra criar a conta lá. Como a
// notificação é justamente pra ela mesma, isso não é um problema — só
// crie a conta no Resend com o e-mail dela (RESEND_NOTIFICACAO_EMAIL).

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_NOTIFICACAO = process.env.EMAIL_NOTIFICACAO;
const PSIAPP_URL = process.env.PSIAPP_URL || "https://psiapp-omega.vercel.app";

async function notificarNovaSolicitacao(solicitacao) {
  // Se as env vars não estiverem configuradas, simplesmente não envia —
  // isso nunca deve derrubar o fluxo de agendamento em si.
  if (!RESEND_API_KEY || !EMAIL_NOTIFICACAO) {
    console.warn("E-mail de notificação não configurado (RESEND_API_KEY / EMAIL_NOTIFICACAO ausentes) — pulando envio.");
    return;
  }

  const [ano, mes, dia] = solicitacao.data.split("-");
  const dataFormatada = `${dia}/${mes}/${ano}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #2B1738;">
      <h2 style="color: #4A2873;">Nova solicitação de agendamento</h2>
      <p style="background: #EDE1FA; padding: 12px 16px; border-radius: 10px; font-weight: 600;">
        ${dataFormatada} às ${solicitacao.horario}
      </p>
      <p><strong>Paciente:</strong> ${solicitacao.paciente_nome || "—"}</p>
      <p><strong>Telefone:</strong> ${solicitacao.paciente_telefone || "—"}</p>
      ${solicitacao.paciente_email ? `<p><strong>E-mail:</strong> ${solicitacao.paciente_email}</p>` : ""}
      ${solicitacao.observacoes ? `<p><strong>Observações:</strong> ${solicitacao.observacoes}</p>` : ""}
      <a href="${PSIAPP_URL}"
         style="display:inline-block; margin-top:16px; padding:12px 22px; background:#6C3FA6; color:#fff; text-decoration:none; border-radius:10px; font-weight:600;">
        Abrir PsiApp para aprovar
      </a>
    </div>
  `;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Agendamentos <onboarding@resend.dev>",
        to: [EMAIL_NOTIFICACAO],
        subject: `Nova solicitação: ${solicitacao.paciente_nome || "paciente"} — ${dataFormatada} às ${solicitacao.horario}`,
        html,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`Falha ao enviar e-mail de notificação (${res.status}):`, err);
    }
  } catch (err) {
    // Nunca deixa um problema de e-mail derrubar o agendamento em si
    console.error("Erro ao enviar e-mail de notificação:", err.message);
  }
}

module.exports = { notificarNovaSolicitacao };
