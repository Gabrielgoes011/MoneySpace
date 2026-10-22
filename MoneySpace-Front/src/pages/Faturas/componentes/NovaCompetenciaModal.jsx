// ========================================
// NovaCompetenciaModal — cria a 1ª (ou mais uma) competência do cartão
// ========================================
// Abre o mês/ano e chama POST /faturas (faturaService.criarFatura). A fatura
// nasce vazia (status ABERTA); depois o usuário importa o CSV nela.
//
// Props:
//   - aberto     (bool)
//   - aoFechar() fecha o modal
//   - idCartao   (uuid) conta CREDITO destino
//   - aoCriar(faturaCriada)  callback após criar com sucesso (pai re-lista/seleciona)

import { useEffect, useMemo, useState } from 'react';
import { Modal, Button, Select, ListBox, toast } from '@heroui/react';
import { FiCalendar } from 'react-icons/fi';
import { criarFatura } from '../../../services/faturaService';

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function NovaCompetenciaModal({ aberto, aoFechar, idCartao, aoCriar }) {
  const agora = new Date();
  const [mes, setMes] = useState(agora.getMonth() + 1); // 1-12
  const [ano, setAno] = useState(agora.getFullYear());
  const [salvando, setSalvando] = useState(false);

  // Reseta para o mês/ano atuais ao abrir.
  useEffect(() => {
    if (aberto) {
      const d = new Date();
      setMes(d.getMonth() + 1);
      setAno(d.getFullYear());
    }
  }, [aberto]);

  // Janela de anos para o select (ano atual -1 .. +2).
  const anos = useMemo(() => {
    const base = new Date().getFullYear();
    return [base - 1, base, base + 1, base + 2];
  }, []);

  const competencia = `${ano}-${String(mes).padStart(2, '0')}-01`;

  const salvar = async () => {
    if (!idCartao || salvando) return;
    setSalvando(true);
    try {
      const fatura = await criarFatura({ id_conta: idCartao, competencia });
      toast.success('Competência criada.');
      if (aoCriar) aoCriar(fatura);
      aoFechar();
    } catch (erro) {
      // 409 = competência já existe para o cartão.
      const msg =
        erro?.response?.status === 409
          ? (erro.response?.data?.message || 'Esta competência já existe para o cartão.')
          : (erro?.response?.data?.message || 'Não foi possível criar a competência.');
      toast.danger(msg);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal>
      <Modal.Backdrop isOpen={aberto} onOpenChange={(v) => !v && aoFechar()}>
        <Modal.Container>
          <Modal.Dialog>
            <Modal.CloseTrigger />

            <Modal.Header>
              <Modal.Heading className="flex items-center gap-2">
                <FiCalendar size={18} className="text-primary" />
                Nova competência
              </Modal.Heading>
            </Modal.Header>

            <Modal.Body className="flex flex-col gap-4">
              <p className="text-sm text-foreground-500">
                Escolha o mês de referência da fatura. Ela começa vazia; depois
                você importa o CSV do cartão nela.
              </p>

              <div className="grid grid-cols-2 gap-3">
                {/* Mês */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-foreground-500">Mês</span>
                  <Select
                    aria-label="Mês da competência"
                    value={String(mes)}
                    onChange={(key) => setMes(Number(key))}
                  >
                    <Select.Trigger>
                      <Select.Value placeholder="Mês" />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox items={MESES.map((nome, i) => ({ id: String(i + 1), nome }))}>
                        {(m) => <ListBox.Item id={m.id}>{m.nome}</ListBox.Item>}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                </div>

                {/* Ano */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-foreground-500">Ano</span>
                  <Select
                    aria-label="Ano da competência"
                    value={String(ano)}
                    onChange={(key) => setAno(Number(key))}
                  >
                    <Select.Trigger>
                      <Select.Value placeholder="Ano" />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox items={anos.map((a) => ({ id: String(a), label: a }))}>
                        {(item) => <ListBox.Item id={item.id}>{item.label}</ListBox.Item>}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                </div>
              </div>

              <p className="text-xs text-foreground-500">
                Vai criar: <span className="font-semibold">{MESES[mes - 1]} / {ano}</span>
              </p>
            </Modal.Body>

            <Modal.Footer>
              <Button variant="ghost" onPress={aoFechar} isDisabled={salvando}>
                Cancelar
              </Button>
              <Button color="primary" onPress={salvar} isPending={salvando} isDisabled={salvando}>
                Criar competência
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

export default NovaCompetenciaModal;

