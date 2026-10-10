import httpResponse from '../../../utils/httpResponse.js';
import pgErrorHandler from '../../../utils/pgErrorHandler.js';
import {
  listarFamiliasService,
  criarFamiliaService,
  // atualizarFamiliaService, // implementar: usar quando criar o endpoint de edição
} from './cadFamilia.service.js';

//Função para cadastro de familia
async function criarFamiliaController(req, res) {
  try {

    //manda o body
    const dadosFamilia = {
        nome: req.body.nome,
    };

    //chama o service para criar a familia
    const familiaCriada = await criarFamiliaService(dadosFamilia);

    //retorna para o front
    return httpResponse.success
        (res, 'Família criada com sucesso', { familia: familiaCriada }, 201);

  } catch (error) {

    console.log('Erro ao criar família na etapa de controller:', error);

    //trata o erro do postgres e retorna para o front
    return httpResponse.error(res, pgErrorHandler(error), 500);
  }
}

// Lista as famílias (usada por GET /familias).
async function listarFamiliasController(req, res) {
  try {
    const familias = await listarFamiliasService();
    return httpResponse.success(res, 'Famílias listadas com sucesso', { familias }, 200);
  } catch (error) {
    console.log('Erro ao listar famílias na etapa de controller:', error);
    return httpResponse.error(res, pgErrorHandler(error), 500);
  }
}

export {
  criarFamiliaController,
  listarFamiliasController,
};