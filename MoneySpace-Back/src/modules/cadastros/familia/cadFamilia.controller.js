// ========================================
// CONTROLLER: FAMÍLIAS (gestão do dono do app)
// ========================================
// Arquitetura de 2 camadas: o controller cuida de req/res E das regras de negócio; o SQL fica no repository.
// Usa `req.db` (transação com contexto de RLS aberta pelo rlsMiddleware, que roda DEPOIS do verificaToken).
//
// Autorização: só o DONO DO APP (usuario.is_master) lista e cadastra famílias.
//   - quem é master vem do BANCO (fn_master_eh_master), nunca do token
//   - o banco também recusa (erro 42501) se uma função de master for chamada por quem não é master
//   - "acesso" responde para qualquer logado se ele é master ou não (o front usa para mostrar o menu)
//
// Regras de negócio ficam DENTRO de cada função (sem helper). Body sempre em `dados`.

import bcrypt from 'bcrypt';
import httpResponse from '../../../utils/httpResponse.js';
import pgErrorHandler, { CODIGO_UNIQUE_VIOLATION } from '../../../utils/pgErrorHandler.js';
import { validarCpf } from '../../../utils/cpf.js';
import {
  verificarMasterRepository,
  listarFamiliasRepository,
  cadastrarFamiliaRepository
} from './cadFamilia.Repositories.js';

//#region => Constantes
const SENHA_TAMANHO_MINIMO = 8; // primeiro administrador de uma família nova: senha mais forte
const SALT_ROUNDS_BCRYPT = 10;
const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
//#endregion

//#region => saber se quem chamou é o dono do app
//resposta: { master: boolean }
async function verificarAcessoMaster(req, res) {
  try {
    //1º passo: o banco diz se quem chamou é master
    const ehMaster = await verificarMasterRepository(req.db);

    //retorna o resultado
    return httpResponse.success(res, 'Acesso verificado com sucesso!', { master: ehMaster });

  } catch (error) {
    console.error('Erro ao verificar o acesso master na etapa do controller:', error);
    const secureMessage = pgErrorHandler(error, 'Erro ao verificar o acesso.');
    return httpResponse.error(res, secureMessage);
  }
}
//#endregion

//#region => listar todas as famílias (só master)
//resposta: { familias: [{ id, nome, dt_cadastro, total_usuarios, total_cartoes }] }
async function listarFamilias(req, res) {
  try {
    //1º passo: só o dono do app lista as famílias
    const ehMaster = await verificarMasterRepository(req.db);

    if (!ehMaster) {
      return httpResponse.forbidden(res, 'Apenas o dono do app pode listar as famílias.');
    }

    //2º passo: busca as famílias com os totais
    const familias = await listarFamiliasRepository(req.db);

    //retorna a lista
    return httpResponse.success(res, 'Famílias listadas com sucesso!', { familias });

  } catch (error) {
    console.error('Erro ao listar famílias na etapa do controller:', error);
    const secureMessage = pgErrorHandler(error, 'Erro ao listar as famílias.');
    return httpResponse.error(res, secureMessage);
  }
}
//#endregion

//#region => cadastrar família com o primeiro administrador (só master)
//body: { nome, adminNome, adminCpf, adminEmail, adminSenha }
async function cadastrarFamilia(req, res) {
  try {
    //1º passo: só o dono do app cadastra famílias
    const ehMaster = await verificarMasterRepository(req.db);

    if (!ehMaster) {
      return httpResponse.forbidden(res, 'Apenas o dono do app pode cadastrar famílias.');
    }

    //2º passo: recebe os dados do body
    const dados = {
      nome: req.body.nome,
      adminNome: req.body.adminNome,
      adminCpf: req.body.adminCpf,
      adminEmail: req.body.adminEmail,
      adminSenha: req.body.adminSenha
    };

    //3º passo: normaliza os campos recebidos
    const nomeFamilia = String(dados.nome ?? '').trim();
    const nomeAdmin = String(dados.adminNome ?? '').trim();
    const emailAdmin = String(dados.adminEmail ?? '').trim().toLowerCase();
    const cpfAdmin = String(dados.adminCpf ?? '').replace(/\D/g, '');
    const senhaAdmin = String(dados.adminSenha ?? '');

    //4º passo: valida cada campo (todos obrigatórios)
    if (nomeFamilia.length < 2) {
      return httpResponse.validationError(res, 'Informe o nome da família (mínimo 2 letras).');
    }
    if (nomeAdmin.length < 2) {
      return httpResponse.validationError(res, 'Informe o nome do administrador (mínimo 2 letras).');
    }
    if (!REGEX_EMAIL.test(emailAdmin)) {
      return httpResponse.validationError(res, 'Informe um e-mail válido para o administrador.');
    }
    if (!validarCpf(cpfAdmin)) {
      return httpResponse.validationError(res, 'Informe um CPF válido para o administrador.');
    }
    if (senhaAdmin.length < SENHA_TAMANHO_MINIMO) {
      return httpResponse.validationError(res, `A senha deve ter no mínimo ${SENHA_TAMANHO_MINIMO} caracteres.`);
    }

    //5º passo: gera o hash da senha (nunca grava a senha pura)
    const senhaHash = await bcrypt.hash(senhaAdmin, SALT_ROUNDS_BCRYPT);

    //6º passo: cria a família e o administrador na mesma chamada (ou nada, se algo falhar)
    const idsCriados = await cadastrarFamiliaRepository(req.db, {
      nome: nomeFamilia,
      adminNome: nomeAdmin,
      adminCpf: cpfAdmin,
      adminEmail: emailAdmin,
      adminSenhaHash: senhaHash
    });

    //retorna os dados da família criada (sem senha)
    return httpResponse.success(res, 'Família cadastrada com sucesso!', {
      familia: { id: idsCriados.nova_familia_id, nome: nomeFamilia },
      admin: { id: idsCriados.novo_usuario_id, nome: nomeAdmin, email: emailAdmin }
    }, 201);

  } catch (error) {
    console.error('Erro ao cadastrar a família na etapa do controller:', error);

    //e-mail ou CPF do administrador já existe em outra família -> 409
    if (error.code === CODIGO_UNIQUE_VIOLATION) {
      return httpResponse.conflict(res, 'Já existe um usuário com este e-mail ou CPF.');
    }
    const secureMessage = pgErrorHandler(error, 'Erro ao cadastrar a família.');
    return httpResponse.error(res, secureMessage);
  }
}
//#endregion

//#region => exportação das funções
export {
  verificarAcessoMaster,
  listarFamilias,
  cadastrarFamilia
};
//#endregion
