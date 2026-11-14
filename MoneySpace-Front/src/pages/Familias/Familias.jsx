// Famílias (só dono do app): lista todas as famílias, cadastra uma nova com o primeiro administrador
// e permite "entrar" em uma família para ver e operar os dados dela.
import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Button, Spinner, useOverlayState } from '@heroui/react';
import { FiPlus } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import { listarFamilias } from '../../services/familiaService';
import { lerFamiliaAtiva, definirFamiliaAtiva, limparFamiliaAtiva } from '../../services/familiaAtiva';
import FamiliasTabela from './componentes/FamiliasTabela';
import FamiliaFormModal from './componentes/FamiliaFormModal';

export default function Familias() {
  const { user, ehMaster } = useAuth();
  const [familias, setFamilias] = useState(null);
  const [erro, setErro] = useState('');
  const modal = useOverlayState();

  // família que está valendo agora: a escolhida ou a própria
  const idAtual = lerFamiliaAtiva()?.id ?? user?.id_familia;

  const carregar = () => listarFamilias().then(setFamilias).catch((e) => setErro(e.message));

  useEffect(() => {
    if (ehMaster === true) carregar();
  }, [ehMaster]);

  // "Entrar": guarda a família ativa e recarrega para todas as telas buscarem os dados dela.
  const entrar = (familia) => {
    if (familia.id === user?.id_familia) limparFamiliaAtiva();
    else definirFamiliaAtiva(familia);
    window.location.assign('/dashboard');
  };

  // Quem não é dono do app não vê esta tela (o back também recusa).
  if (ehMaster === false) return <Navigate to="/cadastros" replace />;

  if (erro) {
    return <p className="rounded-xl border border-dashed border-separator p-10 text-center text-danger">{erro}</p>;
  }
  if (ehMaster === null || !familias) {
    return <div className="flex justify-center p-16"><Spinner /></div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Famílias</h1>
          <p className="text-sm text-muted">Todas as famílias do app. Entre em uma para ver e operar os dados dela.</p>
        </div>
        <Button onPress={modal.open} className="w-full sm:w-auto"><FiPlus size={16} /> Nova família</Button>
      </div>

      {familias.length === 0 ? (
        <p className="rounded-xl border border-dashed border-separator p-10 text-center text-muted">Nenhuma família cadastrada.</p>
      ) : (
        <FamiliasTabela familias={familias} idAtual={idAtual} idPropria={user?.id_familia} onEntrar={entrar} />
      )}

      <FamiliaFormModal state={modal} onSalvo={carregar} />
    </div>
  );
}
