// Faturas: lê e grava no banco. O seletor de competência lista as faturas que já existem do cartão.
// Para criar um mês novo, o botão "Criar fatura" escolhe o mês.
// PC: conferência fixa à esquerda e lançamentos à direita.
// Celular: duas abas, "Resumo" (totais + conferência) e "Detalhes" (filtros + cards).
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Chip, Spinner, Tabs, toast, useOverlayState } from '@heroui/react';
import { FiPlus, FiChevronsLeft } from 'react-icons/fi';
import Seletor from '../../components/Seletor';
import useIsMobile from '../../hooks/useIsMobile';
import { listarCartoes } from '../../services/cartaoService';
import { listarUsuarios } from '../../services/usuarioService';
import { listarCategorias } from '../../services/categoriaService';
import {
  listarFaturasCartao,
  buscarFatura,
  fecharFatura,
  salvarSaldoFatura,
  alterarStatusLancamento,
  editarLancamento,
  criarFatura,
  abrirFatura
} from '../../services/faturaService';
import { proximaCompetencia, nomeCompetencia } from '../../utils/formatar';
import { STATUS, statusDoBanco } from '../../utils/statusFatura';
import { calcular } from './componentes/calculos';
import ConferenciaReserva from './componentes/ConferenciaReserva';
import ResumoFaturaFaixa from './componentes/ResumoFaturaFaixa';
import TransacoesLista from './componentes/TransacoesLista';
import CriarFaturaModal from './componentes/CriarFaturaModal';
import LancamentoFormModal from './componentes/LancamentoFormModal';
import ExcluirLancamentoModal from './componentes/ExcluirLancamentoModal';
import ProximaFaturaModal from './componentes/ProximaFaturaModal';

const CHAVE_CONFERENCIA = 'faturas:conferencia';

// '2026-10-25' -> '25/10'
const br = (iso) => iso.split('-').reverse().join('/');

