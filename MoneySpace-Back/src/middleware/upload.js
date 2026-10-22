// ========================================
// MIDDLEWARE: UPLOAD DE CSV (multer em memória)
// ========================================
// Recebe o CSV da fatura via multipart/form-data e o entrega em memória
// (req.file.buffer), sem gravar em disco. O parser e o hash de idempotência
// (sha256 do buffer) trabalham direto sobre esse buffer.
//
// Ordem nas rotas de importação:
//   verificaToken -> rlsMiddleware -> uploadCsv.single('arquivo') -> controller
// O campo do arquivo no form é `arquivo`.

import multer from 'multer';
import httpResponse from '../utils/httpResponse.js';

// Tamanho máximo (~2 MB). Fatura mensal é texto puro; não precisa mais que isso.
const LIMITE_TAMANHO_BYTES = 2 * 1024 * 1024;

// MIME types que um CSV costuma chegar (varia por navegador/SO).
const MIMETYPES_CSV_ACEITOS = new Set([
  'text/csv',
  'text/plain',
  'application/vnd.ms-excel',
  'application/csv',
  'application/octet-stream', // alguns navegadores/SO marcam assim
]);

// Extensões aceitas como dica adicional (não é fonte da verdade sozinha).
const EXTENSOES_ACEITAS = /\.(csv|txt)$/i;

const storage = multer.memoryStorage();

// Primeira barreira: aceita por mimetype OU extensão .csv/.txt. A validação de
// conteúdo real (cabeçalho do Rico, TAB) acontece no parser, sobre o buffer.
function fileFilter(req, file, cb) {
  const mimeOk = MIMETYPES_CSV_ACEITOS.has((file.mimetype || '').toLowerCase());
  const extOk = EXTENSOES_ACEITAS.test(file.originalname || '');
  if (mimeOk || extOk) {
    return cb(null, true);
  }
  // Rejeição com erro de tipo -> tratado no middleware de erro abaixo (400).
  const erro = new Error('Tipo de arquivo inválido. Envie um CSV.');
  erro.code = 'ARQUIVO_TIPO_INVALIDO';
  return cb(erro);
}

const uploadCsv = multer({
  storage,
  limits: { fileSize: LIMITE_TAMANHO_BYTES },
  fileFilter,
});

/**
 * Envolve `uploadCsv.single('arquivo')` para traduzir os erros do multer em
 * respostas 400 padronizadas (limite de tamanho, tipo inválido), em vez de
 * estourar para o handler genérico de erro. Use isto nas rotas de importação.
 */
function uploadCsvSingle(campo = 'arquivo') {
  const mw = uploadCsv.single(campo);
  return (req, res, next) => {
    mw(req, res, (err) => {
      if (!err) return next();
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return httpResponse.error(res, 'Arquivo acima do limite de 2 MB.', 400);
        }
        return httpResponse.error(res, `Falha no upload: ${err.message}`, 400);
      }
      if (err.code === 'ARQUIVO_TIPO_INVALIDO') {
        return httpResponse.error(res, err.message, 400);
      }
      return httpResponse.error(res, 'Falha ao processar o arquivo enviado.', 400);
    });
  };
}

export { uploadCsv, uploadCsvSingle };
