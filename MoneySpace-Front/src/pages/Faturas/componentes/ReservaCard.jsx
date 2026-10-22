// ========================================
// ReservaCard — conferência da reserva (Task 15)
// ========================================
// Deixa o usuário informar quanto realmente tem guardado na reserva
// (`saldo_reserva_declarado`) e mostra o diagnóstico da conferência comparando
// com a meta da reserva (soma do que é à vista: 'na hora' + 'pendente').
//
// Fonte da verdade dos números é o BACKEND (Req 6.2): a diferença e o status
// chegam prontos em `resumo` (de /faturas/:id/dashboard). Ao salvar, fazemos o
// PATCH e só então avisamos o pai para recarregar o dashboard — nunca mutamos a
// UI de forma otimista (Req 6.5).
//
// Props:
//   - fatura   cabeçalho da fatura (status + saldo_reserva_declarado)
//   - resumo   { meta_reserva, diferenca_reserva, status_conferencia }
//   - idFatura UUID da fatura selecionada
//   - onReservaAtualizada(faturaAtualizada)  callback p/ o pai recarregar KPIs
//
// Regras:
//   - Validação (Req 6.6): não negativo, escala de 2 casas; bloqueia submit inválido.
//   - Diagnóstico (Req 6.2–6.4): SOBRA/OK (diferença >= 0, success) x DÉFICIT
//     (diferença < 0, danger com alerta do quanto falta).
//   - Privacidade (Req 5.5): valores exibidos respeitam o PrivacyContext; o input
//     editável mostra o número real (o usuário precisa enxergar p/ editar).
//   - Fatura FECHADA/PAGA bloqueia a edição (coerente com Req 9.2): input e botão
//     desabilitados + nota explicando.

import { useEffect, useMemo, useState } from 'react';
import { Card, Button, NumberField, Label, Chip, toast } from '@heroui/react';
import { FiShield, FiCheckCircle, FiAlertTriangle, FiLock } from 'react-icons/fi';
import { usePrivacy } from '../../../context/PrivacyContext';
import { formatarDinheiroPrivado } from '../../../utils/format';
import { atualizarReserva } from '../../../services/faturaService';

