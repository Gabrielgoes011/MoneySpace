// ========================================
// CONTROLLER: CADASTRO DE USUÁRIOS (da família)
// ========================================
// Arquitetura de 2 camadas (igual a login/família): o controller cuida de
// req/res E das regras de negócio; o SQL fica no repository. Usa `req.db`
// (transação com contexto de RLS aberta pelo rlsMiddleware, que roda DEPOIS do verificaToken).
//
// Autorização (o JWT ainda não carrega `role`): o papel de quem chama é lido do banco.
//   - listar:           qualquer membro da família
//   - criar / editar:   só ADMIN (ou master)
//   - editar um master: só outro master
//
// Regras de negócio ficam DENTRO de cada função (sem helper). Helper `_` só para
// transformação técnica. Algoritmo genérico (CPF) fica em utils/cpf.js.
// Body: sempre desestruturado em `dados` com campos explícitos (padrão do projeto).

import bcrypt from 'bcrypt';
import httpResponse from '../../../utils/httpResponse.js';
import pgErrorHandler, { CODIGO_UNIQUE_VIOLATION } from '../../../utils/pgErrorHandler.js';
import { validarCpf } from '../../../utils/cpf.js';
import {
  buscarFamiliaAtualRepository,
  listarUsuariosRepository,
  buscarUsuarioPorIdRepository,
  buscarPapelRepository,
  criarUsuarioRepository,
  atualizarUsuarioRepository,
  buscarSenhaHashRepository,
  atualizarSenhaRepository
} from './cadUsuario.Repositories.js';

//#region => Constantes
const PERFIS_VALIDOS = ['ADMIN', 'MEMBRO'];
const SENHA_TAMANHO_MINIMO = 6;
const SENHA_TAMANHO_MINIMO_TROCA = 8; // troca feita pelo próprio usuário exige mais
const SALT_ROUNDS_BCRYPT = 10;
const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
//#endregion

//#region => listar usuários da família
//resposta: { familia: {id, nome}, usuarios: [...], pode_editar: boolean }
async function listarUsuarios(req, res) {
  try {
    //1º passo: busca família, membros e o papel de quem chamou
    const [familia, usuarios, papelSolicitante] = await Promise.all([
      buscarFamiliaAtualRepository(req.db),
      listarUsuariosRepository(req.db),
      buscarPapelRepository(req.db, req.user.id)
    ]);

    //2º passo: diz se quem chamou pode editar (ADMIN da família ou dono do app)
    const podeEditar = papelSolicitante?.role === 'ADMIN' || papelSolicitante?.is_master === true;

    //retorna os resultados da consulta em formato JSON
    return httpResponse.success(res, 'Usuários listados com sucesso!', {
      familia,
      usuarios,
      pode_editar: podeEditar
    });

  } catch (error) {
    console.error('Erro ao listar usuários na etapa do controller:', error);
    const secureMessage = pgErrorHandler(error, 'Erro ao listar os usuários.');
    return httpResponse.error(res, secureMessage);
  }
}
//#endregion

