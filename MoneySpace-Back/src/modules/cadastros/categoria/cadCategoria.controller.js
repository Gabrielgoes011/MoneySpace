// ========================================
// CONTROLLER: CADASTRO DE CATEGORIAS
// ========================================
// Arquitetura de 2 camadas: o controller cuida de req/res E da lógica; o SQL
// fica no repository. Categoria = linha da tabela GLOBAL `utilitario`
// com tipo = 'categoria' (vale para todas as famílias).
//
// Autorização (o JWT ainda não carrega `role`): o papel é lido do banco.
//   - listar: qualquer membro da família
//   - criar:  só o dono do app (is_master), porque a tabela é global
//
// Valor sempre gravado em minúsculo, sem espaços sobrando.
// Convenção: todo helper interno começa com "_" e NÃO é exportado. Helper só existe
// se for usado mais de uma vez; uso único fica inline dentro da função.

import httpResponse from '../../../utils/httpResponse.js';
import pgErrorHandler from '../../../utils/pgErrorHandler.js';
import { buscarPapelRepository } from '../usuario/cadUsuario.Repositories.js';
import {
  listarCategoriasRepository,
  criarCategoriaRepository
} from './cadCategoria.Repositories.js';

//#region => Constantes
//código do Postgres para violação de UNIQUE (categoria repetida)
const PG_UNIQUE_VIOLATION = '23505';
//#endregion

//#region => Helpers
//o papel informado é de dono do app? (usado em listar e cadastrar)
function _ehMaster(papel) {
  return !!papel && papel.is_master === true;
}
//#endregion

//#region => listar categorias
//resposta: { categorias: [...], pode_editar: boolean }
async function listarCategorias(req, res) {
  try {
    //busca as categorias e o papel de quem chamou
    const [
      categorias,
      papelSolicitante
    ] = await Promise.all([
      listarCategoriasRepository(req.db, 'categoria'),
      buscarPapelRepository(req.db, req.user.id)
    ]);

    //retorna os resultados da consulta em formato JSON
    return httpResponse.success(res, 'Categorias listadas com sucesso!', {
      categorias,
      pode_editar: _ehMaster(papelSolicitante)
    });

  } catch (error) {
    console.error('Erro ao listar categorias na etapa do controller:', error);
    const secureMessage = pgErrorHandler(error, 'Erro ao listar as categorias.');
    return httpResponse.error(res, secureMessage);
  }
}
//#endregion

//#region => cadastrar categoria
//body: { valor }
async function criarCategoria(req, res) {
  try {
    //1º passo: só o dono do app cadastra (a tabela é global)
    const papelSolicitante = await buscarPapelRepository(req.db, req.user.id);

    if (!_ehMaster(papelSolicitante)) {
      return httpResponse.forbidden(res, 'Apenas o dono do app pode cadastrar categorias.');
    }

    //2º passo: normaliza (minúsculo, sem espaços sobrando) e valida o tamanho
    const valor = String(req.body?.valor ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

    if (valor.length < 2) {
      return httpResponse.validationError(res, 'Informe a categoria (mínimo 2 caracteres).');
    }
    if (valor.length > 50) {
      return httpResponse.validationError(res, 'A categoria deve ter no máximo 50 caracteres.');
    }

    //3º passo: grava a categoria
    const categoriaCriada = await criarCategoriaRepository(req.db, 'categoria', valor);

    //retorna a categoria criada
    return httpResponse.success(res, 'Categoria cadastrada com sucesso!', { categoria: categoriaCriada }, 201);

  } catch (error) {
    console.error('Erro ao cadastrar categoria na etapa do controller:', error);

    //categoria já cadastrada -> 409
    if (error.code === PG_UNIQUE_VIOLATION) {
      return httpResponse.conflict(res, 'Esta categoria já está cadastrada.');
    }
    const secureMessage = pgErrorHandler(error, 'Erro ao cadastrar a categoria.');
    return httpResponse.error(res, secureMessage);
  }
}
//#endregion

//#region => exportação das funções
export {
  listarCategorias,
  criarCategoria
}
//#endregion
