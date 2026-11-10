// Cadastro de usuários: mostra a família e a lista de quem está cadastrado nela.
import { useEffect, useState } from 'react';
import { Button, Card, Chip, Spinner, useOverlayState } from '@heroui/react';
import { FiPlus, FiUsers } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import { listarUsuarios } from '../../services/usuarioService';
import UsuariosTabela from './componentes/UsuariosTabela';
import UsuarioFormModal from './componentes/UsuarioFormModal';

export default function Usuarios() {
  const { user } = useAuth();
  const [dados, setDados] = useState(null); // { familia, usuarios, pode_editar }
  const [erro, setErro] = useState('');
  const [editando, setEditando] = useState(null); // usuário em edição (null = novo)
  const modal = useOverlayState();

  const carregar = () =>
    listarUsuarios().then(setDados).catch((e) => setErro(e.message));

  useEffect(() => { carregar(); }, []);

  const abrirNovo = () => { setEditando(null); modal.open(); };
  const abrirEditar = (u) => { setEditando(u); modal.open(); };

  if (erro) {
    return <p className="rounded-xl border border-dashed border-separator p-10 text-center text-danger">{erro}</p>;
  }
  if (!dados) {
    return <div className="flex justify-center p-16"><Spinner /></div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Usuários</h1>
          <p className="text-sm text-muted">Quem faz parte da família e pode acessar o app</p>
        </div>
        {dados.pode_editar && (
          <Button onPress={abrirNovo} className="w-full sm:w-auto"><FiPlus size={16} /> Novo usuário</Button>
        )}
      </div>

      <Card>
        <Card.Content className="flex-row flex-wrap items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-accent/15 text-accent"><FiUsers size={20} /></span>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted">Família</p>
            <p className="truncate text-lg font-semibold">{dados.familia?.nome ?? user?.familia_nome ?? '—'}</p>
          </div>
          <Chip variant="soft">{dados.usuarios.length} cadastrado{dados.usuarios.length === 1 ? '' : 's'}</Chip>
        </Card.Content>
      </Card>

      {dados.usuarios.length === 0 ? (
        <p className="rounded-xl border border-dashed border-separator p-10 text-center text-muted">Nenhum usuário cadastrado.</p>
      ) : (
        <UsuariosTabela
          usuarios={dados.usuarios} podeEditar={dados.pode_editar} onEditar={abrirEditar}
        />
      )}

      <UsuarioFormModal state={modal} usuario={editando} onSalvo={carregar} />
    </div>
  );
}
