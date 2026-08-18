// api/_lib/google-auth.js
//
// Reimplementação enxuta da lógica de refresh do PsiApp (google-token-refresh.js),
// duplicada aqui porque este é um projeto Vercel separado e não compartilha
// arquivos de código com o PsiApp — só o banco Supabase.
//
// Fluxo:
//   1. Busca o refresh_token salvo na tabela `google_tokens` (Supabase)
//   2. Troca ele por um access_token novo direto na API do Google
//   3. Devolve o access_token pronto pra usar no Calendar API

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

// UUID do usuário autenticado no PsiApp (mesmo valor usado lá)
const USER_ID = process.env.PSIAPP_USER_ID;

async function getStoredRefreshToken() {
  const url = `${SUPABASE_URL}/rest/v1/google_tokens?user_id=eq.${USER_ID}&select=refresh_token&limit=1`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Falha ao buscar refresh_token no Supabase (${res.status})`);
  }

  const rows = await res.json();
  if (!rows.length || !rows[0].refresh_token) {
    throw new Error("Nenhum refresh_token encontrado — reconexão com Google pendente");
  }

  return rows[0].refresh_token;
}

async function exchangeForAccessToken(refreshToken) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    // Isso normalmente significa que o refresh_token expirou (limite de 7 dias
    // do modo "Testing" do OAuth) — precisa reconectar dentro do PsiApp.
    throw new Error(`Falha ao renovar token do Google: ${data.error || res.status}`);
  }

  return data.access_token;
}

async function getGoogleAccessToken() {
  const refreshToken = await getStoredRefreshToken();
  return exchangeForAccessToken(refreshToken);
}

module.exports = { getGoogleAccessToken };
