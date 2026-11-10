// Painel principal. Tudo vem de GET /dashboard (cartões, resumo, quem gasta e categorias).
// Ao abrir, o back escolhe o cartão principal; trocar o cartão ou a competência recarrega o painel.
import { useEffect, useState } from 'react';
import { Spinner, toast } from '@heroui/react';
import Seletor from '../../components/Seletor';
import { buscarDashboard } from '../../services/dashboardService';
import { properCase } from '../../utils/formatar';
import ResumoCards from '../Faturas/componentes/ResumoCards';
import { AnalisePortador, AnaliseCategoria } from '../Faturas/componentes/Analises';
import CartoesDashboard from './componentes/CartoesDashboard';

const TODOS_CARTOES = { id: 'todos', nome: 'Todos os cartões' };
const NOME_SEM_CATEGORIA = 'Sem categoria';
const formatoMes = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });

// '2026-10' -> 'Outubro de 2026'
function nomeCompetencia(competencia) {
  const [ano, mes] = competencia.split('-').map(Number);
  const texto = formatoMes.format(new Date(Date.UTC(ano, mes - 1, 1)));
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export default function Dashboard() {
  const [dados, setDados] = useState(null); // resposta do back
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [competencia, setCompetencia] = useState(''); // '' = padrão do back (fatura mais recente)
  const [cartaoEscolhido, setCartaoEscolhido] = useState(''); // '' = padrão do back (cartão principal)

  // Trocar o cartão volta para a fatura mais recente dele.
  const trocarCartao = (idCartao) => {
    setCartaoEscolhido(idCartao);
    setCompetencia('');
  };

  // Busca o painel sempre que o cartão ou a competência mudam.
  useEffect(() => {
    let cancelado = false;
    setCarregando(true);

    buscarDashboard(competencia || undefined, cartaoEscolhido || undefined)
      .then((resposta) => { if (!cancelado) { setDados(resposta); setErro(''); } })
      .catch((e) => {
        if (cancelado) return;
        if (dados) toast.danger(e.message);
        else setErro(e.message);
      })
      .finally(() => { if (!cancelado) setCarregando(false); });

    return () => { cancelado = true; };
  }, [competencia, cartaoEscolhido]);

  if (erro) {
    return <p className="rounded-xl border border-dashed border-separator p-10 text-center text-danger">{erro}</p>;
  }
  if (!dados) {
    return <div className="flex justify-center p-16"><Spinner /></div>;
  }

  // Cartão exibido: o escolhido pelo usuário ou o que o back devolveu como padrão.
  const cartaoAtual = cartaoEscolhido || dados.cartaoId;
  const opcoesCartao = [
    TODOS_CARTOES,
    ...dados.cartoes.map((cartao) => ({ id: cartao.id, nome: `${cartao.nome} ••${cartao.final}` })),
  ];
  // Competências com fatura; garante que a exibida esteja na lista (ex.: mês atual sem fatura).
  const listaCompetencias = dados.competencias.includes(dados.competencia)
    ? dados.competencias
    : [dados.competencia, ...dados.competencias];
  const opcoesCompetencia = listaCompetencias.map((item) => ({ id: item, nome: nomeCompetencia(item) }));

  const cartoesFiltrados = cartaoAtual === 'todos'
    ? dados.cartoes
    : dados.cartoes.filter((cartao) => cartao.id === cartaoAtual);

  // Resumo no formato dos cards (meta = o que deveria estar na reserva: na hora + pendente).
  const meta = dados.resumo.pago + dados.resumo.pendente;
  const resumo = {
    bruto: dados.resumo.total,
    pago: dados.resumo.pago,
    pendente: dados.resumo.pendente,
    fechamento: dados.resumo.fechamento,
    meta,
    diferenca: dados.resumo.saldoReserva - meta,
  };

  const gastosPorPortador = dados.portadores.map((portador) => ({
    nome: portador.nome, total: portador.total, pct: portador.pct, qtd: portador.qtd,
  }));
  const gastosPorCategoria = [
    ...dados.categorias.map((categoria) => ({
      nome: properCase(categoria.nome), total: categoria.total, pct: categoria.pct, qtd: categoria.qtd,
    })),
    { nome: NOME_SEM_CATEGORIA, total: dados.semCategoria.total, pct: dados.semCategoria.pct, qtd: dados.semCategoria.qtd },
  ];
  const semLancamentos = dados.resumo.total === 0;

  return (
    <div className="space-y-5 md:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">Início {carregando && <Spinner size="sm" />}</h1>
          <p className="text-sm text-muted">Visão geral dos cartões da família</p>
        </div>
        <div className="grid w-full grid-cols-1 gap-2 min-[420px]:grid-cols-2 sm:flex sm:w-auto sm:flex-wrap">
          <Seletor rotulo="Cartão" itens={opcoesCartao} valor={cartaoAtual} onChange={trocarCartao} />
          <Seletor rotulo="Competência" itens={opcoesCompetencia} valor={dados.competencia} onChange={setCompetencia} />
        </div>
      </div>

      {semLancamentos && (
        <p className="text-sm text-muted">Sem lançamentos neste período para o cartão escolhido.</p>
      )}

      <ResumoCards c={resumo} />

      <div className="grid gap-4 lg:grid-cols-2">
        <AnalisePortador dados={gastosPorPortador} />
        <AnaliseCategoria dados={gastosPorCategoria} />
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Cartões</h2>
        <CartoesDashboard cartoes={cartoesFiltrados} />
      </section>
    </div>
  );
}