// Converte string/number para Number seguro (pg entrega NUMERIC como string).
function paraNumero(valor) {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

// Validação do saldo declarado (Req 6.6): finito, não negativo, até 2 casas.
function validarSaldo(valor) {
  if (valor === null || valor === undefined || Number.isNaN(valor)) {
    return 'Informe um valor válido.';
  }
  if (!Number.isFinite(valor)) return 'Informe um valor válido.';
  if (valor < 0) return 'O saldo não pode ser negativo.';
  // Escala de 2 casas: rejeita se arredondar para 2 casas mudar o valor.
  if (Math.round(valor * 100) / 100 !== valor) {
    return 'Use no máximo 2 casas decimais.';
  }
  return null;
}

function ReservaCard({ fatura, resumo, idFatura, onReservaAtualizada }) {
  const { valoresOcultos } = usePrivacy();

  // Status da fatura; FECHADA/PAGA bloqueiam a mutação da reserva (Req 9.2).
  const status = fatura?.status ?? null;
  const bloqueado = status === 'FECHADA' || status === 'PAGA';

  // Valor do input (number). Pré-preenche a partir do cabeçalho (string -> Number).
  const saldoBackend = paraNumero(fatura?.saldo_reserva_declarado);
  const [saldo, setSaldo] = useState(saldoBackend);
  const [salvando, setSalvando] = useState(false);

  // Resincroniza o input quando o backend traz um novo saldo (troca de fatura
  // ou recarga pós-PATCH). Mantém a UI alinhada à fonte da verdade.
  useEffect(() => {
    setSaldo(paraNumero(fatura?.saldo_reserva_declarado));
  }, [fatura?.id, fatura?.saldo_reserva_declarado]);

  // Números do diagnóstico vêm do backend (Req 6.2). A meta é contexto.
  const metaReserva = resumo?.meta_reserva ?? '0.00';
  const diferencaReserva = resumo?.diferenca_reserva ?? '0.00';
  const statusConferencia = resumo?.status_conferencia ?? null; // 'OK' | 'DEFICIT' | null

  const diferencaNum = paraNumero(diferencaReserva);
  const ehDeficit = statusConferencia === 'DEFICIT' || diferencaNum < 0;
  const ehOk = statusConferencia === 'OK' || (statusConferencia === null && diferencaNum >= 0);

  // Valor absoluto para rotular sobra/falta sem o sinal negativo.
  const valorDiagnostico = Math.abs(diferencaNum);

  // Erro de validação do input (reavaliado a cada mudança).
  const erroValidacao = useMemo(() => validarSaldo(saldo), [saldo]);

  // Não deixa salvar se nada mudou (evita PATCH à toa).
  const alterou = paraNumero(saldo) !== saldoBackend;
  const podeSalvar = !bloqueado && !salvando && !erroValidacao && alterou;

  const handleSalvar = async () => {
    const erro = validarSaldo(saldo);
    if (erro) {
      toast.danger(erro);
      return;
    }

    setSalvando(true);
    try {
      // PATCH: normaliza p/ string com 2 casas (contrato trafega dinheiro como string).
      const valorEnviado = paraNumero(saldo).toFixed(2);
      const faturaAtualizada = await atualizarReserva(idFatura, valorEnviado);
      // UI só atualiza após a resposta (Req 6.5): avisa o pai p/ recarregar o
      // dashboard, que recalcula diferença/status (fonte da verdade no backend).
      toast.success('Reserva atualizada com sucesso.');
      if (onReservaAtualizada) onReservaAtualizada(faturaAtualizada);
    } catch (erro) {
      const msg =
        erro?.response?.data?.message ?? 'Não foi possível atualizar a reserva.';
      toast.danger(msg);
      // Mantém o valor antigo: volta o input ao que o backend tinha.
      setSaldo(saldoBackend);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Card>
      <Card.Header>
        <Card.Title className="flex items-center gap-2">
          <FiShield size={18} className="text-foreground-500" />
          Conferência da reserva
        </Card.Title>
      </Card.Header>

      <Card.Content className="space-y-4">
        {/* ── Diagnóstico (SOBRA/OK x DÉFICIT) — Req 6.2–6.4 ─────────── */}
        <div
          className={`flex items-start gap-3 rounded-xl p-4 ${
            ehDeficit
              ? 'bg-danger/10 text-danger'
              : ehOk
                ? 'bg-success/10 text-success'
                : 'bg-default-100 text-foreground-600'
          }`}
        >
          <div className="shrink-0 pt-0.5">
            {ehDeficit ? (
              <FiAlertTriangle size={22} />
            ) : (
              <FiCheckCircle size={22} />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {statusConferencia || diferencaNum !== 0 ? (
                <Chip
                  size="sm"
                  variant="flat"
                  color={ehDeficit ? 'danger' : 'success'}
                >
                  {ehDeficit ? 'DÉFICIT' : 'SOBRA / OK'}
                </Chip>
              ) : (
                <Chip size="sm" variant="flat">
                  Sem dados
                </Chip>
              )}
            </div>
            <p className="mt-1 text-sm">
              {ehDeficit ? (
                <>
                  Falta{' '}
                  <span className="font-bold">
                    {formatarDinheiroPrivado(valorDiagnostico, valoresOcultos)}
                  </span>{' '}
                  para cobrir a reserva.
                </>
              ) : (
                <>
                  Sobra de{' '}
                  <span className="font-bold">
                    {formatarDinheiroPrivado(valorDiagnostico, valoresOcultos)}
                  </span>{' '}
                  sobre a meta.
                </>
              )}
            </p>
            {/* Meta como contexto (Req 6 / 5.2). */}
            <p className="mt-0.5 text-xs text-foreground-500">
              Meta da reserva:{' '}
              {formatarDinheiroPrivado(metaReserva, valoresOcultos)}
            </p>
          </div>
        </div>

        {/* ── Input do saldo declarado ──────────────────────────────── */}
        <NumberField
          value={saldo}
          onChange={setSaldo}
          minValue={0}
          isDisabled={bloqueado || salvando}
          isInvalid={Boolean(erroValidacao) && alterou}
          formatOptions={{ style: 'currency', currency: 'BRL' }}
          aria-label="Saldo declarado da reserva"
        >
          <Label>Quanto você tem guardado na reserva?</Label>
          <NumberField.Group>
            <NumberField.Input />
          </NumberField.Group>
        </NumberField>

        {/* Mensagem de erro de validação (só quando o usuário mexeu no valor). */}
        {erroValidacao && alterou && !bloqueado && (
          <p className="text-xs text-danger">{erroValidacao}</p>
        )}

        {/* Nota de bloqueio quando a fatura está FECHADA/PAGA (Req 9.2). */}
        {bloqueado && (
          <div className="flex items-center gap-2 text-xs text-foreground-500">
            <FiLock size={14} />
            <span>
              Fatura {status?.toLowerCase()}: a reserva não pode ser alterada.
            </span>
          </div>
        )}
      </Card.Content>

      <Card.Footer className="justify-end">
        <Button
          color="primary"
          onPress={handleSalvar}
          isPending={salvando}
          isDisabled={!podeSalvar}
        >
          Salvar reserva
        </Button>
      </Card.Footer>
    </Card>
  );
}

export default ReservaCard;
