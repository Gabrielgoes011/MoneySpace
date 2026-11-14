// Modal para cadastrar uma família nova junto com o primeiro administrador dela.
import { useState } from 'react';
import { Modal, Button, Input, Label, TextField, toast } from '@heroui/react';
import { cpfMascara } from '../../../utils/formatar';
import { cadastrarFamilia } from '../../../services/familiaService';

function Campo({ rotulo, ...props }) {
  return (
    <TextField fullWidth>
      <Label>{rotulo}</Label>
      <Input {...props} />
    </TextField>
  );
}

// O formulário só existe com o modal aberto, então o estado reinicia a cada abertura.
function Formulario({ state, onSalvo }) {
  const [f, setF] = useState({ nome: '', adminNome: '', adminEmail: '', adminCpf: '', adminSenha: '' });
  const [salvando, setSalvando] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  const salvar = (e) => {
    e.preventDefault();
    setSalvando(true);
    const promessa = cadastrarFamilia(f)
      .then((resposta) => { onSalvo(); state.close(); return resposta; })
      .finally(() => setSalvando(false));
    toast.promise(promessa, {
      loading: 'Cadastrando...',
      success: (resposta) => `Família ${resposta.familia.nome} cadastrada.`,
      error: (err) => err.message,
    });
  };

  return (
    <form onSubmit={salvar}>
      <Modal.Header>
        <Modal.Heading>Nova família</Modal.Heading>
      </Modal.Header>
      <Modal.Body className="space-y-3 p-1">
        <Campo rotulo="Nome da família" value={f.nome} onChange={set('nome')} required autoComplete="off" />
        <p className="pt-1 text-sm font-medium text-muted">Primeiro administrador</p>
        <Campo rotulo="Nome" value={f.adminNome} onChange={set('adminNome')} required autoComplete="off" />
        <Campo rotulo="E-mail (login)" type="email" value={f.adminEmail} onChange={set('adminEmail')} required autoComplete="off" />
        <Campo rotulo="CPF" inputMode="numeric" value={f.adminCpf} placeholder="000.000.000-00"
          onChange={(e) => setF((x) => ({ ...x, adminCpf: cpfMascara(e.target.value) }))} required />
        <Campo rotulo="Senha (mín. 8 caracteres)" type="password" value={f.adminSenha} onChange={set('adminSenha')}
          required minLength={8} autoComplete="new-password" />
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onPress={state.close} type="button">Cancelar</Button>
        <Button type="submit" isDisabled={salvando}>Cadastrar</Button>
      </Modal.Footer>
    </form>
  );
}

export default function FamiliaFormModal({ state, onSalvo }) {
  return (
    <Modal state={state}>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-md">
            <Modal.CloseTrigger />
            <Formulario state={state} onSalvo={onSalvo} />
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