//#region => cadastrar usuário
//body: { nome, cpf, email, senha, role }
async function criarUsuario(req, res) {
  try {
    //1º passo: só administrador cadastra
    const papelSolicitante = await buscarPapelRepository(req.db, req.user.id);
    const solicitanteEhAdmin = papelSolicitante?.role === 'ADMIN' || papelSolicitante?.is_master === true;

    if (!solicitanteEhAdmin) {
      return httpResponse.forbidden(res, 'Apenas administradores podem cadastrar usuários.');
    }

    //2º passo: recebe os dados do body
    const dados = {
      nome: req.body.nome,
      cpf: req.body.cpf,
      email: req.body.email,
      senha: req.body.senha,
      role: req.body.role
    };

    //3º passo: normaliza os campos recebidos
    const nomeNormalizado = String(dados.nome ?? '').trim();
    const emailNormalizado = String(dados.email ?? '').trim().toLowerCase();
    const cpfNormalizado = String(dados.cpf ?? '').replace(/\D/g, '');
    const senhaInformada = String(dados.senha ?? '');

    //4º passo: valida cada campo (todos obrigatórios no cadastro)
    if (nomeNormalizado.length < 2) {
      return httpResponse.validationError(res, 'Informe o nome (mínimo 2 letras).');
    }
    if (!REGEX_EMAIL.test(emailNormalizado)) {
      return httpResponse.validationError(res, 'Informe um e-mail válido.');
    }
    if (!validarCpf(cpfNormalizado)) {
      return httpResponse.validationError(res, 'Informe um CPF válido.');
    }
    if (!PERFIS_VALIDOS.includes(dados.role)) {
      return httpResponse.validationError(res, 'O perfil deve ser ADMIN ou MEMBRO.');
    }
    if (senhaInformada.length < SENHA_TAMANHO_MINIMO) {
      return httpResponse.validationError(res, `A senha deve ter no mínimo ${SENHA_TAMANHO_MINIMO} caracteres.`);
    }

    //5º passo: gera o hash da senha (nunca grava a senha pura)
    const senhaHash = await bcrypt.hash(senhaInformada, SALT_ROUNDS_BCRYPT);

    //6º passo: grava o usuário na família atual
    const usuarioCriado = await criarUsuarioRepository(req.db, {
      nome: nomeNormalizado,
      cpf: cpfNormalizado,
      email: emailNormalizado,
      senhaHash,
      role: dados.role
    });

    //retorna o usuário criado
    return httpResponse.success(res, 'Usuário cadastrado com sucesso!', { usuario: usuarioCriado }, 201);

  } catch (error) {
    console.error('Erro ao cadastrar usuário na etapa do controller:', error);

    //e-mail ou CPF já cadastrado -> 409
    if (error.code === CODIGO_UNIQUE_VIOLATION) {
      return httpResponse.conflict(res, 'Já existe um usuário com este e-mail ou CPF.');
    }
    const secureMessage = pgErrorHandler(error, 'Erro ao cadastrar o usuário.');
    return httpResponse.error(res, secureMessage);
  }
}
//#endregion

