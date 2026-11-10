// Modal de cadastro de categoria. O backend grava o valor em minúsculo.
import { useState } from 'react';
import { Modal, Button, Input, Label, TextField, toast } from '@heroui/react';
import { criarCategoria } from '../../../services/categoriaService';
import { properCase } from '../../../utils/formatar';

// O formulário só existe com o modal aberto; `key` no pai reinicia o estado a cada abertura.
function Formulario({ state, onSalvo }) {
  const [valor, setValor] = useState('');
  const [salvando, setSalvando] = useState(false);

  const salvar = (e) => {
    e.preventDefault();

    setSalvando(true);
    const promessa = criarCategoria(valor)
      .then((c) => { onSalvo(c); state.close(); return c; })
      .finally(() => setSalvando(false));

    toast.promise(promessa, {
      loading: 'Salvando...',
      success: (c) => `${properCase(c.valor)} cadastrada.`,
      error: (err) => err.message,
    });
  };

  return (
    <form onSubmit={salvar}>
      <Modal.Header>
        <Modal.Heading>Nova categoria</Modal.Heading>
      </Modal.Header>
      <Modal.Body className="space-y-3 p-1">
        <TextField fullWidth>
          <Label>Nome da categoria</Label>
          <Input
            value={valor} onChange={(e) => setValor(e.target.value)}
            placeholder="Ex.: Casa & Manutenção" required minLength={2} maxLength={60} autoComplete="off"
          />
        </TextField>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onPress={state.close} type="button">Cancelar</Button>
        <Button type="submit" isDisabled={salvando}>Cadastrar</Button>
      </Modal.Footer>
    </form>
  );
}

export default function CategoriaFormModal({ state, onSalvo }) {
  return (
    <Modal state={state}>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-md">
            <Modal.CloseTrigger />
            <Formulario key={state.isOpen ? 'aberto' : 'fechado'} state={state} onSalvo={onSalvo} />
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
