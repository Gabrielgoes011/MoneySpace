// Criação de fatura: escolhe o mês (competência) e cria para o cartão.
// O fechamento e o vencimento saem sozinhos dos dias do cartão (quem calcula é o back).
import { useState } from 'react';
import { Modal, Button, Input, Label, TextField, toast } from '@heroui/react';
import { criarFatura } from '../../../services/faturaService';

// Mês atual no formato AAAA-MM (valor padrão do campo)
const mesAtual = () => {
  const agora = new Date();
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;
};

// O formulário só existe com o modal aberto; `key` no pai reinicia o estado a cada abertura.
function Formulario({ state, cartao, onCriada }) {
  const [competencia, setCompetencia] = useState(mesAtual());
  const [salvando, setSalvando] = useState(false);

  // Cria a fatura do mês escolhido e avisa o pai.
  const confirmar = (e) => {
    e.preventDefault();
    setSalvando(true);
    const promessa = criarFatura(cartao.id, competencia)
      .then((faturaCriada) => { onCriada(faturaCriada); state.close(); return faturaCriada; })
      .finally(() => setSalvando(false));

    toast.promise(promessa, {
      loading: 'Criando fatura...',
      success: (faturaCriada) => `Fatura de ${faturaCriada.titulo} criada.`,
      error: (erro) => erro.message,
    });
  };

  return (
    <form onSubmit={confirmar}>
      <Modal.Header>
        <Modal.Heading>Criar fatura</Modal.Heading>
      </Modal.Header>
      <Modal.Body className="space-y-3 p-1 text-sm">
        <p className="text-muted">
          Cartão <strong className="text-foreground">{cartao?.nome} (•••• {cartao?.final})</strong>
        </p>
        <TextField fullWidth>
          <Label>Mês da fatura</Label>
          <Input type="month" value={competencia} onChange={(e) => setCompetencia(e.target.value)} required />
        </TextField>
        <p className="text-muted">
          O fechamento e o vencimento são calculados pelos dias cadastrados no cartão.
        </p>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onPress={state.close} type="button">Cancelar</Button>
        <Button type="submit" isDisabled={salvando || !competencia}>Criar fatura</Button>
      </Modal.Footer>
    </form>
  );
}

export default function CriarFaturaModal({ state, cartao, onCriada }) {
  return (
    <Modal state={state}>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-md">
            <Modal.CloseTrigger />
            <Formulario key={state.isOpen ? 'aberto' : 'fechado'} state={state} cartao={cartao} onCriada={onCriada} />
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
