import {
    listarFamilias,
    buscarFamiliaPorId,
    criarFamilia,
    atualizarFamilia
} from './cadFamilia.Repositories.js';

//regra de negicio para cadastrar familai
async function criarFamiliaService(dados) {

    //chama o repository para criar a familia
    const familiaCriada = await criarFamilia(dados);

    //retorna a familia criada para o controller
    return familiaCriada;
}

// implementar: regra de negócio para listar famílias (chama listarFamilias do repo)
async function listarFamiliasService() {
    // implementar
    return await listarFamilias();
}

// implementar: regra de negócio para atualizar família (chama atualizarFamilia do repo)
async function atualizarFamiliaService(/* id, dados */) {
    // implementar
    throw new Error('atualizarFamiliaService ainda não implementada.');
}

export {
    criarFamiliaService,
    listarFamiliasService,
    atualizarFamiliaService
};