//#region => atualizar usuário
//params: :id; body: qualquer de { nome, cpf, email, role, senha }
//só os campos enviados são validados e alterados; `senha` só é trocada se vier preenchida
async function atualizarUsuario(req, res) {
  try {
    //1º passo: só administrador edita
    const usuarioSolicitante = await buscarPapelRepository(req.db, req.user.id);
    const solicitanteEhAdmin = usuarioSolicitante?.role === 'ADMIN' || usuarioSolicitante?.is_master === true;

    if (!solicitanteEhAdmin) {
      return httpResponse.forbidden(res, 'Apenas administradores podem editar usuários.');
    }

    //2º passo: o usuário-alvo precisa existir na família
    const { id: idUsuarioAlvo } = req.params;
    const usuarioAlvo = await buscarUsuarioPorIdRepository(req.db, idUsuarioAlvo);

    if (!usuarioAlvo) {
      return httpResponse.notFound(res, 'Usuário não encontrado.');
    }

    //3º passo: dono do app só é editado por outro dono do app
    const alvoEhDono = usuarioAlvo.is_master === true;
    const solicitanteEhDono = usuarioSolicitante.is_master === true;

    if (alvoEhDono && !solicitanteEhDono) {
      return httpResponse.forbidden(res, 'Somente o dono do app pode editar este usuário.');
    }

    //4º passo: recebe os dados do body (campo não enviado fica undefined)
    const dados = {
      nome: req.body.nome,
      cpf: req.body.cpf,
      email: req.body.email,
      role: req.body.role,
      senha: req.body.senha
    };

    //5º passo: verifica quais campos vieram
    const nomeInformado = dados.nome !== undefined;
    const emailInformado = dados.email !== undefined;
    const cpfInformado = dados.cpf !== undefined;
    const roleInformado = dados.role !== undefined;
    const senhaInformada = dados.senha !== undefined && dados.senha !== '';

    //6º passo: normaliza só o que veio
    const nomeNormalizado = nomeInformado ? String(dados.nome).trim() : undefined;
    const emailNormalizado = emailInformado ? String(dados.email).trim().toLowerCase() : undefined;
    const cpfNormalizado = cpfInformado ? String(dados.cpf).replace(/\D/g, '') : undefined;

    //7º passo: valida só o que foi informado
    if (nomeInformado && nomeNormalizado.length < 2) {
      return httpResponse.validationError(res, 'Informe o nome (mínimo 2 letras).');
    }
    if (emailInformado && !REGEX_EMAIL.test(emailNormalizado)) {
      return httpResponse.validationError(res, 'Informe um e-mail válido.');
    }
    if (cpfInformado && !validarCpf(cpfNormalizado)) {
      return httpResponse.validationError(res, 'Informe um CPF válido.');
    }
    if (roleInformado && !PERFIS_VALIDOS.includes(dados.role)) {
      return httpResponse.validationError(res, 'O perfil deve ser ADMIN ou MEMBRO.');
    }
    if (senhaInformada && String(dados.senha).length < SENHA_TAMANHO_MINIMO) {
      return httpResponse.validationError(res, `A senha deve ter no mínimo ${SENHA_TAMANHO_MINIMO} caracteres.`);
    }

    //8º passo: evita o administrador se rebaixar e perder o acesso de gestão
    const estaSeRebaixando =
      usuarioAlvo.id === req.user.id &&
      roleInformado &&
      dados.role !== 'ADMIN' &&
      !alvoEhDono;

    if (estaSeRebaixando) {
      return httpResponse.validationError(res, 'Você não pode rebaixar o seu próprio usuário.');
    }

    //9º passo: gera o hash só se a senha foi trocada
    const senhaHash = senhaInformada
      ? await bcrypt.hash(String(dados.senha), SALT_ROUNDS_BCRYPT)
      : undefined;

    //10º passo: grava só o que mudou (undefined = mantém o valor atual)
    const usuarioAtualizado = await atualizarUsuarioRepository(req.db, idUsuarioAlvo, {
      nome: nomeNormalizado,
      cpf: cpfNormalizado,
      email: emailNormalizado,
      role: roleInformado ? dados.role : undefined,
      senhaHash
    });

    //retorna o usuário atualizado
    return httpResponse.success(res, 'Usuário atualizado com sucesso!', { usuario: usuarioAtualizado });

  } catch (error) {
    console.error('Erro ao atualizar usuário na etapa do controller:', error);

    //e-mail ou CPF já cadastrado -> 409
    if (error.code === CODIGO_UNIQUE_VIOLATION) {
      return httpResponse.conflict(res, 'Já existe um usuário com este e-mail ou CPF.');
    }
    const secureMessage = pgErrorHandler(error, 'Erro ao atualizar o usuário.');
    return httpResponse.error(res, secureMessage);
  }
}
//#endregion

//#region => minha conta (dados do próprio usuário logado)
//resposta: { usuario: { id, nome, email, cpf, role, is_master, mfa_ativo, dt_cadastro } }
async function buscarMinhaConta(req, res) {
  try {
    //1º passo: busca o próprio usuário pela família atual
    const usuarioEncontrado = await buscarUsuarioPorIdRepository(req.db, req.user.id);

    if (!usuarioEncontrado) {
      return httpResponse.notFound(res, 'Usuário não encontrado.');
    }

    //retorna os dados da conta (sem senha e sem segredo do 2FA)
    return httpResponse.success(res, 'Conta carregada com sucesso!', { usuario: usuarioEncontrado }, 200);

  } catch (error) {
    console.error('Erro ao buscar a conta na etapa do controller:', error);
    const secureMessage = pgErrorHandler(error, 'Erro ao carregar sua conta.');
    return httpResponse.error(res, secureMessage);
  }
}

