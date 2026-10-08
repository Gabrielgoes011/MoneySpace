// ========================================
// MODAL: CRIAR / EDITAR CONTA
// ========================================
// Formulário que muda conforme o TIPO escolhido (CORRENTE / CARTEIRA / CREDITO):
//   - CORRENTE / CARTEIRA -> pede saldo atual (saldo_inicial no banco).
//   - CREDITO             -> pede bandeira, final, limite, dias de fechamento/vencimento.
// Serve tanto para criar (sem `conta`) quanto para editar (recebe `conta`).

import { useEffect, useState } from 'react';
import {
  Modal,
  Button,
  InputGroup,
  Select,
  ListBox,
  NumberField,
} from '@heroui/react';
import { FiCreditCard, FiDollarSign, FiPocket } from 'react-icons/fi';

// Opções de tipo com rótulo e ícone (cards de seleção no topo do formulário).
const TIPOS = [
  { valor: 'CORRENTE', rotulo: 'Conta corrente', icone: FiDollarSign },
  { valor: 'CARTEIRA', rotulo: 'Carteira (dinheiro)', icone: FiPocket },
  { valor: 'CREDITO', rotulo: 'Cartão de crédito', icone: FiCreditCard },
];

const BANDEIRAS = ['VISA', 'MASTERCARD', 'ELO', 'AMEX', 'HIPERCARD'];

// Estado inicial do formulário (vazio = criação).
function estadoInicial(conta) {
  return {
    nome: conta?.nome ?? '',
    tipo: conta?.tipo ?? 'CORRENTE',
    saldo_inicial: conta?.saldo_inicial ?? 0,
    bandeira: conta?.bandeira ?? '',
    final_cartao: conta?.final_cartao ?? '',
    limite: conta?.limite ?? 0,
    dia_fechamento: conta?.dia_fechamento ?? 1,
    dia_vencimento: conta?.dia_vencimento ?? 10,
  };
}

