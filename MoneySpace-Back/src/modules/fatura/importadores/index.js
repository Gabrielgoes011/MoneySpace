// ========================================
// IMPORTADORES: REGISTRO / SELEÇÃO DE PARSER POR EMISSOR
// ========================================
// Mantém o domínio GENÉRICO (cartão → fatura → lançamento → importação): o
// módulo de fatura não conhece o Rico diretamente, pede aqui o parser do emissor.
// Novos emissores (Nubank, XP) entram neste registro sem mexer no service/repo.

import {
  parseCsvRico,
  normalizarValor,
  normalizarData,
  parseParcela,
  classificar,
} from './rico.parser.js';

// Registro de parsers por emissor (chave = coluna `emissor` de fatura_importacao).
const PARSERS = {
  RICO: {
    parseCsv: parseCsvRico,
    normalizarValor,
    normalizarData,
    parseParcela,
    classificar,
  },
};

/**
 * Retorna o conjunto de funções do parser para o emissor informado.
 * Emissor desconhecido/ausente → lança erro (o service trata como 400).
 */
export function obterParser(emissor) {
  const chave = String(emissor ?? '').trim().toUpperCase();
  const parser = PARSERS[chave];
  if (!parser) {
    throw new Error(`Emissor não suportado: ${emissor}`);
  }
  return parser;
}

/**
 * Lista os emissores suportados (útil para o front montar seleção no futuro).
 */
export function emissoresSuportados() {
  return Object.keys(PARSERS);
}
