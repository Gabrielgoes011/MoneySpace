// ========================================
// SEGREDOS DA APLICAÇÃO (um para cada uso)
// ========================================
// Três segredos, cada um com um papel só:
//   JWT_SECRET          -> assina o token de ACESSO (vale por request)
//   JWT_REFRESH_SECRET  -> assina o token de REFRESH (só renova a sessão)
//   CRYPTO_SECRET       -> chave da cifragem do segredo do 2FA (mfa_secreto)
// Se um vazar, os outros continuam de pé. Por isso não há fallback entre eles.
// Se faltar algum, ou se dois forem iguais, o servidor nem sobe (erro claro).
// Importado logo depois do env.js (ver server.js), então o .env já foi carregado.

const NOMES_OBRIGATORIOS = ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'CRYPTO_SECRET'];

const faltando = NOMES_OBRIGATORIOS.filter((nome) => !process.env[nome]);
if (faltando.length > 0) {
  throw new Error(
    `Segredos ausentes: ${faltando.join(', ')}. Configure no .env (dev) ou no painel da Discloud (produção).`
  );
}

if (process.env.JWT_REFRESH_SECRET === process.env.JWT_SECRET) {
  throw new Error('JWT_REFRESH_SECRET não pode ser igual ao JWT_SECRET. Gere um valor diferente.');
}

export const SEGREDO_ACESSO = process.env.JWT_SECRET;
export const SEGREDO_REFRESH = process.env.JWT_REFRESH_SECRET;
export const SEGREDO_CRIPTO = process.env.CRYPTO_SECRET;

export default { SEGREDO_ACESSO, SEGREDO_REFRESH, SEGREDO_CRIPTO };
