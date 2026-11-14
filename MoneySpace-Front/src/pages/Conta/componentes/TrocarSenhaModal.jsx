// Troca a senha do próprio usuário: pede a senha atual e a nova (duas vezes).
// Quem confere a senha atual é o back. Ao dar certo, a sessão continua aberta.
import { useState } from 'react';
import { Modal, Button, Input, Label, TextField, toast } from '@heroui/react';
import { FiKey } from 'react-icons/fi';
import { trocarMinhaSenha } from '../../../services/usuarioService';

const TAMANHO_MINIMO = 8; // igual ao back

// O formulário só existe com o modal aberto; `key` no pai reinicia os campos a cada abertura.
function Formulario({ state }) {
  const [senhaAtual, setSenhaAtual] = useState('');
  const [senhaNova, setSenhaNova] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [salvando, setSalvando] = useState(false);

  // Valida o que dá para validar aqui e manda para o back
  const salvar = async (e) => {
    e.preventDefault();
    if (senhaNova.length < TAMANHO_MINIMO) {
      toast.danger(`A nova senha deve ter no mínimo ${TAMANHO_MINIMO} caracteres.`);
      return;
    }
    if (senhaNova !== confirmacao) {
      toast.danger('A confirmação não bate com a nova senha.');
      return;
    }
    setSalvando(true);
    try {
      await trocarMinhaSenha({ senhaAtual, senhaNova });
      toast.success('Senha alterada com sucesso!');
      state.close();
    } catch (erro) {
      toast.danger(erro.message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <form onSubmit={salvar}>
      <Modal.Header>
        <Modal.Heading>Trocar senha</Modal.Heading>
      </Modal.Header>
      <Modal.Body className="space-y-3 p-1 text-sm">
        <TextField fullWidth>
          <Label>Senha atual</Label>
          <Input type="password" autoComplete="current-password" value={senhaAtual} onChange={(e) => setSenhaAtual(e.target.value)} required />
        </TextField>
        <TextField fullWidth>
          <Label>Nova senha (mínimo {TAMANHO_MINIMO} caracteres)</Label>
          <Input type="password" autoComplete="new-password" value={senhaNova} onChange={(e) => setSenhaNova(e.target.value)} required />
        </TextField>
        <TextField fullWidth>
          <Label>Repita a nova senha</Label>
          <Input type="password" autoComplete="new-password" value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} required />
        </TextField>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onPress={state.close} type="button">Cancelar</Button>
        <Button type="submit" isDisabled={salvando}>
          <FiKey size={16} /> {salvando ? 'Salvando...' : 'Trocar senha'}
        </Button>
      </Modal.Footer>
    </form>
  );
}

export default function TrocarSenhaModal({ state }) {
  return (
    <Modal state={state}>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-md">
            <Modal.CloseTrigger />
            <Formulario key={state.isOpen ? 'aberto' : 'fechado'} state={state} />
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
