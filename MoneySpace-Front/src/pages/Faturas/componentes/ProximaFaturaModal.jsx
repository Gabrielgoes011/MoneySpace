// Depois de fechar uma fatura: pergunta se já quer abrir a próxima.
import { Modal, Button } from '@heroui/react';

export default function ProximaFaturaModal({ state, competenciaProxima, onCriar }) {
  return (
    <Modal state={state}>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-md">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>Fatura fechada</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="p-1 text-sm text-muted">
              <p>
                Quer criar agora a fatura de{' '}
                <strong className="text-foreground">{competenciaProxima?.nome}</strong> para continuar lançando os gastos?
              </p>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onPress={state.close}>Agora não</Button>
              <Button onPress={onCriar}>Criar próxima fatura</Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
