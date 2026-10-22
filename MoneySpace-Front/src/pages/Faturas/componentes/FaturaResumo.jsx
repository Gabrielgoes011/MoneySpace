// ========================================
// FaturaResumo — KPIs da fatura (Task 14)
// ========================================
// Componente apresentacional (sem fetch). Recebe `fatura` (cabeçalho) e `resumo`
// (totais já calculados pelo backend, fonte da verdade — Req 5.3) carregados
// pela página Faturas.jsx a partir de `/faturas/:id/dashboard`.
//
// Mostra em grid de Cards (HeroUI, responsivo, mobile-first — Req 11.1):
//   - total da fatura (gastos aplicáveis, exclui 'nao aplicavel')   Req 5.1
//   - total "na hora"
//   - total "pendente"
//   - total "no fechamento"
//   - meta da reserva (= na hora + pendente)                        Req 5.2
//   - status da conferência (OK / DEFICIT) + diferença de contexto
//
// Valores monetários vêm como string (pg NUMERIC). Formatamos com
// `formatarDinheiroPrivado` (usa Number por baixo — Req 5.3) e respeitamos o
// `PrivacyContext` via `usePrivacy()` (Req 5.5). Competência vazia -> resumo vem
// com '0.00' em tudo e renderiza limpo, sem quebrar (Req 5.4).

import { Card, Chip } from '@heroui/react';
import {
  FiFileText,
  FiZap,
  FiClock,
  FiCalendar,
  FiTarget,
  FiCheckCircle,
  FiAlertTriangle,
} from 'react-icons/fi';
import { usePrivacy } from '../../../context/PrivacyContext';
import { formatarDinheiroPrivado } from '../../../utils/format';

// Card de KPI monetário reutilizável. `destaque` muda o esquema de cor do ícone.
function KpiCard({ icone: Icone, rotulo, valor, oculto, destaque = 'default' }) {
  const cores = {
    default: 'bg-default-100 text-foreground-600',
    primary: 'bg-primary/10 text-primary',
    success: 'bg-success/10 text-success',
    warning: 'bg-warning/10 text-warning',
    secondary: 'bg-secondary/10 text-secondary',
  };

  return (
    <Card>
      <Card.Content className="flex items-center gap-3 py-4">
        <div
          className={`flex items-center justify-center size-10 rounded-xl shrink-0 ${
            cores[destaque] ?? cores.default
          }`}
        >
          <Icone size={20} />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-foreground-500 truncate">{rotulo}</p>
          <p className="text-lg font-bold truncate">
            {formatarDinheiroPrivado(valor, oculto)}
          </p>
        </div>
      </Card.Content>
    </Card>
  );
}

function FaturaResumo({ fatura, resumo }) {
  const { valoresOcultos } = usePrivacy();

  // Guardas: resumo pode vir null em transições; a página já envia '0.00', mas
  // garantimos aqui para o componente nunca quebrar (Req 5.4).
  const r = resumo ?? {};
  const totalFatura = r.total_fatura ?? '0.00';
  const totalNaHora = r.total_na_hora ?? '0.00';
  const totalPendente = r.total_pendente ?? '0.00';
  const totalNoFechamento = r.total_no_fechamento ?? '0.00';
  const metaReserva = r.meta_reserva ?? '0.00';
  const diferencaReserva = r.diferenca_reserva ?? '0.00';
  const statusConferencia = r.status_conferencia ?? null; // 'OK' | 'DEFICIT' | null

  const ehOk = statusConferencia === 'OK';
  const ehDeficit = statusConferencia === 'DEFICIT';

  return (
    <Card>
      <Card.Header>
        <Card.Title className="flex items-center gap-2">
          <FiFileText size={18} className="text-foreground-500" />
          Resumo da fatura
        </Card.Title>
      </Card.Header>
      <Card.Content className="space-y-4">
        {/* Grid de KPIs monetários — mobile-first (1 col), 2 col em sm, 3 em lg */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <KpiCard
            icone={FiFileText}
            rotulo="Total da fatura"
            valor={totalFatura}
            oculto={valoresOcultos}
            destaque="primary"
          />
          <KpiCard
            icone={FiZap}
            rotulo="Pago na hora"
            valor={totalNaHora}
            oculto={valoresOcultos}
            destaque="success"
          />
          <KpiCard
            icone={FiClock}
            rotulo="Pendente"
            valor={totalPendente}
            oculto={valoresOcultos}
            destaque="warning"
          />
          <KpiCard
            icone={FiCalendar}
            rotulo="No fechamento"
            valor={totalNoFechamento}
            oculto={valoresOcultos}
          />
          <KpiCard
            icone={FiTarget}
            rotulo="Meta da reserva"
            valor={metaReserva}
            oculto={valoresOcultos}
            destaque="secondary"
          />

          {/* Status da conferência — card especial com Chip colorido */}
          <Card>
            <Card.Content className="flex items-center gap-3 py-4">
              <div
                className={`flex items-center justify-center size-10 rounded-xl shrink-0 ${
                  ehDeficit
                    ? 'bg-danger/10 text-danger'
                    : ehOk
                      ? 'bg-success/10 text-success'
                      : 'bg-default-100 text-foreground-600'
                }`}
              >
                {ehDeficit ? (
                  <FiAlertTriangle size={20} />
                ) : (
                  <FiCheckCircle size={20} />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs text-foreground-500 truncate">Conferência</p>
                <div className="flex items-center gap-2">
                  {statusConferencia ? (
                    <Chip
                      size="sm"
                      variant="flat"
                      color={ehDeficit ? 'danger' : 'success'}
                    >
                      {ehDeficit ? 'DÉFICIT' : 'OK'}
                    </Chip>
                  ) : (
                    <Chip size="sm" variant="flat">
                      Sem dados
                    </Chip>
                  )}
                  <span className="text-sm font-semibold truncate">
                    {formatarDinheiroPrivado(diferencaReserva, valoresOcultos)}
                  </span>
                </div>
              </div>
            </Card.Content>
          </Card>
        </div>
      </Card.Content>
    </Card>
  );
}

export default FaturaResumo;
