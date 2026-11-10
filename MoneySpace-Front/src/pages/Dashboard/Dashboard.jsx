// Painel principal: visão geral com filtros de cartão e competência.
import { useState } from 'react';
import { CARTOES, COMPETENCIAS } from '../../mocks/faturaMock';
import { useFatura } from '../../context/FaturaContext';
import Seletor from '../../components/Seletor';
import { calcular, agrupar } from '../Faturas/componentes/calculos';
import ResumoCards from '../Faturas/componentes/ResumoCards';
import { AnalisePortador, AnaliseCategoria } from '../Faturas/componentes/Analises';

const TODOS = { id: 'todos', nome: 'Todos os cartões' };

export default function Dashboard() {
  const { obter } = useFatura();
  const [cartao, setCartao] = useState('todos');
  const [comp, setComp] = useState(COMPETENCIAS[0].id);

  // Junta as faturas dos cartões escolhidos para a competência.
  const faturas = CARTOES.filter((x) => cartao === 'todos' || x.id === cartao)
    .map((x) => obter(`${x.id}:${comp}`))
    .filter(Boolean);
  const transacoes = faturas.flatMap((f) => f.transacoes);
  const saldo = faturas.reduce((a, f) => a + f.saldoReserva, 0);
  const c = calcular(transacoes, saldo);

  return (
    <div className="space-y-5 md:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Início</h1>
          <p className="text-sm text-muted">Visão geral dos cartões da família</p>
        </div>
        <div className="grid w-full grid-cols-1 gap-2 min-[420px]:grid-cols-2 sm:flex sm:w-auto sm:flex-wrap">
          <Seletor rotulo="Cartão" itens={[TODOS, ...CARTOES.map((x) => ({ id: x.id, nome: `${x.nome} ••${x.final}` }))]} valor={cartao} onChange={setCartao} />
          <Seletor rotulo="Competência" itens={COMPETENCIAS} valor={comp} onChange={setComp} />
        </div>
      </div>

      {faturas.length === 0 ? (
        <p className="rounded-xl border border-dashed border-separator p-10 text-center text-muted">
          Sem faturas para este filtro.
        </p>
      ) : (
        <>
          <ResumoCards c={c} />
          <div className="grid gap-4 lg:grid-cols-2">
            <AnalisePortador dados={agrupar(transacoes, 'portador')} />
            <AnaliseCategoria dados={agrupar(transacoes, 'categoria')} />
          </div>
        </>
      )}
    </div>
  );
}
