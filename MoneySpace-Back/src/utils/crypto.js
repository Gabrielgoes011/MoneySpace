// ========================================
// CRIPTOGRAFIA SIMÉTRICA (AES-256-GCM)
// ========================================
// Usada para guardar o segredo do 2FA (TOTP) de forma cifrada na coluna
// `mfa_secreto` do banco, em vez de texto puro. Assim, mesmo que alguém leia
// a tabela, não consegue reconstruir o segredo sem a chave da aplicação.
//
// A chave vem de CRYPTO_SECRET (.env). Se não houver, cai no JWT_SECRET.
// Em produção, defina um CRYPTO_SECRET próprio e forte.

import crypto from 'crypto';

const ALGO = 'aes-256-gcm';

// Deriva uma chave de 32 bytes a partir do segredo da aplicação.
function getKey() {
  const secret = process.env.CRYPTO_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('CRYPTO_SECRET/JWT_SECRET ausente para criptografia do 2FA.');
  }
  return crypto.createHash('sha256').update(String(secret)).digest();
}

// Cifra um texto. Retorna "iv:tag:conteudo" em base64, pronto para persistir.
export function encryptText(plainText) {
  if (plainText == null) return null;

  const iv = crypto.randomBytes(12); // 96 bits, recomendado para GCM
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);

  const encrypted = Buffer.concat([
    cipher.update(String(plainText), 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [iv.toString('base64'), tag.toString('base64'), encrypted.toString('base64')].join(':');
}

// Decifra o texto gerado por encryptText. Retorna null se a entrada for vazia.
export function decryptText(payload) {
  if (!payload) return null;

  const [ivB64, tagB64, dataB64] = String(payload).split(':');
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error('Formato de dado criptografado inválido.');
  }

  const decipher = crypto.createDecipheriv(ALGO, getKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

export default { encryptText, decryptText };