//body: { nome, email, cpf } (quem é membro edita os próprios dados; perfil e senha não entram aqui)
async function atualizarMinhaConta(req, res) {
  try {
    //1º passo: recebe os dados do body
    const dados = {
      nome: req.body.nome,
      email: req.body.email,
      cpf: req.body.cpf
    };

    //2º passo: normaliza (sem espaços, e-mail minúsculo, CPF só com números)
    const nomeNormalizado = String(dados.nome ?? '').trim();
    const emailNormalizado = String(dados.email ?? '').trim().toLowerCase();
    const cpfNormalizado = String(dados.cpf ?? '').replace(/\D/g, '');

    //3º passo: valida cada campo
    if (nomeNormalizado.length < 2) {
      return httpResponse.validationError(res, 'Informe o nome (mínimo 2 letras).');
    }
    if (!REGEX_EMAIL.test(emailNormalizado)) {
      return httpResponse.validationError(res, 'Informe um e-mail válido.');
    }
    if (!validarCpf(cpfNormalizado)) {
      return httpResponse.validationError(res, 'Informe um CPF válido.');
    }

    //4º passo: grava só nome, e-mail e CPF (role e senha ficam como estão)
    const usuarioAtualizado = await atualizarUsuarioRepository(req.db, req.user.id, {
      nome: nomeNormalizado,
      email: emailNormalizado,
      cpf: cpfNormalizado,
      role: undefined,
      senhaHash: undefined
    });

    if (!usuarioAtualizado) {
      return httpResponse.notFound(res, 'Usuário não encontrado.');
    }

    //retorna a conta já atualizada
    return httpResponse.success(res, 'Dados atualizados com sucesso!', { usuario: usuarioAtualizado }, 200);

  } catch (error) {
    console.error('Erro ao atualizar a conta na etapa do controller:', error);
    if (error.code === CODIGO_UNIQUE_VIOLATION) {
      return httpResponse.conflict(res, 'Já existe outro usuário com este e-mail ou CPF.');
    }
    const secureMessage = pgErrorHandler(error, 'Erro ao atualizar sua conta.');
    return httpResponse.error(res, secureMessage);
  }
}
//#endregion

//#region => trocar a senha do próprio usuário
//body: { senhaAtual, senhaNova } (qualquer membro troca a própria senha)
//a senha atual é conferida antes de gravar. Erro de senha atual vira 400 (não 401:
//o front encerra a sessão com 401 e o usuário não deve ser deslogado por errar a senha)
async function trocarMinhaSenha(req, res) {
  try {
    //1º passo: recebe os campos do body
    const dados = {
      senhaAtual: req.body.senhaAtual,
      senhaNova: req.body.senhaNova
    };

    //2º passo: os dois campos são obrigatórios
    if (!dados.senhaAtual || !dados.senhaNova) {
      return httpResponse.validationError(res, 'Informe a senha atual e a nova senha.');
    }

    //3º passo: a nova senha precisa ter tamanho mínimo e ser diferente da atual
    if (String(dados.senhaNova).length < SENHA_TAMANHO_MINIMO_TROCA) {
      return httpResponse.validationError(res, `A nova senha deve ter no mínimo ${SENHA_TAMANHO_MINIMO_TROCA} caracteres.`);
    }
    if (dados.senhaNova === dados.senhaAtual) {
      return httpResponse.validationError(res, 'A nova senha precisa ser diferente da atual.');
    }

    //4º passo: busca o hash atual de quem está logado
    const usuarioAtual = await buscarSenhaHashRepository(req.db, req.user.id);

    if (!usuarioAtual) {
      return httpResponse.notFound(res, 'Usuário não encontrado.');
    }

    //5º passo: confere a senha atual com bcrypt
    const senhaAtualConfere = await bcrypt.compare(String(dados.senhaAtual), usuarioAtual.senha);

    if (!senhaAtualConfere) {
      return httpResponse.validationError(res, 'A senha atual está incorreta.');
    }

    //6º passo: grava só o hash da nova senha (nunca a senha pura)
    const senhaHash = await bcrypt.hash(String(dados.senhaNova), SALT_ROUNDS_BCRYPT);
    await atualizarSenhaRepository(req.db, req.user.id, senhaHash);

    //retorna sucesso (a sessão continua válida)
    return httpResponse.success(res, 'Senha alterada com sucesso!', {}, 200);

  } catch (error) {
    console.error('Erro ao trocar a senha na etapa do controller:', error);
    const secureMessage = pgErrorHandler(error, 'Erro ao trocar a senha.');
    return httpResponse.error(res, secureMessage);
  }
}
//#endregion

//#region => exportação das funções
export {
  listarUsuarios,
  criarUsuario,
  atualizarUsuario,
  buscarMinhaConta,
  atualizarMinhaConta,
  trocarMinhaSenha
}
//#endregion
