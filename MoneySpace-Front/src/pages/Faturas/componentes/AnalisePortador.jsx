// ========================================
// AnalisePortador — gastos por portador (Task 18)
// ========================================
// Componente apresentacional (sem fetch). Recebe `portadores`, já calculado
// pelo backend no dashboard (`por_portador`), com `nao aplicavel` excluído
// (Req 8.1). Cada item: { id_usuario, nome, total (string), percentual
// (string), qtd (number) }.
//
// Renderiza um Card (HeroUI) com uma linha por portador mostrando nome, total
// (moeda, respeitando privacidade), percentual e quantidade de compras, mais
// uma barra proporcional simples (div com width = percentual%) para transmitir a
// proporção SEM biblioteca de gráficos (Req 8.4). A cor nunca é o único sinal: o
// número sempre aparece em texto (acessibilidade).
//
// Valores monetários vêm como string (pg NUMERIC); formatamos com
// `formatarDinheiroPrivado` + `usePrivacy` (Req 5.5 / consistência). Ordenamos
// por total desc só para leitura (Number usado apenas na ordenação).

import { Card } from '@heroui/react';
import { FiUsers } from 'react-icons/fi';
import { usePrivacy } from '../../../context/PrivacyContext';
import { formatarDinheiroPrivado } from '../../../utils/format';

// Paleta de acento ciclada por índice — o portador não traz cor própria, então
// damos tonalidades distintas só para diferenciar visualmente as barras.
const PALETA = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#8b5cf6'];

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

function AnalisePortador({ portadores }) {
  const { valoresOcultos } = usePrivacy();

  // Guarda p/ null/undefined; ordena por total desc só para leitura (Req 8.1).
  const lista = Array.isArray(portadores) ? portadores : [];
  const ordenados = [...lista].sort(
    (a, b) => (Number(b?.total) || 0) - (Number(a?.total) || 0)
  );

  return (
    <Card>
      <Card.Header>
        <Card.Title className="flex items-center gap-2">
          <FiUsers size={18} className="text-foreground-500" />
          Por portador
        </Card.Title>
      </Card.Header>
      <Card.Content>
        {ordenados.length === 0 ? (
          <p className="py-6 text-center text-sm text-foreground-500">
            Sem dados nesta competência
          </p>
        ) : (
          <ul className="space-y-4">
            {ordenados.map((p, i) => {
              const cor = PALETA[i % PALETA.length];
              const largura = larguraBarra(p?.percentual);
              return (
                <li key={p?.id_usuario ?? p?.nome ?? i} className="space-y-1.5">
                  {/* Linha de texto: nome + total (número sempre visível) */}
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate text-sm font-medium">
                      {p?.nome ?? 'Sem nome'}
                    </span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums">
                      {formatarDinheiroPrivado(p?.total, valoresOcultos)}
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
                    <span className="tabular-nums">{formatarPercentual(p?.percentual)}</span>
                    <span className="tabular-nums">
                      {Number(p?.qtd) || 0} compra{(Number(p?.qtd) || 0) === 1 ? '' : 's'}
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

export default AnalisePortador;
