// ========================================
// TRANSAÇÕES (lançamentos)
// ========================================
// Lista as transações (parcelas/movimentos) com filtro por tipo e status,
// espelhando as colunas da tabela `transacao` + dados da `compra`.
// Dados mockados por enquanto (src/mocks).

import { useState } from 'react';
import { Card, Chip, Button, Select, ListBox } from '@heroui/react';
import { FiArrowUpRight, FiArrowDownRight, FiPlus } from 'react-icons/fi';
import { usePrivacy } from '../../context/PrivacyContext';
import { formatarDinheiroPrivado, formatarData } from '../../utils/format';
import { transacoes } from '../../mocks/dadosFinanceiros';

function Transacoes() {
  const { valoresOcultos } = usePrivacy();

  const [tipo, setTipo] = useState('TODOS'); // TODOS | RECEITA | DESPESA
  const [status, setStatus] = useState('TODOS'); // TODOS | PENDENTE | EFETIVADA

  const lista = transacoes
    .filter((t) => (tipo === 'TODOS' ? true : t.tipo === tipo))
    .filter((t) => (status === 'TODOS' ? true : t.status === status))
    .sort((a, b) => b.dt_transacao.localeCompare(a.dt_transacao));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* ── Cabeçalho ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Transações</h1>
          <p className="text-sm text-foreground-500">Seus lançamentos do mês</p>
        </div>
        <Button color="primary" startContent={<FiPlus size={18} />}>
          Nova
        </Button>
      </div>

      {/* ── Filtros ────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3">
        <Select
          aria-label="Filtrar por tipo"
          className="w-40"
          value={tipo}
          onChange={(key) => setTipo(String(key))}
        >
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <ListBox.Item id="TODOS">Todos os tipos</ListBox.Item>
              <ListBox.Item id="RECEITA">Receitas</ListBox.Item>
              <ListBox.Item id="DESPESA">Despesas</ListBox.Item>
            </ListBox>
          </Select.Popover>
        </Select>

        <Select
          aria-label="Filtrar por status"
          className="w-40"
          value={status}
          onChange={(key) => setStatus(String(key))}
        >
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <ListBox.Item id="TODOS">Todos os status</ListBox.Item>
              <ListBox.Item id="PENDENTE">Pendentes</ListBox.Item>
              <ListBox.Item id="EFETIVADA">Efetivadas</ListBox.Item>
            </ListBox>
          </Select.Popover>
        </Select>
      </div>

      {/* ── Lista ──────────────────────────────────────────────── */}
      <Card>
        <Card.Content className="divide-y divide-black/5 dark:divide-white/5 p-0">
          {lista.length === 0 && (
            <p className="p-6 text-sm text-center text-foreground-500">
              Nenhuma transação com esses filtros.
            </p>
          )}

          {lista.map((t) => {
            const ehReceita = t.tipo === 'RECEITA';
            return (
              <div key={t.id} className="flex items-center gap-3 p-4">
                <div
                  className={`flex items-center justify-center size-10 rounded-full ${
                    ehReceita ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
                  }`}
                >
                  {ehReceita ? <FiArrowUpRight size={18} /> : <FiArrowDownRight size={18} />}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{t.descricao}</p>
                  <p className="text-xs text-foreground-500">
                    {t.categoria} · {t.conta} · {formatarData(t.dt_transacao)}
                    {t.total_parcelas > 1 && ` · ${t.numero_parcela}/${t.total_parcelas}x`}
                  </p>
                </div>

                <div className="text-right">
                  <p className={`text-sm font-semibold ${ehReceita ? 'text-success' : ''}`}>
                    {ehReceita ? '+' : '-'} {formatarDinheiroPrivado(t.valor, valoresOcultos)}
                  </p>
                  <Chip
                    size="sm"
                    variant="flat"
                    color={t.status === 'EFETIVADA' ? 'success' : 'warning'}
                  >
                    {t.status === 'EFETIVADA' ? 'Efetivada' : 'Pendente'}
                  </Chip>
                </div>
              </div>
            );
          })}
        </Card.Content>
      </Card>
    </div>
  );
}

export default Transacoes;
