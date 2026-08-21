// GET /api/testar-email
//
// Rota temporária só pra diagnosticar a notificação por e-mail — dispara um
// envio de teste e devolve o resultado direto na resposta (não precisa
// caçar log no painel do Vercel). Pode apagar esse arquivo depois que
// confirmar que está tudo certo.

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_NOTIFICACAO = process.env.EMAIL_NOTIFICACAO;

module.exports = async (req, res) => {
  const diagnostico = {
    RESEND_API_KEY_configurada: !!RESEND_API_KEY,
    EMAIL_NOTIFICACAO_configurada: !!EMAIL_NOTIFICACAO,
    EMAIL_NOTIFICACAO_valor: EMAIL_NOTIFICACAO || null,
  };

  if (!RESEND_API_KEY || !EMAIL_NOTIFICACAO) {
    return res.status(200).json({
      ok: false,
      motivo: "Env var faltando no Vercel — confira os nomes exatos abaixo.",
      diagnostico,
    });
  }

  try {
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Agendamentos <onboarding@resend.dev>",
        to: [EMAIL_NOTIFICACAO],
        subject: "✅ Teste de notificação — agendamento público",
        html: "<p>Se você recebeu isso, a notificação por e-mail está funcionando corretamente.</p>",
      }),
    });

    const corpo = await resendRes.json();

    return res.status(200).json({
      ok: resendRes.ok,
      statusHttpDoResend: resendRes.status,
      respostaDoResend: corpo,
      diagnostico,
    });
  } catch (err) {
    return res.status(200).json({
      ok: false,
      motivo: "Erro de conexão ao chamar a API do Resend.",
      erro: err.message,
      diagnostico,
    });
  }
};
