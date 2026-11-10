// Modal de cadastro/edição de usuário. `usuario` = objeto (editar) ou null (novo).
import { useState } from 'react';
import { Modal, Button, Input, Label, TextField, toast } from '@heroui/react';
import Seletor from '../../../components/Seletor';
import { cpfMascara } from '../../../utils/formatar';
import { criarUsuario, atualizarUsuario } from '../../../services/usuarioService';

const PERFIS = [
  { id: 'MEMBRO', nome: 'Membro (só visualiza)' },
  { id: 'ADMIN', nome: 'Administrador (gerencia usuários)' },
];

function Campo({ rotulo, ...props }) {
  return (
    <TextField fullWidth>
      <Label>{rotulo}</Label>
      <Input {...props} />
    </TextField>
  );
}

// O formulário só existe com o modal aberto; `key` no pai reinicia o estado a cada abertura.
function Formulario({ usuario, state, onSalvo }) {
  const editando = !!usuario;
  const [f, setF] = useState({
    nome: usuario?.nome ?? '',
    email: usuario?.email ?? '',
    cpf: cpfMascara(usuario?.cpf ?? ''),
    role: usuario?.role ?? 'MEMBRO',
    senha: '',
  });
  const [salvando, setSalvando] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  const salvar = (e) => {
    e.preventDefault();
    const dados = { nome: f.nome, email: f.email, cpf: f.cpf, role: f.role };
    if (f.senha) dados.senha = f.senha;

    setSalvando(true);
    const promessa = (editando ? atualizarUsuario(usuario.id, dados) : criarUsuario({ ...dados, senha: f.senha }))
      .then((u) => { onSalvo(u); state.close(); return u; })
      .finally(() => setSalvando(false));

    toast.promise(promessa, {
      loading: 'Salvando...',
      success: (u) => (editando ? `${u.nome} atualizado.` : `${u.nome} cadastrado.`),
      error: (err) => err.message,
    });
  };

  return (
    <form onSubmit={salvar}>
      <Modal.Header>
        <Modal.Heading>{editando ? 'Editar usuário' : 'Novo usuário'}</Modal.Heading>
      </Modal.Header>
      <Modal.Body className="space-y-3 p-1">
        <Campo rotulo="Nome" value={f.nome} onChange={set('nome')} required autoComplete="off" />
        <Campo rotulo="E-mail (login)" type="email" value={f.email} onChange={set('email')} required autoComplete="off" />
        <Campo rotulo="CPF" inputMode="numeric" value={f.cpf} placeholder="000.000.000-00"
          onChange={(e) => setF((x) => ({ ...x, cpf: cpfMascara(e.target.value) }))} required />
        <div>
          <Label>Perfil</Label>
          <Seletor rotulo="Perfil" itens={PERFIS} valor={f.role} onChange={(k) => setF((x) => ({ ...x, role: k }))} className="w-full" />
        </div>
        <Campo rotulo={editando ? 'Nova senha (deixe vazio para manter)' : 'Senha (mín. 6 caracteres)'} type="password"
          value={f.senha} onChange={set('senha')} required={!editando} minLength={f.senha || !editando ? 6 : undefined}
          autoComplete="new-password" />
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onPress={state.close} type="button">Cancelar</Button>
        <Button type="submit" isDisabled={salvando}>{editando ? 'Salvar' : 'Cadastrar'}</Button>
      </Modal.Footer>
    </form>
  );
}

export default function UsuarioFormModal({ state, usuario, onSalvo }) {
  return (
    <Modal state={state}>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-md">
            <Modal.CloseTrigger />
            <Formulario key={usuario?.id ?? 'novo'} usuario={usuario} state={state} onSalvo={onSalvo} />
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