export default function Faturas() {
  const isMobile = useIsMobile();

  const [cartoes, setCartoes] = useState(null);
  const [usuarios, setUsuarios] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [cartaoId, setCartaoId] = useState('');
  const [faturasCartao, setFaturasCartao] = useState([]); // faturas que já existem do cartão
  const [competenciaId, setCompetenciaId] = useState('');
  const [dados, setDados] = useState(null); // { cartao, fatura, lancamentos }
  const [carregandoFatura, setCarregandoFatura] = useState(false);
  const [saldoTexto, setSaldoTexto] = useState('0');
  const [filtro, setFiltro] = useState('todos');
  const [abaMobile, setAbaMobile] = useState('resumo');
  const [erro, setErro] = useState('');
  const modalCriar = useOverlayState();
  const modalLancar = useOverlayState();
  const modalExcluir = useOverlayState();
  const modalProxima = useOverlayState();
  const [lancamentoEditando, setLancamentoEditando] = useState(null); // null = criar novo
  const [lancamentoExcluindo, setLancamentoExcluindo] = useState(null);
  // Conferência aberta/recolhida no PC (fica lembrado entre as visitas).
  const [conferenciaAberta, setConferenciaAberta] = useState(
    () => localStorage.getItem(CHAVE_CONFERENCIA) !== 'recolhida'
  );

  const alternarConferencia = () => {
    setConferenciaAberta((aberta) => {
      localStorage.setItem(CHAVE_CONFERENCIA, aberta ? 'recolhida' : 'aberta');
      return !aberta;
    });
  };

  // Carrega cartões, membros e categorias (para os selects e lançamentos).
  useEffect(() => {
    Promise.all([listarCartoes(), listarUsuarios(), listarCategorias()])
      .then(([cartoesResposta, usuariosResposta, categoriasResposta]) => {
        setCartoes(cartoesResposta.cartoes);
        setUsuarios(usuariosResposta.usuarios);
        setCategorias(categoriasResposta.categorias);
        if (cartoesResposta.cartoes.length > 0) setCartaoId(cartoesResposta.cartoes[0].id);
      })
      .catch((e) => setErro(e.message));
  }, []);

  // Recarrega as faturas do cartão. Com `escolherPrimeira`, seleciona a mais recente.
  const carregarFaturasCartao = (escolherPrimeira = false) => {
    if (!cartaoId) return Promise.resolve();
    return listarFaturasCartao(cartaoId)
      .then((resposta) => {
        setFaturasCartao(resposta.faturas);
        if (escolherPrimeira) setCompetenciaId(resposta.faturas[0]?.competencia ?? '');
      })
      .catch((e) => toast.danger(e.message));
  };

  useEffect(() => { carregarFaturasCartao(true); }, [cartaoId]);

  // Busca a fatura do cartão e competência escolhidos. Usada também depois de cada alteração.
  const carregarFatura = () => {
    if (!cartaoId || !competenciaId) {
      setDados(null);
      return Promise.resolve();
    }

    setCarregandoFatura(true);
    return buscarFatura(cartaoId, competenciaId)
      .then((resposta) => {
        setDados(resposta);
        setSaldoTexto(String(resposta.fatura?.saldoReserva ?? 0).replace('.', ','));
      })
      .catch((e) => toast.danger(e.message))
      .finally(() => setCarregandoFatura(false));
  };

  useEffect(() => { carregarFatura(); }, [cartaoId, competenciaId]);

  if (erro) {
    return <p className="rounded-xl border border-dashed border-separator p-10 text-center text-danger">{erro}</p>;
  }
  if (!cartoes) {
    return <div className="flex justify-center p-16"><Spinner /></div>;
  }

  // Dados da tela (vindos do banco)
  const fatura = dados?.fatura ?? null;
  const cartaoSelecionado = cartoes.find((cartao) => cartao.id === cartaoId);
  const saldoNumero = Number(saldoTexto.replace(',', '.')) || 0;

  // Seletor de competência: só as faturas que existem, com o nome delas
  const opcoesCompetencia = faturasCartao.map((f) => ({
    id: f.competencia,
    nome: f.fechada ? `${f.titulo} · fechada` : f.titulo,
  }));

  // Lançamentos no formato que a tabela e o resumo entendem
  const lancamentos = (dados?.lancamentos ?? []).map((lancamento) => ({
    id: lancamento.id,
    data: lancamento.dataCompra,
    estabelecimento: lancamento.estabelecimento,
    portador: lancamento.portador ?? '—',
    valor: lancamento.valor,
    parcela: lancamento.parcela,
    categoria: lancamento.categoria,
    status: statusDoBanco(lancamento.statusTransacao),
  }));
  const c = calcular(lancamentos, saldoNumero);
  const visiveis = filtro === 'todos' ? lancamentos : lancamentos.filter((t) => t.status === filtro);

  // Ações (cada uma recarrega a fatura no fim)
  const salvarSaldo = () => {
    if (!fatura || fatura.fechada) return;
    salvarSaldoFatura(fatura.id, saldoNumero).catch((e) => toast.danger(e.message));
  };

  // Fecha a fatura e pergunta se já quer abrir a próxima.
  const fechar = () => {
    fecharFatura(fatura.id)
      .then(() => {
        toast.success('Fatura fechada.');
        carregarFatura();
        modalProxima.open();
      })
      .catch((e) => toast.danger(e.message));
  };

  // Reabre a fatura fechada para ajustes.
  const reabrir = () => {
    abrirFatura(fatura.id)
      .then(() => { toast.success('Fatura aberta para ajustes.'); return carregarFatura(); })
      .catch((e) => toast.danger(e.message));
  };

  // Abre a fatura do mês seguinte: seleciona se já existe, senão cria.
  const abrirProxima = () => {
    const competenciaSeguinte = proximaCompetencia(fatura.competencia);
    const jaExiste = faturasCartao.some((f) => f.competencia === competenciaSeguinte);

    if (jaExiste) {
      setCompetenciaId(competenciaSeguinte);
      return;
    }

    criarFatura(cartaoId, competenciaSeguinte)
      .then((faturaCriada) => {
        toast.success(`Fatura de ${faturaCriada.titulo} criada.`);
        carregarFaturasCartao(false);
        setCompetenciaId(faturaCriada.competencia);
      })
      .catch((e) => toast.danger(e.message));
  };

  const mudarStatus = (idLancamento, chaveStatus) => {
    alterarStatusLancamento(idLancamento, STATUS[chaveStatus].valorBanco)
      .then(carregarFatura)
      .catch((e) => toast.danger(e.message));
  };

  const mudarCategoria = (idLancamento, valorCategoria) => {
    editarLancamento(idLancamento, { categoria: valorCategoria })
      .then(carregarFatura)
      .catch((e) => toast.danger(e.message));
  };

  const abrirNovoLancamento = () => {
    setLancamentoEditando(null);
    modalLancar.open();
  };

  const abrirEditarLancamento = (tr) => {
    setLancamentoEditando(tr);
    modalLancar.open();
  };

  const pedirExclusao = (tr) => {
    setLancamentoExcluindo(tr);
    modalExcluir.open();
  };

  // Depois de criar, a nova fatura vira a selecionada.
  const aoCriarFatura = (faturaCriada) => {
    carregarFaturasCartao(false);
    setCompetenciaId(faturaCriada.competencia);
  };

  // Blocos da tela (montados uma vez e usados no PC ou no celular)
  const conferencia = fatura && (
    <ConferenciaReserva
      c={c}
      saldo={saldoTexto}
      onSaldo={setSaldoTexto}
      onSalvarSaldo={salvarSaldo}
      fechada={fatura.fechada}
      onFechar={fechar}
      onAbrir={reabrir}
    />
  );

  const faixa = fatura && <ResumoFaturaFaixa c={c} />;

  const lancamentosSecao = fatura && (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        {!isMobile && (
          <Button
            isIconOnly size="sm" variant="ghost"
            aria-label={conferenciaAberta ? 'Recolher conferência' : 'Mostrar conferência'}
            aria-expanded={conferenciaAberta}
            onPress={alternarConferencia}
          >
            <FiChevronsLeft size={18} className={`transition-transform duration-300 ${conferenciaAberta ? '' : 'rotate-180'}`} />
          </Button>
        )}
        <h2 className="text-lg font-semibold">Lançamentos ({lancamentos.length})</h2>
      </div>
      <Tabs selectedKey={filtro} onSelectionChange={setFiltro}>
        <Tabs.ListContainer>
          <Tabs.List aria-label="Filtrar por status">
            <Tabs.Tab id="todos">Todos<Tabs.Indicator /></Tabs.Tab>
            {Object.keys(STATUS).map((chave) => (
              <Tabs.Tab key={chave} id={chave}>{STATUS[chave].label}<Tabs.Indicator /></Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs.ListContainer>
      </Tabs>
      <TransacoesLista
        key={`${cartaoId}:${competenciaId}`}
        transacoes={visiveis}
        bloqueada={fatura.fechada}
        categorias={categorias}
        onStatus={mudarStatus}
        onCategoria={mudarCategoria}
        onEditar={abrirEditarLancamento}
        onExcluir={pedirExclusao}
      />
    </section>
  );

  // Conteúdo do corpo: sem cartão, carregando, sem fatura, ou a fatura
  let corpo;
  if (cartoes.length === 0) {
    corpo = (
      <p className="rounded-xl border border-dashed border-separator p-10 text-center text-muted">
        Cadastre um cartão antes de criar faturas.{' '}
        <Link to="/cadastros/cartoes" className="text-accent underline">Ir para cartões</Link>
      </p>
    );
  } else if (carregandoFatura && !dados) {
    corpo = <div className="flex justify-center p-16"><Spinner /></div>;
  } else if (!fatura) {
    corpo = (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-separator p-10 text-center">
        <p className="text-muted">
          {faturasCartao.length === 0
            ? <>O cartão <strong className="text-foreground">{cartaoSelecionado?.nome}</strong> ainda não tem faturas.</>
            : 'Escolha uma fatura ao lado ou crie um novo mês.'}
        </p>
        <Button onPress={modalCriar.open}><FiPlus size={16} /> Criar fatura</Button>
      </div>
    );
  } else if (isMobile) {
    // Celular: duas abas. Resumo = totais + conferência; Detalhes = filtros + cards.
    corpo = (
      <Tabs selectedKey={abaMobile} onSelectionChange={setAbaMobile}>
        <Tabs.ListContainer>
          <Tabs.List aria-label="Seções da fatura">
            <Tabs.Tab id="resumo">Resumo<Tabs.Indicator /></Tabs.Tab>
            <Tabs.Tab id="detalhes">Detalhes ({lancamentos.length})<Tabs.Indicator /></Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel id="resumo" className="space-y-4 pt-4">
          {faixa}
          {conferencia}
        </Tabs.Panel>

        <Tabs.Panel id="detalhes" className="pt-4">
          {lancamentosSecao}
        </Tabs.Panel>
      </Tabs>
    );
  } else {
    // PC: conferência fixa à esquerda e lançamentos à direita.
    // Recolher em 2 tempos: 1º a conferência sobe e some; 2º a coluna fecha e o grid cresce para a esquerda.
    // Abrir é o inverso: 1º a coluna abre; 2º a conferência desce e aparece. (o `delay` faz a sequência)
    corpo = (
      <div className={`grid gap-y-5 transition-[grid-template-columns,column-gap] duration-300 ease-in-out lg:items-start ${
        conferenciaAberta
          ? 'delay-0 lg:grid-cols-[20rem_minmax(0,1fr)] lg:gap-x-5'
          : 'delay-200 lg:grid-cols-[0rem_minmax(0,1fr)] lg:gap-x-0'}`}>
        <div className={`overflow-hidden lg:sticky lg:top-20 ${conferenciaAberta ? '' : 'max-lg:hidden'}`} inert={!conferenciaAberta}>
          <div className={`transition-[opacity,translate] duration-300 ease-in-out lg:w-80 ${
            conferenciaAberta
              ? 'translate-y-0 opacity-100 delay-200'
              : 'delay-0 lg:-translate-y-8 lg:opacity-0'}`}>
            {conferencia}
          </div>
        </div>

        <div className="min-w-0 space-y-4">
          {faixa}
          {lancamentosSecao}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Faturas</h1>
          {fatura && (
            <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
              Fecha {br(fatura.dataFechamento)} · vence {br(fatura.dataVencimento)}
              <Chip size="sm" variant="soft" color={fatura.fechada ? 'default' : 'success'}>
                {fatura.fechada ? 'Fechada' : 'Aberta'}
              </Chip>
            </p>
          )}
        </div>

        <div className="grid w-full grid-cols-1 gap-2 min-[420px]:grid-cols-2 sm:flex sm:w-auto sm:flex-wrap">
          {cartoes.length > 0 && (
            <Seletor
              rotulo="Cartão"
              itens={cartoes.map((cartao) => ({ id: cartao.id, nome: `${cartao.nome} ••${cartao.final}` }))}
              valor={cartaoId}
              onChange={setCartaoId}
            />
          )}
          {opcoesCompetencia.length > 0 && (
            <Seletor rotulo="Fatura" itens={opcoesCompetencia} valor={competenciaId} onChange={setCompetenciaId} />
          )}

          {cartoes.length > 0 && !fatura && !carregandoFatura && (
            <Button className="min-[420px]:col-span-2 sm:col-auto" onPress={modalCriar.open}>
              <FiPlus size={16} /> Criar fatura
            </Button>
          )}
          {fatura && fatura.fechada && (
            <Button className="min-[420px]:col-span-2 sm:col-auto" onPress={abrirProxima}>
              <FiPlus size={16} /> Abrir próxima fatura
            </Button>
          )}
          {fatura && !fatura.fechada && (
            <Button className="min-[420px]:col-span-2 sm:col-auto" variant="secondary" onPress={abrirNovoLancamento}>
              <FiPlus size={16} /> Lançar gasto
            </Button>
          )}
        </div>
      </div>

      {corpo}

      {cartoes.length > 0 && (
        <>
          <CriarFaturaModal
            state={modalCriar}
            cartao={cartaoSelecionado}
            onCriada={aoCriarFatura}
          />
          <LancamentoFormModal
            state={modalLancar}
            idFatura={fatura?.id}
            lancamento={lancamentoEditando}
            usuarios={usuarios}
            categorias={categorias}
            onSalvo={carregarFatura}
          />
          <ExcluirLancamentoModal
            state={modalExcluir}
            lancamento={lancamentoExcluindo}
            onExcluido={carregarFatura}
          />
          <ProximaFaturaModal
            state={modalProxima}
            competenciaProxima={fatura && { nome: nomeCompetencia(proximaCompetencia(fatura.competencia)) }}
            onCriar={() => { modalProxima.close(); abrirProxima(); }}
          />
        </>
      )}
    </div>
  );
}
