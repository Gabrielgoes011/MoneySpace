// ========================================
// CONTAS & CARTÕES  (etapa 2.1)
// ========================================
// Tela "Minhas Contas": lista as contas da família (tabela `conta`) e permite
// criar/editar via modal (ContaFormModal). Poucos itens heterogêneos -> cards
// verticais (melhor no mobile), conforme padrão definido no agents.md.
//
// Dados vêm do contaService (API). Enquanto o backend está em dev, o service
// cai nos mocks e avisa por toast — a tela segue navegável.

import { useEffect, useState } from 'react';
import { Card, Chip, Button, toast } from '@heroui/react';
import { FiCreditCard, FiDollarSign, FiPocket, FiPlus, FiEdit2, FiArchive } from 'react-icons/fi';
import { usePrivacy } from '../../context/PrivacyContext';
import { formatarDinheiroPrivado } from '../../utils/format';
import {
  listarContas,
  criarConta,
  atualizarConta,
  arquivarConta,
} from '../../services/contaService';
import ContaFormModal from './ContaFormModal';

const rotuloTipo = {
  CREDITO: 'Cartão de crédito',
  CORRENTE: 'Conta corrente',
  CARTEIRA: 'Dinheiro',
};

// Ícone por tipo de conta.
function IconeTipo({ tipo, ...props }) {
  if (tipo === 'CREDITO') return <FiCreditCard {...props} />;
  if (tipo === 'CARTEIRA') return <FiPocket {...props} />;
  return <FiDollarSign {...props} />;
}

function Contas() {
  const { valoresOcultos } = usePrivacy();

  const [contas, setContas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [contaEditando, setContaEditando] = useState(null); // null = criação
  const [salvando, setSalvando] = useState(false);

  // Carrega as contas ao montar.
  useEffect(() => {
    (async () => {
      setCarregando(true);
      try {
        const lista = await listarContas();
        setContas(lista);
      } catch {
        toast.danger('Não foi possível carregar as contas.');
        setContas([]);
      } finally {
        setCarregando(false);
      }
    })();
  }, []);

  // Abre o modal em modo criação.
  const abrirCriar = () => {
    setContaEditando(null);
    setModalAberto(true);
  };

  // Abre o modal em modo edição, pré-carregando a conta.
  const abrirEditar = (conta) => {
    setContaEditando(conta);
    setModalAberto(true);
  };

  // Salva (cria ou edita) e atualiza a lista local.
  const salvar = async (dados) => {
    setSalvando(true);
    try {
      if (contaEditando?.id) {
        const atualizada = await atualizarConta(contaEditando.id, dados);
        setContas((lista) =>
          lista.map((c) => (c.id === contaEditando.id ? { ...c, ...atualizada } : c))
        );
        toast.success('Conta atualizada.');
      } else {
        const criada = await criarConta(dados);
        setContas((lista) => [...lista, criada]);
        toast.success('Conta criada.');
      }
      setModalAberto(false);
    } catch (erro) {
      toast.danger(erro.response?.data?.message || 'Não foi possível salvar a conta.');
    } finally {
      setSalvando(false);
    }
  };

  // Arquiva a conta (soft delete) após confirmação simples.
  const arquivar = async (conta) => {
    const ok = window.confirm(
      `Arquivar "${conta.nome}"? O histórico é preservado, mas a conta deixa de aparecer na lista.`
    );
    if (!ok) return;

    try {
      await arquivarConta(conta.id);
      setContas((lista) => lista.filter((c) => c.id !== conta.id));
      toast.success('Conta arquivada.');
    } catch (erro) {
      toast.danger(erro.response?.data?.message || 'Não foi possível arquivar a conta.');
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4 sm:space-y-6">
      {/* ── Cabeçalho ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold truncate">Minhas Contas</h1>
          <p className="text-sm text-foreground-500">Onde seu dinheiro mora</p>
        </div>
        <Button color="primary" aria-label="Adicionar conta" className="shrink-0" onPress={abrirCriar}>
          <FiPlus size={18} />
          <span className="hidden sm:inline">Adicionar</span>
        </Button>
      </div>

      {/* ── Estado de carregamento ─────────────────────────────── */}
      {carregando && (
        <p className="py-10 text-center text-sm text-foreground-500">Carregando contas...</p>
      )}

      {/* ── Estado vazio ───────────────────────────────────────── */}
      {!carregando && contas.length === 0 && (
        <Card>
          <Card.Content className="flex flex-col items-center gap-3 py-10 text-center">
            <div className="flex items-center justify-center size-12 rounded-xl bg-primary/10 text-primary">
              <FiPocket size={24} />
            </div>
            <div>
              <p className="font-semibold">Você ainda não cadastrou nenhuma conta</p>
              <p className="text-sm text-foreground-500">
                Comece adicionando onde seu dinheiro está.
              </p>
            </div>
            <Button color="primary" onPress={abrirCriar}>
              <FiPlus size={18} />
              Adicionar conta
            </Button>
          </Card.Content>
        </Card>
      )}

      {/* ── Grid de contas ─────────────────────────────────────── */}
      {!carregando && contas.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {contas.map((conta) => {
            const ehCredito = conta.tipo === 'CREDITO';

            return (
              <Card key={conta.id}>
                <Card.Content className="space-y-3 py-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`flex items-center justify-center size-10 rounded-xl shrink-0 ${
                          ehCredito ? 'bg-primary/10 text-primary' : 'bg-success/10 text-success'
                        }`}
                      >
                        <IconeTipo tipo={conta.tipo} size={20} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{conta.nome}</p>
                        <p className="text-xs text-foreground-500 truncate">
                          {rotuloTipo[conta.tipo]}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {ehCredito && conta.final_cartao && (
                        <Chip size="sm" variant="flat">
                          {conta.bandeira} ••{conta.final_cartao}
                        </Chip>
                      )}
                      <Button
                        isIconOnly
                        size="sm"
                        variant="ghost"
                        aria-label={`Editar ${conta.nome}`}
                        onPress={() => abrirEditar(conta)}
                      >
                        <FiEdit2 size={16} />
                      </Button>
                      <Button
                        isIconOnly
                        size="sm"
                        variant="ghost"
                        aria-label={`Arquivar ${conta.nome}`}
                        onPress={() => arquivar(conta)}
                      >
                        <FiArchive size={16} />
                      </Button>
                    </div>
                  </div>

                  {ehCredito ? (
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-foreground-500">Limite</span>
                        <span className="font-semibold">
                          {formatarDinheiroPrivado(conta.limite, valoresOcultos)}
                        </span>
                      </div>
                      <p className="text-xs text-foreground-500">
                        Fecha dia {conta.dia_fechamento} · vence dia {conta.dia_vencimento}
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs text-foreground-500">Saldo</p>
                      <p className="text-xl font-bold">
                        {formatarDinheiroPrivado(conta.saldo_inicial, valoresOcultos)}
                      </p>
                    </div>
                  )}
                </Card.Content>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Modal de criar/editar ──────────────────────────────── */}
      <ContaFormModal
        aberto={modalAberto}
        aoFechar={() => setModalAberto(false)}
        aoSalvar={salvar}
        conta={contaEditando}
        salvando={salvando}
      />
    </div>
  );
}

export default Contas;
