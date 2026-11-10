// Painel principal. Tudo vem dos cadastros: usuários (quem gasta), categorias, cartões.
// Os valores de gasto ficam em zero até existir a fatura importada (módulo de fatura ainda não existe).
import { useEffect, useMemo, useState } from 'react';
import { Spinner } from '@heroui/react';
import Seletor from '../../components/Seletor';
import { listarCartoes } from '../../services/cartaoService';
import { listarUsuarios } from '../../services/usuarioService';
import { listarCategorias } from '../../services/categoriaService';
import { properCase } from '../../utils/formatar';
import { calcular } from '../Faturas/componentes/calculos';
import ResumoCards from '../Faturas/componentes/ResumoCards';
import { AnalisePortador, AnaliseCategoria } from '../Faturas/componentes/Analises';
import CartoesDashboard from './componentes/CartoesDashboard';

const TODOS_CARTOES = { id: 'todos', nome: 'Todos os cartões' };
const NOME_SEM_CATEGORIA = 'Sem categoria';
const QUANTIDADE_COMPETENCIAS = 6;

export default function Dashboard() {
  const [cartoes, setCartoes] = useState(null);
  const [usuarios, setUsuarios] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [erro, setErro] = useState('');
  const [cartaoEscolhido, setCartaoEscolhido] = useState('todos');

  // Últimos 6 meses a partir de hoje, do mais recente para o mais antigo.
  const competencias = useMemo(() => {
    const formatoMes = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });

    return Array.from({ length: QUANTIDADE_COMPETENCIAS }, (_, deslocamento) => {
      const mes = new Date();
      mes.setMonth(mes.getMonth() - deslocamento, 1);

      const id = `${mes.getFullYear()}-${String(mes.getMonth() + 1).padStart(2, '0')}`;
      const textoMes = formatoMes.format(mes);
      return { id, nome: textoMes.charAt(0).toUpperCase() + textoMes.slice(1) };
    });
  }, []);

  const [competencia, setCompetencia] = useState(competencias[0].id);

  // Carrega cartões, membros e categorias dos cadastros.
  useEffect(() => {
    Promise.all([listarCartoes(), listarUsuarios(), listarCategorias()])
      .then(([cartoesResposta, usuariosResposta, categoriasResposta]) => {
        setCartoes(cartoesResposta.cartoes);
        setUsuarios(usuariosResposta.usuarios);
        setCategorias(categoriasResposta.categorias);
      })
      .catch((e) => setErro(e.message));
  }, []);

  if (erro) {
    return <p className="rounded-xl border border-dashed border-separator p-10 text-center text-danger">{erro}</p>;
  }
  if (!cartoes) {
    return <div className="flex justify-center p-16"><Spinner /></div>;
  }

  // Sem fatura importada ainda: resumo zerado, mas com as linhas reais de quem e de quais categorias.
  const resumo = calcular([], 0);
  const gastosPorPortador = usuarios.map((usuario) => ({ nome: usuario.nome, total: 0, pct: 0, qtd: 0 }));
  const gastosPorCategoria = [
    ...categorias.map((categoria) => ({ nome: properCase(categoria.valor), total: 0, pct: 0, qtd: 0 })),
    { nome: NOME_SEM_CATEGORIA, total: 0, pct: 0, qtd: 0 },
  ];

  const opcoesCartao = [
    TODOS_CARTOES,
    ...cartoes.map((cartao) => ({ id: cartao.id, nome: `${cartao.nome} ••${cartao.final}` })),
  ];
  const cartoesFiltrados = cartaoEscolhido === 'todos'
    ? cartoes
    : cartoes.filter((cartao) => cartao.id === cartaoEscolhido);

  return (
    <div className="space-y-5 md:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Início</h1>
          <p className="text-sm text-muted">Visão geral dos cartões da família</p>
        </div>
        <div className="grid w-full grid-cols-1 gap-2 min-[420px]:grid-cols-2 sm:flex sm:w-auto sm:flex-wrap">
          <Seletor rotulo="Cartão" itens={opcoesCartao} valor={cartaoEscolhido} onChange={setCartaoEscolhido} />
          <Seletor rotulo="Competência" itens={competencias} valor={competencia} onChange={setCompetencia} />
        </div>
      </div>

      <p className="text-sm text-muted">
        Sem lançamentos ainda: os valores aparecem quando a fatura for importada.
      </p>

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
