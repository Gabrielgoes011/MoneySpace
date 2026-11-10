// ========================================
// CONTROLLER: CADASTRO DE USUÁRIOS (da família)
// ========================================
// Arquitetura de 2 camadas (igual a login/família): o controller cuida de
// req/res E da lógica; o SQL fica no repository. Usa `req.db` (transação com
// contexto de RLS aberta pelo rlsMiddleware, que roda DEPOIS do verificaToken).
//
// Autorização (o JWT ainda não carrega `role`): o papel de quem chama é lido do
// banco a cada request.
//   - listar:           qualquer membro da família
//   - criar / editar:   só ADMIN (ou master)
//   - editar um master: só outro master
//
// Convenção: todo helper interno começa com "_" e NÃO é exportado.

import bcrypt from 'bcrypt';
import httpResponse from '../../../utils/httpResponse.js';
import pgErrorHandler from '../../../utils/pgErrorHandler.js';
import {
  buscarFamiliaAtualRepository,
  listarUsuariosRepository,
  buscarUsuarioPorIdRepository,
  buscarPapelRepository,
  criarUsuarioRepository,
  atualizarUsuarioRepository
} from './cadUsuario.Repositories.js';

//#region => Constantes
const PERFIS_VALIDOS = ['ADMIN', 'MEMBRO'];
const SENHA_TAMANHO_MINIMO = 6;
const SALT_ROUNDS_BCRYPT = 10;
const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

//código do Postgres para violação de UNIQUE (e-mail ou CPF repetido)
const PG_UNIQUE_VIOLATION = '23505';
//#endregion

//#region => Helpers: normalização
//nome sem espaços nas pontas
function _normalizarNome(valor) {
  return String(valor ?? '').trim();
}

//e-mail sem espaços e em minúsculas (login é case-insensitive)
function _normalizarEmail(valor) {
  return String(valor ?? '').trim().toLowerCase();
}

//CPF só com dígitos (remove pontos, traço e espaços)
function _normalizarCpf(valor) {
  return String(valor ?? '').replace(/\D/g, '');
}

//gera o hash bcrypt da senha (nunca grava a senha pura)
async function _gerarHashSenha(senha) {
  return bcrypt.hash(String(senha), SALT_ROUNDS_BCRYPT);
}
//#endregion

//#region => Helpers: validação
//calcula um dígito verificador do CPF
//`quantidadeDigitosBase` = 9 para o 1º dígito e 10 para o 2º
function _calcularDigitoCpf(cpf, quantidadeDigitosBase) {
  let soma = 0;

  for (let posicao = 0; posicao < quantidadeDigitosBase; posicao += 1) {
    const peso = quantidadeDigitosBase + 1 - posicao;
    soma += Number(cpf[posicao]) * peso;
  }

  const resto = (soma * 10) % 11;
  return resto === 10 ? 0 : resto;
}

//CPF válido = 11 dígitos, não repetidos (ex.: 111.111.111-11) e com os dois
//dígitos verificadores corretos. Espera o CPF já normalizado
function _cpfValido(cpf) {
  const temOnzeDigitos = /^\d{11}$/.test(cpf);
  const todosIguais = /^(\d)\1{10}$/.test(cpf);
  if (!temOnzeDigitos || todosIguais) return false;

  const primeiroDigitoOk = _calcularDigitoCpf(cpf, 9) === Number(cpf[9]);
  const segundoDigitoOk = _calcularDigitoCpf(cpf, 10) === Number(cpf[10]);

  return primeiroDigitoOk && segundoDigitoOk;
}

//valida os campos do usuário. Devolve a mensagem de erro ou null se tudo ok
//`ehEdicao` = true no PUT: só valida os campos que vieram no body
function _validarCampos(dadosUsuario, ehEdicao) {
  const _campoFoiInformado = (campo) => dadosUsuario[campo] !== undefined;

  //nome
  if (!ehEdicao || _campoFoiInformado('nome')) {
    const nome = _normalizarNome(dadosUsuario.nome);
    if (nome.length < 2) return 'Informe o nome (mínimo 2 letras).';
  }

  //e-mail
  if (!ehEdicao || _campoFoiInformado('email')) {
    const email = _normalizarEmail(dadosUsuario.email);
    if (!REGEX_EMAIL.test(email)) return 'Informe um e-mail válido.';
  }

  //CPF
  if (!ehEdicao || _campoFoiInformado('cpf')) {
    const cpf = _normalizarCpf(dadosUsuario.cpf);
    if (!_cpfValido(cpf)) return 'Informe um CPF válido.';
  }

  //perfil (role)
  if (!ehEdicao || _campoFoiInformado('role')) {
    if (!PERFIS_VALIDOS.includes(dadosUsuario.role)) return 'O perfil deve ser ADMIN ou MEMBRO.';
  }

  //senha: obrigatória no cadastro; na edição só valida se veio preenchida
  const senhaFoiPreenchida = _campoFoiInformado('senha') && dadosUsuario.senha !== '';
  if (!ehEdicao || senhaFoiPreenchida) {
    const senha = String(dadosUsuario.senha ?? '');
    if (senha.length < SENHA_TAMANHO_MINIMO) {
      return `A senha deve ter no mínimo ${SENHA_TAMANHO_MINIMO} caracteres.`;
    }
  }

  return null;
}
//#endregion

//#region => Helpers: autorização
//o papel informado tem poder de administração? (ADMIN da família ou master)
function _podeAdministrar(papel) {
  return !!papel && (papel.role === 'ADMIN' || papel.is_master);
}

