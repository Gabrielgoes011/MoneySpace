// Status dos lançamentos da fatura. A tela usa a chave (ex.: 'na_hora');
// o banco guarda o valor com espaço (ex.: 'na hora'). Esta é a ponte entre os dois.
export const STATUS = {
  pendente: { label: 'Pendente', color: 'warning', valorBanco: 'pendente' },
  na_hora: { label: 'Na hora', color: 'success', valorBanco: 'na hora' },
  no_fechamento: { label: 'No fechamento', color: 'accent', valorBanco: 'no fechamento' },
};

// 'na hora' (banco) -> 'na_hora' (tela)
export const statusDoBanco = (valorBanco) =>
  Object.keys(STATUS).find((chave) => STATUS[chave].valorBanco === valorBanco) ?? 'pendente';
