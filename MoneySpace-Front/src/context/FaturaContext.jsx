// Estado compartilhado da fatura (mock): edições de status/saldo/fechamento,
// para Dashboard e Faturas enxergarem os mesmos números.
import { createContext, useContext, useMemo, useState } from 'react';
import { FATURAS } from '../mocks/faturaMock';

const FaturaContext = createContext();

export function FaturaProvider({ children }) {
  const [edicoes, setEdicoes] = useState({});

  const value = useMemo(() => {
    const mudar = (chave, patch) => setEdicoes((e) => ({ ...e, [chave]: { ...e[chave], ...patch } }));

    // Devolve a fatura "viva" (mock + edições) de uma chave "cartao:competencia".
    const obter = (chave) => {
      const base = FATURAS[chave];
      if (!base) return null;
      const est = edicoes[chave] ?? {};
      return {
        ...base,
        transacoes: base.transacoes.map((t) => (est.ajustes?.[t.id] ? { ...t, status: est.ajustes[t.id] } : t)),
        saldoReserva: est.saldo ?? base.saldoReserva,
        fechada: est.fechada ?? base.status !== 'ABERTA',
        ajustes: est.ajustes ?? {},
      };
    };

    return { obter, mudar };
  }, [edicoes]);

  return <FaturaContext.Provider value={value}>{children}</FaturaContext.Provider>;
}

export function useFatura() {
  const ctx = useContext(FaturaContext);
  if (!ctx) throw new Error('useFatura deve ser usado dentro de <FaturaProvider>');
  return ctx;
}
