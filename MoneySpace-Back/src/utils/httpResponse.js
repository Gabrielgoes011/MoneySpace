// ========================================
// RESPOSTAS HTTP PADRONIZADAS
// ========================================
//
// Classe utilitária para padronizar todas as respostas HTTP da API.
//
// ─── COMO USAR ──────────────────────────────────────────────────────────────
//
// 1) Importe no controller/rota:
//      import httpResponse from '../utils/httpResponse.js';
//
// 2) Substitua os res.status(...).json(...) pelos métodos abaixo:
//
//   // ✅ SUCESSO: lista retornada (200)
//   return httpResponse.success(res, 'Usuários listados com sucesso!', usuarios);
//
//   // ✅ SUCESSO DADO CRIADO: cadastro realizado (201)
//   return httpResponse.success(res, 'Usuário cadastrado com sucesso!', novoUsuario, 201);
//
//   // ❌ VALIDAÇÃO: campo vazio, formato inválido, regra de negócio (400)
//   return httpResponse.validationError(res, 'O campo nome não pode ser vazio');
//
//   // ❌ DUPLICATA: registro já existe no banco (409)
//   return httpResponse.conflict(res, 'Usuário já cadastrado!');
//
//   // ❌ NÃO ENCONTRADO: id não existe no banco (404)
//   return httpResponse.notFound(res, 'Usuário não encontrado!');
//
//   // ❌ NÃO AUTENTICADO: token ausente ou inválido (401)
//   return httpResponse.unauthorized(res);
//
//   // ❌ SEM PERMISSÃO: autenticado mas sem acesso (403)
//   return httpResponse.forbidden(res);
//
//   // ❌ ERRO INTERNO: falha inesperada no servidor (500)
//   return httpResponse.error(res, 'Erro ao listar usuários');
//
// ─── FORMATO DO JSON RETORNADO ──────────────────────────────────────────────
//
//   Sucesso:  { "success": true,  "message": "...", "data": ... }
//   Erro:     { "success": false, "message": "..." }

class HttpResponse {

    // ── SUCESSO ──────────────────────────────────────────────────────────────
    // status padrão 200. Para retorno de criação, passar status = 201.
    static success(res, message = 'Requisição bem-sucedida', data = null, status = 200) {
        return res.status(status).json({ success: true, message, data });
    }

    // ── ERROS DO CLIENTE (4xx) ────────────────────────────────────────────────

    // Erro de validação: parâmetros incorretos ou faltantes (400)
    static validationError(res, message = 'Requisição inválida: parâmetros incorretos ou faltantes', data = null) {
        return res.status(400).json({ success: false, message, data });
    }

    // Não autenticado ou token inválido (401)
    static unauthorized(res, message = 'Não autenticado ou token inválido') {
        return res.status(401).json({ success: false, message });
    }

    // Autenticado, mas sem permissão para o recurso (403)
    static forbidden(res, message = 'Autenticado, mas sem permissão para o recurso') {
        return res.status(403).json({ success: false, message });
    }

    // Recurso não encontrado (404)
    static notFound(res, message = 'Recurso não encontrado') {
        return res.status(404).json({ success: false, message });
    }

    // Formato não suportado pelo servidor (406)
    static unacceptable(res, message = 'O servidor não pode retornar a representação no formato aceito pelo cliente') {
        return res.status(406).json({ success: false, message });
    }

    // Conflito com o estado atual do recurso, ex: duplicata (409)
    static conflict(res, message = 'Conflito com o estado atual do recurso') {
        return res.status(409).json({ success: false, message });
    }

    // ── ERRO GENÉRICO ─────────────────────────────────────────────────────────
    // Cobre tanto erros de cliente quanto de servidor dependendo do status passado.
    // Padrão: 500.
    static error(res, message = 'Erro inesperado no servidor', status = 500, data = null) {
        return res.status(status).json({ success: false, message, data });
    }
}

export default HttpResponse;
