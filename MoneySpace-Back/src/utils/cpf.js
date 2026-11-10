// ========================================
// UTILITÁRIO: CPF
// ========================================
// Função técnica e genérica (não conhece o domínio): confere o CPF pelos dígitos
// verificadores. Recebe o CPF já só com números (a normalização fica no controller).

//#region => Helpers internos
//calcula um dígito verificador
//`quantidadeDigitosBase` = 9 para o 1º dígito e 10 para o 2º
function _calcularDigitoVerificador(cpf, quantidadeDigitosBase) {
  let soma = 0;

  //1º passo: soma cada dígito multiplicado pelo peso decrescente
  for (let posicao = 0; posicao < quantidadeDigitosBase; posicao += 1) {
    const peso = quantidadeDigitosBase + 1 - posicao;
    soma += Number(cpf[posicao]) * peso;
  }

  //2º passo: resto da divisão por 11 (resto 10 vira 0)
  const resto = (soma * 10) % 11;
  return resto === 10 ? 0 : resto;
}
//#endregion

//#region => validar cpf
//11 dígitos, não todos iguais (ex.: 111.111.111-11) e com os dois dígitos verificadores corretos
function validarCpf(cpf) {
  //1º passo: formato básico
  const temOnzeDigitos = /^\d{11}$/.test(cpf);
  const todosIguais = /^(\d)\1{10}$/.test(cpf);
  if (!temOnzeDigitos || todosIguais) return false;

  //2º passo: confere os dois dígitos verificadores
  const primeiroDigitoCorreto = _calcularDigitoVerificador(cpf, 9) === Number(cpf[9]);
  const segundoDigitoCorreto = _calcularDigitoVerificador(cpf, 10) === Number(cpf[10]);

  return primeiroDigitoCorreto && segundoDigitoCorreto;
}
//#endregion

//#region => exportação das funções
export { validarCpf };
//#endregion