//exige que quem chama seja administrador
//devolve o papel dele (para uso posterior) ou null se não for admin
async function _exigirAdmin(req) {
  const papelSolicitante = await buscarPapelRepository(req.db, req.user.id);
  return _podeAdministrar(papelSolicitante) ? papelSolicitante : null;
}
//#endregion

//#region => listar usuários da família
//resposta: { familia: {id, nome}, usuarios: [...], pode_editar: boolean }
async function listarUsuarios(req, res) {
  try {
    //busca família, membros e o papel de quem chamou
    const [familia, usuarios, papelSolicitante] = await Promise.all([
      buscarFamiliaAtualRepository(req.db),
      listarUsuariosRepository(req.db),
      buscarPapelRepository(req.db, req.user.id)
    ]);

    //retorna os resultados da consulta em formato JSON
    return httpResponse.success(res, 'Usuários listados com sucesso!', {
      familia,
      usuarios,
      pode_editar: _podeAdministrar(papelSolicitante)
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
    if (!(await _exigirAdmin(req))) {
      return httpResponse.forbidden(res, 'Apenas administradores podem cadastrar usuários.');
    }

    //2º passo: valida o que veio no body
    const dadosUsuario = req.body ?? {};
    const mensagemDeErro = _validarCampos(dadosUsuario, false);
    if (mensagemDeErro) return httpResponse.validationError(res, mensagemDeErro);

    //3º passo: normaliza e grava (senha sempre como hash)
    const usuarioCriado = await criarUsuarioRepository(req.db, {
      nome: _normalizarNome(dadosUsuario.nome),
      cpf: _normalizarCpf(dadosUsuario.cpf),
      email: _normalizarEmail(dadosUsuario.email),
      senhaHash: await _gerarHashSenha(dadosUsuario.senha),
      role: dadosUsuario.role
    });

    //retorna o usuário criado
    return httpResponse.success(res, 'Usuário cadastrado com sucesso!', { usuario: usuarioCriado }, 201);

  } catch (error) {
    console.error('Erro ao cadastrar usuário na etapa do controller:', error);

    //e-mail ou CPF já cadastrado -> 409
    if (error.code === PG_UNIQUE_VIOLATION) {
      return httpResponse.conflict(res, 'Já existe um usuário com este e-mail ou CPF.');
    }
    const secureMessage = pgErrorHandler(error, 'Erro ao cadastrar o usuário.');
    return httpResponse.error(res, secureMessage);
  }
}
//#endregion

//#region => atualizar usuário
//params: :id; body: qualquer de { nome, cpf, email, role, senha }
//`senha` só é trocada se vier preenchida
async function atualizarUsuario(req, res) {
  try {
    //1º passo: só administrador edita
    const usuarioSolicitante = await _exigirAdmin(req);
    if (!usuarioSolicitante) {
      return httpResponse.forbidden(res, 'Apenas administradores podem editar usuários.');
    }

    //2º passo: o usuário-alvo precisa existir na família
    const { id: idUsuarioAlvo } = req.params;
    const usuarioAlvo = await buscarUsuarioPorIdRepository(req.db, idUsuarioAlvo);
    if (!usuarioAlvo) return httpResponse.notFound(res, 'Usuário não encontrado.');

    //3º passo: master só é editado por outro master
    if (usuarioAlvo.is_master && !usuarioSolicitante.is_master) {
      return httpResponse.forbidden(res, 'Somente o dono do app pode editar este usuário.');
    }

    //4º passo: valida o que veio no body (só os campos informados)
    const dadosUsuario = req.body ?? {};
    const mensagemDeErro = _validarCampos(dadosUsuario, true);
    if (mensagemDeErro) return httpResponse.validationError(res, mensagemDeErro);

    //5º passo: evita o administrador se rebaixar e perder o acesso de gestão
    const estaSeAutoRebaixando =
      usuarioAlvo.id === req.user.id &&
      dadosUsuario.role &&
      dadosUsuario.role !== 'ADMIN' &&
      !usuarioAlvo.is_master;
    if (estaSeAutoRebaixando) {
      return httpResponse.validationError(res, 'Você não pode rebaixar o seu próprio usuário.');
    }

    //6º passo: normaliza só o que veio (undefined = não altera a coluna)
    const usuarioAtualizado = await atualizarUsuarioRepository(req.db, idUsuarioAlvo, {
      nome: dadosUsuario.nome !== undefined ? _normalizarNome(dadosUsuario.nome) : undefined,
      cpf: dadosUsuario.cpf !== undefined ? _normalizarCpf(dadosUsuario.cpf) : undefined,
      email: dadosUsuario.email !== undefined ? _normalizarEmail(dadosUsuario.email) : undefined,
      role: dadosUsuario.role,
      senhaHash: dadosUsuario.senha ? await _gerarHashSenha(dadosUsuario.senha) : undefined
    });

    //retorna o usuário atualizado
    return httpResponse.success(res, 'Usuário atualizado com sucesso!', { usuario: usuarioAtualizado });

  } catch (error) {
    console.error('Erro ao atualizar usuário na etapa do controller:', error);

    //e-mail ou CPF já cadastrado -> 409
    if (error.code === PG_UNIQUE_VIOLATION) {
      return httpResponse.conflict(res, 'Já existe um usuário com este e-mail ou CPF.');
    }
    const secureMessage = pgErrorHandler(error, 'Erro ao atualizar o usuário.');
    return httpResponse.error(res, secureMessage);
  }
}
//#endregion

//#region => exportação das funções
export {
  listarUsuarios,
  criarUsuario,
  atualizarUsuario
}
//#endregion
