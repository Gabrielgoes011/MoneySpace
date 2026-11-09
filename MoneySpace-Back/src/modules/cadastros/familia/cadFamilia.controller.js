// ========================================
// CONTROLLER: FAMÍLIA
// ========================================
// Arquitetura de 2 camadas: o controller cuida de req/res E da lógica.
// As queries ficam no repository.

import httpResponse from '../../../utils/httpResponse.js';
import pgErrorHandler from '../../../utils/pgErrorHandler.js';
import {
  listarFamilias,
  criarFamilia,
  atualizarFamilia,
} from './cadFamilia.Repositories.js';

// Cria uma família. body: { nome }
async function criarFamiliaController(req, res) {
  try {
    const nome = req.body?.nome?.trim();
    if (!nome) {
      return httpResponse.validationError(res, 'O nome da família é obrigatório.');
    }

    const familia = await criarFamilia({ nome });
    return httpResponse.success(res, 'Família criada com sucesso.', { familia }, 201);
  } catch (error) {
    console.error('Erro ao criar família na etapa do controller:', error);
    return httpResponse.error(res, pgErrorHandler(error, 'Não foi possível criar a família.'), 500);
  }
}

// Lista as famílias.
async function listarFamiliasController(req, res) {
  try {
    const familias = await listarFamilias();
    return httpResponse.success(res, 'Famílias listadas com sucesso.', { familias }, 200);
  } catch (error) {
    console.error('Erro ao listar famílias na etapa do controller:', error);
    return httpResponse.error(res, pgErrorHandler(error, 'Não foi possível listar as famílias.'), 500);
  }
}

// Atualiza o nome de uma família. params: :id, body: { nome }
async function atualizarFamiliaController(req, res) {
  try {
    const { id } = req.params;
    const nome = req.body?.nome?.trim();
    if (!nome) {
      return httpResponse.validationError(res, 'O nome da família é obrigatório.');
    }

    const familia = await atualizarFamilia(id, { nome });
    if (!familia) {
      return httpResponse.notFound(res, 'Família não encontrada.');
    }

    return httpResponse.success(res, 'Família atualizada com sucesso.', { familia }, 200);
  } catch (error) {
    console.error('Erro ao atualizar família na etapa do controller:', error);
    return httpResponse.error(res, pgErrorHandler(error, 'Não foi possível atualizar a família.'), 500);
  }
}

export {
  criarFamiliaController,
  listarFamiliasController,
  atualizarFamiliaController,
};
