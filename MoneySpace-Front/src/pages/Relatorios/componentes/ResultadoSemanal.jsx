// Relatório por semana: total de cada semana e, por categoria, os lançamentos (recolhíveis).
import { Card, Button } from '@heroui/react';
import { FiShare2, FiDownload, FiCopy } from 'react-icons/fi';
import { moeda } from '../../../utils/formatar';

export default function ResultadoSemanal({ relatorio, onCompartilhar, onBaixar, onCopiar }) {
  const totalLancamentos = relatorio.categoriasDetalhe.reduce((soma, c) => soma + c.quantidade, 0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
        <Button onPress={onCompartilhar} className="sm:flex-1">
          <FiShare2 size={16} /> Compartilhar (WhatsApp)
        </Button>
        <Button variant="secondary" onPress={onBaixar}>
          <FiDownload size={16} /> Baixar PDF
        </Button>
        <Button variant="ghost" onPress={onCopiar}>
          <FiCopy size={16} /> Copiar resumo
        </Button>
      </div>

      <Card>
        <Card.Content className="flex-row flex-wrap items-center justify-between gap-2 p-4">
          <span className="text-sm text-muted">Total da fatura</span>
          <span className="text-xl font-bold tabular-nums text-accent">{moeda(relatorio.totalGeral)}</span>
        </Card.Content>
      </Card>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Gasto por semana</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {relatorio.semanas.map((semana) => (
            <Card key={semana.rotulo}>
              <Card.Content className="gap-2 p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <div>
                    <p className="font-semibold">{semana.rotulo}</p>
                    <p className="text-xs text-muted">{semana.periodo} · {semana.quantidade} lançamento(s)</p>
                  </div>
                  <span className="font-bold tabular-nums">{moeda(semana.total)}</span>
                </div>
                <div className="space-y-1 border-t border-separator pt-2">
                  {semana.categorias.map((categoria) => (
                    <div key={categoria.nome} className="flex justify-between gap-2 text-sm">
                      <span className="truncate">{categoria.nome}</span>
                      <span className="tabular-nums text-muted">{moeda(categoria.total)}</span>
                    </div>
                  ))}
                </div>
              </Card.Content>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Detalhes por categoria ({totalLancamentos})</h2>
        {relatorio.categoriasDetalhe.map((categoria) => (
          <details key={categoria.nome} className="group rounded-xl border border-separator bg-background">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-4">
              <span className="font-semibold">{categoria.nome}</span>
              <span className="text-sm text-muted">
                {categoria.quantidade} · <span className="font-semibold tabular-nums text-foreground">{moeda(categoria.total)}</span>
              </span>
            </summary>
            <div className="divide-y divide-separator border-t border-separator">
              {categoria.lancamentos.map((lancamento, indice) => (
                <div key={`${lancamento.dataCompra}-${indice}`} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate">{lancamento.estabelecimento}</p>
                    <p className="text-xs text-muted">{lancamento.dataCompra} · {lancamento.portador.split(' ')[0]}</p>
                  </div>
                  <span className="shrink-0 tabular-nums">{moeda(lancamento.valor)}</span>
                </div>
              ))}
            </div>
          </details>
        ))}
      </section>
    </div>
  );
}
