// Faturas: conferência da reserva + grid de lançamentos (cards no celular). MOCK.
import { useState } from 'react';
import { Button, Chip, Tabs, toast } from '@heroui/react';
import { FiUpload } from 'react-icons/fi';
import { CARTOES, COMPETENCIAS, STATUS } from '../../mocks/faturaMock';
import { useFatura } from '../../context/FaturaContext';
import Seletor from '../../components/Seletor';
import { calcular } from './componentes/calculos';
import ConferenciaReserva from './componentes/ConferenciaReserva';
import TransacoesLista from './componentes/TransacoesLista';

const br = (iso) => iso.split('-').reverse().join('/');

export default function Faturas() {
  const { obter, mudar } = useFatura();
  const [cartao, setCartao] = useState(CARTOES[0].id);
  const [comp, setComp] = useState(COMPETENCIAS[0].id);
  const [filtro, setFiltro] = useState('todos');

  const chave = `${cartao}:${comp}`;
  const fatura = obter(chave);

  const c = fatura ? calcular(fatura.transacoes, fatura.saldoReserva) : null;
  const visiveis = !fatura ? [] : filtro === 'todos'
    ? fatura.transacoes
    : fatura.transacoes.filter((t) => t.status === filtro);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Faturas</h1>
          {fatura && (
            <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
              Fecha {br(fatura.fechamento)} · vence {br(fatura.vencimento)}
              <Chip size="sm" variant="soft" color={fatura.fechada ? 'default' : 'success'}>
                {fatura.fechada ? 'Fechada' : 'Aberta'}
              </Chip>
            </p>
          )}
        </div>
        <div className="grid w-full grid-cols-1 gap-2 min-[420px]:grid-cols-2 sm:flex sm:w-auto sm:flex-wrap">
          <Seletor rotulo="Cartão" itens={CARTOES.map((x) => ({ id: x.id, nome: `${x.nome} ••${x.final}` }))} valor={cartao} onChange={setCartao} />
          <Seletor rotulo="Competência" itens={COMPETENCIAS} valor={comp} onChange={setComp} />
          <Button className="min-[420px]:col-span-2 sm:col-auto" variant="secondary" isDisabled={fatura?.fechada} onPress={() => toast.info('Importação de CSV ainda é mock.')}>
            <FiUpload size={16} /> Importar CSV
          </Button>
        </div>
      </div>

      {!fatura ? (
        <p className="rounded-xl border border-dashed border-separator p-10 text-center text-muted">
          Nenhuma fatura para este cartão/competência. Importe um CSV para começar.
        </p>
      ) : (
        <>
          <ConferenciaReserva
            c={c}
            saldo={fatura.saldoReserva}
            onSaldo={(v) => mudar(chave, { saldo: v })}
            fechada={fatura.fechada}
            onFechar={() => { mudar(chave, { fechada: true }); toast.success('Fatura fechada (mock).'); }}
          />

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Lançamentos ({visiveis.length})</h2>
            <Tabs selectedKey={filtro} onSelectionChange={setFiltro}>
              <Tabs.ListContainer>
                <Tabs.List aria-label="Filtrar por status">
                  <Tabs.Tab id="todos">Todos<Tabs.Indicator /></Tabs.Tab>
                  {['pendente', 'na_hora', 'no_fechamento'].map((k) => (
                    <Tabs.Tab key={k} id={k}>{STATUS[k].label}<Tabs.Indicator /></Tabs.Tab>
                  ))}
                </Tabs.List>
              </Tabs.ListContainer>
            </Tabs>
            <TransacoesLista
              key={`${chave}:${filtro}`}
              transacoes={visiveis}
              bloqueada={fatura.fechada}
              onStatus={(id, k) => mudar(chave, { ajustes: { ...fatura.ajustes, [id]: k } })}
            />
          </section>
        </>
      )}
    </div>
  );
}
