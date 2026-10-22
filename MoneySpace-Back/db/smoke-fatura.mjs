// =====================================================================
// SMOKE TEST (Node) — fluxo autenticado de fatura da FAMÍLIA A (Task 22)
// =====================================================================
// Roda o fluxo ponta a ponta contra o backend de desenvolvimento. Usa apenas
// APIs nativas do Node 18+ (fetch, FormData, Blob) — sem dependências.
//
// PRÉ-CONDIÇÕES (ver db/smoke-fatura.md): backend de fatura implementado
// (Gabriel), `npm install multer`, migration-03 aplicada, seed com usuário +
// conta CREDITO. Enquanto o backend for esqueleto, os passos falham de propósito.
//
// NÃO hardcode segredos: tudo vem de variáveis de ambiente.
//   SMOKE_EMAIL     email do usuário da família A
//   SMOKE_SENHA     senha (ambiente de desenvolvimento)
//   SMOKE_ID_CONTA  uuid de uma conta tipo CREDITO da família A
//   SMOKE_BASE_URL  (opcional) default http://localhost:3000/api
//   SMOKE_COMPETENCIA (opcional) default 2026-10-01
//
// Uso:
//   cd MoneySpace-Back
//   SMOKE_EMAIL=... SMOKE_SENHA=... SMOKE_ID_CONTA=... node db/smoke-fatura.mjs
// =====================================================================

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:3000/api';
const EMAIL = process.env.SMOKE_EMAIL;
const SENHA = process.env.SMOKE_SENHA;
const ID_CONTA = process.env.SMOKE_ID_CONTA;
const COMPETENCIA = process.env.SMOKE_COMPETENCIA || '2026-10-01';
const CSV_PATH = join(__dirname, 'smoke-fatura-exemplo-rico.csv');

if (!EMAIL || !SENHA || !ID_CONTA) {
  console.error(
    'Faltam variáveis de ambiente. Defina SMOKE_EMAIL, SMOKE_SENHA e SMOKE_ID_CONTA.\n' +
    'Ex.: SMOKE_EMAIL=... SMOKE_SENHA=... SMOKE_ID_CONTA=... node db/smoke-fatura.mjs'
  );
  process.exit(2);
}

let token = null;
const resultados = [];

// Marca um passo PASS/FAIL comparando o status recebido com o(s) esperado(s).
function registrar(passo, status, esperado, extra = '') {
  const esperados = Array.isArray(esperado) ? esperado : [esperado];
  const ok = esperados.includes(status);
  resultados.push({ passo, status, esperado: esperados.join('|'), ok });
  const tag = ok ? 'PASS' : 'FAIL';
  console.log(`[${tag}] ${passo} -> ${status} (esperado ${esperados.join('|')}) ${extra}`);
  return ok;
}

function authHeaders(extra = {}) {
  return token ? { Authorization: `Bearer ${token}`, ...extra } : { ...extra };
}

// Lê o corpo como JSON com tolerância a respostas não-JSON (ex.: erro de proxy).
async function corpo(resp) {
  try { return await resp.json(); } catch { return null; }
}

// Monta um multipart com o CSV de exemplo no campo "arquivo".
async function formComCsv() {
  const buf = await readFile(CSV_PATH);
  const form = new FormData();
  form.append('arquivo', new Blob([buf], { type: 'text/csv' }), 'smoke-fatura-exemplo-rico.csv');
  return form;
}

