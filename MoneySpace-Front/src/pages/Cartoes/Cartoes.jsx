// Cadastro de cartões: lista da família. Só ADMIN vê os botões de cadastrar e excluir (vem do back).
import { useEffect, useState } from 'react';
import { Button, Chip, Spinner, useOverlayState } from '@heroui/react';
import { FiPlus, FiCreditCard } from 'react-icons/fi';
import { listarCartoes } from '../../services/cartaoService';
import { listarUsuarios } from '../../services/usuarioService';
import CartoesTabela from './componentes/CartoesTabela';
import CartaoFormModal from './componentes/CartaoFormModal';
import ExcluirCartaoModal from './componentes/ExcluirCartaoModal';

export default function Cartoes() {
  const [dados, setDados] = useState(null); // { cartoes, pode_cadastrar }
  const [usuarios, setUsuarios] = useState([]); // membros da família (para escolher o dono)
  const [cartaoParaExcluir, setCartaoParaExcluir] = useState(null);
  const [erro, setErro] = useState('');
  const modal = useOverlayState();
  const modalExcluir = useOverlayState();

  // Carrega cartões e membros juntos; os membros só servem para o select de dono.
  const carregar = () =>
    Promise.all([listarCartoes(), listarUsuarios()])
      .then(([cartoesResposta, usuariosResposta]) => {
        setDados(cartoesResposta);
        setUsuarios(usuariosResposta.usuarios);
      })
      .catch((e) => setErro(e.message));

  useEffect(() => { carregar(); }, []);

  // Abre a confirmação para o cartão escolhido.
  const pedirExclusao = (cartao) => {
    setCartaoParaExcluir(cartao);
    modalExcluir.open();
  };

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
          <h1 className="text-2xl font-bold">Cartões</h1>
          <p className="text-sm text-muted">Cartões de crédito da família e de quem é o dono de cada um</p>
        </div>
        {dados.pode_cadastrar && (
          <Button onPress={modal.open} className="w-full sm:w-auto"><FiPlus size={16} /> Novo cartão</Button>
        )}
      </div>

      {dados.cartoes.length === 0 ? (
        <p className="rounded-xl border border-dashed border-separator p-10 text-center text-muted">
          <FiCreditCard size={24} className="mx-auto mb-2" />
          Nenhum cartão cadastrado.
        </p>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <Chip variant="soft">{dados.cartoes.length} cartão{dados.cartoes.length === 1 ? '' : 'ões'}</Chip>
          </div>
          <CartoesTabela
            cartoes={dados.cartoes}
            podeExcluir={dados.pode_cadastrar}
            onExcluir={pedirExclusao}
          />
        </>
      )}

      {dados.pode_cadastrar && (
        <>
          <CartaoFormModal state={modal} usuarios={usuarios} onSalvo={carregar} />
          <ExcluirCartaoModal
            state={modalExcluir}
            cartao={cartaoParaExcluir}
            onExcluido={carregar}
          />
        </>
      )}
    </div>
  );
}