function ContaFormModal({ aberto, aoFechar, aoSalvar, conta, salvando }) {
  const [form, setForm] = useState(() => estadoInicial(conta));

  // Ao abrir (ou trocar a conta em edição), reinicia o formulário.
  useEffect(() => {
    if (aberto) setForm(estadoInicial(conta));
  }, [aberto, conta]);

  const ehCredito = form.tipo === 'CREDITO';
  const editando = Boolean(conta?.id);

  const setar = (campo) => (valor) => setForm((f) => ({ ...f, [campo]: valor }));

  const handleSubmit = (e) => {
    e.preventDefault();

    // Monta só os campos que fazem sentido para o tipo escolhido.
    const base = { nome: form.nome.trim(), tipo: form.tipo };
    const dados = ehCredito
      ? {
          ...base,
          bandeira: form.bandeira.trim(),
          final_cartao: form.final_cartao.trim(),
          limite: Number(form.limite) || 0,
          dia_fechamento: Number(form.dia_fechamento) || 1,
          dia_vencimento: Number(form.dia_vencimento) || 1,
        }
      : { ...base, saldo_inicial: Number(form.saldo_inicial) || 0 };

    aoSalvar(dados);
  };

  return (
    <Modal isOpen={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <Modal.Backdrop>
        <Modal.Content>
          <Modal.Dialog>
            <Modal.CloseTrigger />

            <Modal.Header>
              <Modal.Heading>{editando ? 'Editar conta' : 'Nova conta'}</Modal.Heading>
            </Modal.Header>

            <form onSubmit={handleSubmit}>
              <Modal.Body className="flex flex-col gap-4">
                {/* ── Seleção de tipo (cards tocáveis) ──────────────── */}
                <div className="grid grid-cols-3 gap-2">
                  {TIPOS.map(({ valor, rotulo, icone: Icone }) => {
                    const ativo = form.tipo === valor;
                    return (
                      <button
                        key={valor}
                        type="button"
                        onClick={() => setar('tipo')(valor)}
                        aria-pressed={ativo}
                        className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-xs transition-colors ${
                          ativo
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-black/10 dark:border-white/10 text-foreground-500 hover:bg-black/5 dark:hover:bg-white/5'
                        }`}
                      >
                        <Icone size={20} />
                        <span className="text-center leading-tight">{rotulo}</span>
                      </button>
                    );
                  })}
                </div>

                {/* ── Nome (todos os tipos) ─────────────────────────── */}
                <InputGroup>
                  <InputGroup.Input
                    placeholder="Nome (ex.: Nubank, Carteira)"
                    aria-label="Nome da conta"
                    value={form.nome}
                    onChange={(e) => setar('nome')(e.target.value)}
                    required
                  />
                </InputGroup>

                {/* ── Campos específicos por tipo ───────────────────── */}
                {ehCredito ? (
                  <div className="flex flex-col gap-4">
                    <div className="grid grid-cols-2 gap-3">
                      <Select
                        aria-label="Bandeira"
                        value={form.bandeira || null}
                        onChange={(key) => setar('bandeira')(key ? String(key) : '')}
                      >
                        <Select.Trigger>
                          <Select.Value placeholder="Bandeira" />
                          <Select.Indicator />
                        </Select.Trigger>
                        <Select.Popover>
                          <ListBox>
                            {BANDEIRAS.map((b) => (
                              <ListBox.Item key={b} id={b}>
                                {b}
                              </ListBox.Item>
                            ))}
                          </ListBox>
                        </Select.Popover>
                      </Select>

                      <InputGroup>
                        <InputGroup.Input
                          placeholder="Final (4 díg.)"
                          aria-label="Final do cartão"
                          inputMode="numeric"
                          maxLength={4}
                          value={form.final_cartao}
                          onChange={(e) =>
                            setar('final_cartao')(e.target.value.replace(/\D/g, '').slice(0, 4))
                          }
                        />
                      </InputGroup>
                    </div>

                    <NumberField
                      value={Number(form.limite)}
                      onChange={setar('limite')}
                      minValue={0}
                      formatOptions={{ style: 'currency', currency: 'BRL' }}
                      aria-label="Limite do cartão"
                    >
                      <NumberField.Label>Limite</NumberField.Label>
                      <NumberField.Group>
                        <NumberField.Input />
                      </NumberField.Group>
                    </NumberField>

                    <div className="grid grid-cols-2 gap-3">
                      <NumberField
                        value={Number(form.dia_fechamento)}
                        onChange={setar('dia_fechamento')}
                        minValue={1}
                        maxValue={31}
                        aria-label="Dia de fechamento"
                      >
                        <NumberField.Label>Dia de fechamento</NumberField.Label>
                        <NumberField.Group>
                          <NumberField.Input />
                        </NumberField.Group>
                      </NumberField>

                      <NumberField
                        value={Number(form.dia_vencimento)}
                        onChange={setar('dia_vencimento')}
                        minValue={1}
                        maxValue={31}
                        aria-label="Dia de vencimento"
                      >
                        <NumberField.Label>Dia de vencimento</NumberField.Label>
                        <NumberField.Group>
                          <NumberField.Input />
                        </NumberField.Group>
                      </NumberField>
                    </div>
                  </div>
                ) : (
                  <NumberField
                    value={Number(form.saldo_inicial)}
                    onChange={setar('saldo_inicial')}
                    formatOptions={{ style: 'currency', currency: 'BRL' }}
                    aria-label="Saldo atual"
                  >
                    {/* Rótulo evita confundir: é o saldo de HOJE, não uma receita */}
                    <NumberField.Label>Saldo atual nesta conta hoje</NumberField.Label>
                    <NumberField.Group>
                      <NumberField.Input />
                    </NumberField.Group>
                  </NumberField>
                )}
              </Modal.Body>

              <Modal.Footer>
                <Button variant="ghost" type="button" onPress={aoFechar} isDisabled={salvando}>
                  Cancelar
                </Button>
                <Button color="primary" type="submit" isPending={salvando}>
                  {editando ? 'Salvar' : 'Criar conta'}
                </Button>
              </Modal.Footer>
            </form>
          </Modal.Dialog>
        </Modal.Content>
      </Modal.Backdrop>
    </Modal>
  );
}

export default ContaFormModal;
