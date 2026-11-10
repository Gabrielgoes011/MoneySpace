// Confirmação antes de excluir um lançamento da fatura.
import { useState } from 'react';
import { Modal, Button, toast } from '@heroui/react';
import { excluirLancamento } from '../../../services/faturaService';
import { moeda } from '../../../utils/formatar';

export default function ExcluirLancamentoModal({ state, lancamento, onExcluido }) {
  const [excluindo, setExcluindo] = useState(false);

  // Exclui e avisa o pai para recarregar a fatura.
  const confirmar = () => {
    setExcluindo(true);
    const promessa = excluirLancamento(lancamento.id)
      .then(() => { onExcluido(); state.close(); })
      .finally(() => setExcluindo(false));

    toast.promise(promessa, {
      loading: 'Excluindo...',
      success: 'Lançamento excluído.',
      error: (erro) => erro.message,
    });
  };

  return (
    <Modal state={state}>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-md">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>Excluir lançamento?</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="p-1 text-sm text-muted">
              {lancamento && (
                <p>
                  <strong className="text-foreground">{lancamento.estabelecimento}</strong> ({moeda(lancamento.valor)})
                  será removido da fatura. Essa ação não pode ser desfeita.
                </p>
              )}
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onPress={state.close}>Cancelar</Button>
              <Button variant="danger" onPress={confirmar} isDisabled={excluindo}>Excluir</Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
