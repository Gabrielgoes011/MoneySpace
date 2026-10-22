// ========================================
// AnaliseCategoria — gastos por categoria (Task 18)
// ========================================
// Componente apresentacional (sem fetch). Recebe `categorias`, já calculado
// pelo backend no dashboard (`por_categoria`), com `nao aplicavel` excluído
// (Req 8.2). Cada item: { id_categoria, nome, cor (hex string|null), total
// (string), percentual (string), qtd (number) }.
//
// Renderiza um Card (HeroUI) com uma linha por categoria: nome, total (moeda,
// respeitando privacidade), percentual e quantidade de compras, mais uma barra
// proporcional simples (div com width = percentual%) SEM biblioteca de gráficos
// (Req 8.4). A barra/acento usa `categoria.cor` quando presente (Req 8.3); na
// falta, cai para uma cor neutra. A cor nunca é o único sinal — o número sempre
// aparece em texto (acessibilidade).
//
// Valores monetários vêm como string (pg NUMERIC); formatamos com
// `formatarDinheiroPrivado` + `usePrivacy`. Ordenamos por total desc só para
// leitura (Number usado apenas na ordenação).

import { Card } from '@heroui/react';
import { FiTag } from 'react-icons/fi';
import { usePrivacy } from '../../../context/PrivacyContext';
import { formatarDinheiroPrivado } from '../../../utils/format';

// Cor neutra quando a categoria não tem `cor` definida (Req 8.3).
const COR_PADRAO = '#9ca3af';

// Normaliza o percentual (string|number|null) para exibição "64.9%".
function formatarPercentual(percentual) {
  if (percentual == null || percentual === '') return '0%';
  const txt = String(percentual).trim();
  return txt.endsWith('%') ? txt : `${txt}%`;
}

// Largura da barra: clamp 0–100 a partir do percentual cru (defensivo).
function larguraBarra(percentual) {
  const n = Number(percentual);
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

function AnaliseCategoria({ categorias }) {
  const { valoresOcultos } = usePrivacy();

  // Guarda p/ null/undefined; ordena por total desc só para leitura (Req 8.2).
  const lista = Array.isArray(categorias) ? categorias : [];
  const ordenados = [...lista].sort(
    (a, b) => (Number(b?.total) || 0) - (Number(a?.total) || 0)
  );

  return (
    <Card>
      <Card.Header>
        <Card.Title className="flex items-center gap-2">
          <FiTag size={18} className="text-foreground-500" />
          Por categoria
        </Card.Title>
      </Card.Header>
      <Card.Content>
        {ordenados.length === 0 ? (
          <p className="py-6 text-center text-sm text-foreground-500">
            Sem dados nesta competência
          </p>
        ) : (
          <ul className="space-y-4">
            {ordenados.map((c, i) => {
              const cor = c?.cor || COR_PADRAO; // usa a cor da categoria (Req 8.3)
              const largura = larguraBarra(c?.percentual);
              return (
                <li key={c?.id_categoria ?? c?.nome ?? i} className="space-y-1.5">
                  {/* Linha de texto: nome (com ponto da cor) + total */}
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: cor }}
                        aria-hidden="true"
                      />
                      <span className="truncate">{c?.nome ?? 'Sem categoria'}</span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums">
                      {formatarDinheiroPrivado(c?.total, valoresOcultos)}
                    </span>
                  </div>

                  {/* Barra proporcional (Tailwind — HeroUI não tem primitiva) */}
                  <div
                    className="h-2 w-full overflow-hidden rounded-full bg-default-100"
                    role="presentation"
                  >
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${largura}%`, backgroundColor: cor }}
                    />
                  </div>

                  {/* Percentual + quantidade em texto (acessível) */}
                  <div className="flex items-center justify-between gap-3 text-xs text-foreground-500">
                    <span className="tabular-nums">{formatarPercentual(c?.percentual)}</span>
                    <span className="tabular-nums">
                      {Number(c?.qtd) || 0} compra{(Number(c?.qtd) || 0) === 1 ? '' : 's'}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card.Content>
    </Card>
  );
}

export default AnaliseCategoria;