async function run() {
  console.log(`Base: ${BASE}`);
  console.log(`Conta CREDITO: ${ID_CONTA} | competência: ${COMPETENCIA}\n`);

  // 1) Login família A
  let resp = await fetch(`${BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, senha: SENHA }),
  });
  let body = await corpo(resp);
  registrar('1. login', resp.status, 200);
  token = body?.data?.token || null;
  if (!token) {
    console.error('Sem token no login — abortando (demais passos dependem disto).');
    return resumo();
  }

  // 2) Criar competência
  resp = await fetch(`${BASE}/faturas`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ id_conta: ID_CONTA, competencia: COMPETENCIA }),
  });
  body = await corpo(resp);
  registrar('2. criar fatura', resp.status, 201);
  const idFatura = body?.data?.fatura?.id;
  if (!idFatura) {
    console.error('Sem id de fatura — abortando.');
    return resumo();
  }

  // 3) Preview da importação
  resp = await fetch(`${BASE}/faturas/${idFatura}/importacoes/preview`, {
    method: 'POST', headers: authHeaders(), body: await formComCsv(),
  });
  body = await corpo(resp);
  const qtdValidas = body?.data?.linhas_validas?.length ?? '?';
  registrar('3. preview', resp.status, 200, `linhas_validas=${qtdValidas}`);

  // 4) Confirmar importação
  resp = await fetch(`${BASE}/faturas/${idFatura}/importacoes`, {
    method: 'POST', headers: authHeaders(), body: await formComCsv(),
  });
  registrar('4. importar', resp.status, 201);

  // 5) Reimportar o mesmo arquivo -> 409 (idempotência por hash)
  resp = await fetch(`${BASE}/faturas/${idFatura}/importacoes`, {
    method: 'POST', headers: authHeaders(), body: await formComCsv(),
  });
  registrar('5. reimportar (duplicado)', resp.status, 409);

  // 6) Dashboard (antes da reserva: espera-se DEFICIT)
  resp = await fetch(`${BASE}/faturas/${idFatura}/dashboard`, { headers: authHeaders() });
  body = await corpo(resp);
  const conf1 = body?.data?.resumo?.status_conferencia ?? '?';
  registrar('6. dashboard (pré-reserva)', resp.status, 200, `status_conferencia=${conf1}`);

  // 7) Atualizar reserva (cobre a meta) e reconferir
  resp = await fetch(`${BASE}/faturas/${idFatura}/reserva`, {
    method: 'PATCH',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ saldo_reserva_declarado: '5000.00' }),
  });
  registrar('7. atualizar reserva', resp.status, 200);

  resp = await fetch(`${BASE}/faturas/${idFatura}/dashboard`, { headers: authHeaders() });
  body = await corpo(resp);
  const conf2 = body?.data?.resumo?.status_conferencia ?? '?';
  registrar('7b. dashboard (pós-reserva)', resp.status, 200, `status_conferencia=${conf2}`);

  // 8) Listar transações
  resp = await fetch(`${BASE}/faturas/${idFatura}/transacoes?sort=dt_compra:desc&page=1`, {
    headers: authHeaders(),
  });
  body = await corpo(resp);
  const transacoes = body?.data?.transacoes ?? [];
  registrar('8. listar transações', resp.status, 200, `total=${body?.data?.total ?? transacoes.length}`);

  // 9) Editar o status de uma transação à vista (pendente -> na hora)
  const alvo = transacoes.find((t) => t.status_liquidacao === 'pendente') || transacoes[0];
  if (alvo?.id) {
    resp = await fetch(`${BASE}/faturas/${idFatura}/transacoes/${alvo.id}`, {
      method: 'PATCH',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ status_liquidacao: 'na hora' }),
    });
    registrar('9. editar status transação', resp.status, 200);
  } else {
    console.log('[SKIP] 9. editar status — nenhuma transação retornada');
  }

  // 10) Fechar fatura
  resp = await fetch(`${BASE}/faturas/${idFatura}/fechamento`, {
    method: 'POST', headers: authHeaders(),
  });
  body = await corpo(resp);
  registrar('10. fechar', resp.status, 200, `status=${body?.data?.fatura?.status ?? '?'}`);

  // 11) Mutar fatura fechada -> 409
  resp = await fetch(`${BASE}/faturas/${idFatura}/reserva`, {
    method: 'PATCH',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ saldo_reserva_declarado: '100.00' }),
  });
  registrar('11. mutar fatura fechada', resp.status, 409);

  return resumo();
}

function resumo() {
  const falhas = resultados.filter((r) => !r.ok).length;
  console.log('\n==================== RESUMO ====================');
  for (const r of resultados) {
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.passo}  (${r.status} / esperado ${r.esperado})`);
  }
  console.log('===============================================');
  console.log(falhas === 0
    ? `TODOS OS ${resultados.length} PASSOS OK`
    : `${falhas}/${resultados.length} PASSO(S) FALHARAM`);
  console.log('Isolamento de tenant (família B): usar os passos 12-18 de smoke-fatura.http.');
  process.exit(falhas === 0 ? 0 : 1);
}

run().catch((err) => {
  console.error('\nErro ao executar o smoke test:', err?.message || err);
  console.error('O backend está no ar em ' + BASE + '? (cd MoneySpace-Back && npm run dev)');
  process.exit(1);
});
