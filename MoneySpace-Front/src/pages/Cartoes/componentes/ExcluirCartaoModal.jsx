// Confirmação antes de excluir um cartão. O pai decide quando abrir (cartão escolhido).
import { Modal, Button, toast } from '@heroui/react';
import { excluirCartao } from '../../../services/cartaoService';

export default function ExcluirCartaoModal({ state, cartao, onExcluido }) {
  // Exclui e avisa o pai para recarregar a lista.
  const confirmar = () => {
    const promessa = excluirCartao(cartao.id)
      .then((cartaoApagado) => { onExcluido(cartaoApagado); state.close(); return cartaoApagado; });

    toast.promise(promessa, {
      loading: 'Excluindo...',
      success: () => `Cartão ${cartao.nome} excluído.`,
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
              <Modal.Heading>Excluir cartão?</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="p-1 text-sm text-muted">
              {cartao && (
                <p>
                  O cartão <strong className="text-foreground">{cartao.nome}</strong> (•••• {cartao.final}) será removido.
                  Só é possível excluir cartão que não tenha lançamentos.
                </p>
              )}
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onPress={state.close}>Cancelar</Button>
              <Button variant="danger" onPress={confirmar}>Excluir</Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
