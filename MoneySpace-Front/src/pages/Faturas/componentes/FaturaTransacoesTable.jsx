// ========================================
// FaturaTransacoesTable — lançamentos da fatura (Task 17)
// ========================================
// Tabela dos lançamentos de uma competência. Muitos itens tabulares ->
// `Table` + `Table.ScrollContainer` do HeroUI (scroll horizontal no mobile,
// Req 11.3), conforme o padrão do agents.md. Sem mock: consome a API real
// via faturaService (Req 7.6).
//
// Recursos (Req 7):
//   - Colunas: data, estabelecimento, portador (chip), valor, parcela (badge),
//     categoria (com cor), status (badge colorida).                    7.1/7.2
//   - Busca por estabelecimento (manda `busca` ao serviço, com debounce). 7.3
//   - Filtros por portador, categoria e status.                          7.3
//   - Ordenação por data (dt_compra) e valor (asc/desc) via `sort`.      7.4
//   - Edição inline de categoria, portador mapeado e status_liquidacao
//     por linha, persistida no backend; a UI só reflete APÓS a resposta
//     (nada otimista). Mudança de status recalcula o resumo -> avisamos o
//     pai via onTransacaoAtualizada para recarregar o dashboard.    7.5/4.4/4.5
//   - Edição bloqueada (tabela read-only) quando a fatura está
//     FECHADA/PAGA; mostra um aviso.                                     7.7
//   - Paginação simples anterior/próxima com total/page/page_size.
//
// Valores monetários chegam como string (pg NUMERIC). Formatamos com os
// utilitários pt-BR e respeitamos o PrivacyContext (formatarDinheiroPrivado).
//
// LIMITAÇÃO conhecida (MVP): não existe categoriaService nem usuarioService em
// src/services. Então as OPÇÕES de filtro e de edição inline para portador e
// categoria são derivadas das listas do dashboard (`portadores` <- por_portador,
// `categorias` <- por_categoria), que só listam itens JÁ presentes na fatura.
// Além disso, as opções da linha são complementadas com o portador/categoria da
// própria transação (para não "sumir" o valor atual de uma linha que não esteja
// nas agregações). Quando houver um serviço de listagem completo de categorias
// e de usuários da família, trocar as fontes `portadores`/`categorias` por ele.
//
// Props:
//   - idFatura               (uuid)  fatura cujas transações listar
//   - faturaStatus           (str)   status da fatura ('ABERTA'|'FECHADA'|'PAGA')
//   - portadores             (array) [{ id_usuario, nome }] p/ opções de portador
//   - categorias             (array) [{ id_categoria, nome, cor }] p/ opções
//   - onTransacaoAtualizada()        callback após editar (pai recarrega dashboard)

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Card,
  Chip,
  Button,
  Select,
  ListBox,
  InputGroup,
  Spinner,
  toast,
} from '@heroui/react';
import {
  FiSearch,
  FiAlertCircle,
  FiLock,
  FiChevronLeft,
  FiChevronRight,
  FiArrowUp,
  FiArrowDown,
  FiInbox,
} from 'react-icons/fi';
import { usePrivacy } from '../../../context/PrivacyContext';
import { formatarData, formatarDinheiroPrivado } from '../../../utils/format';
import {
  listarTransacoes,
  atualizarTransacao,
} from '../../../services/faturaService';

const PAGE_SIZE = 50;

// Os quatro status de liquidação em texto simples (domínio do banco).
const STATUS_OPCOES = [
  { id: 'pendente', rotulo: 'Pendente' },
  { id: 'na hora', rotulo: 'Na hora' },
  { id: 'no fechamento', rotulo: 'No fechamento' },
  { id: 'nao aplicavel', rotulo: 'N/A' },
];

// Mapa de rótulo/cor do status — mesmo mapeamento do ImportarFaturaModal
// (consistência visual entre a prévia e a tabela final).
function rotuloStatus(status) {
  switch (status) {
    case 'pendente':
      return { texto: 'Pendente', cor: 'warning' };
    case 'na hora':
      return { texto: 'Na hora', cor: 'success' };
    case 'no fechamento':
      return { texto: 'No fechamento', cor: 'secondary' };
    case 'nao aplicavel':
      return { texto: 'N/A', cor: 'default' };
    default:
      return { texto: status || '-', cor: 'default' };
  }
}

// Sentinela usada no Select para representar "sem filtro" / "sem valor".
// O HeroUI Select trabalha melhor com uma key não-vazia do que com null.
const NENHUM = '__nenhum__';

function FaturaTransacoesTable({
  idFatura,
  faturaStatus,
  portadores = [],
  categorias = [],
  onTransacaoAtualizada,
}) {
  const { valoresOcultos } = usePrivacy();

  // A fatura trava edição quando FECHADA ou PAGA (Req 7.7).
  const bloqueado = faturaStatus === 'FECHADA' || faturaStatus === 'PAGA';

  // ── Dados e estado da listagem ──────────────────────────────
  const [transacoes, setTransacoes] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(false);

  // ── Filtros / busca / ordenação ────────────────────────────
  const [busca, setBusca] = useState(''); // texto digitado (campo)
  const [buscaAplicada, setBuscaAplicada] = useState(''); // após debounce
  const [filtroStatus, setFiltroStatus] = useState(NENHUM);
  const [filtroPortador, setFiltroPortador] = useState(NENHUM);
  const [filtroCategoria, setFiltroCategoria] = useState(NENHUM);
  const [sortCampo, setSortCampo] = useState('dt_compra'); // 'dt_compra' | 'valor'
  const [sortDir, setSortDir] = useState('desc'); // 'asc' | 'desc'

  // Linha em gravação (desabilita seus selects enquanto o PATCH não volta).
  const [salvandoId, setSalvandoId] = useState(null);

  // Debounce leve da busca por estabelecimento (Req 7.3).
  useEffect(() => {
    const t = setTimeout(() => setBuscaAplicada(busca.trim()), 350);
    return () => clearTimeout(t);
  }, [busca]);

  // Qualquer mudança de filtro/busca/sort volta para a página 1.
  useEffect(() => {
    setPage(1);
  }, [buscaAplicada, filtroStatus, filtroPortador, filtroCategoria, sortCampo, sortDir]);

  // Monta os filtros para o serviço, omitindo os sentinela/vazios.
  const filtros = useMemo(
    () => ({
      busca: buscaAplicada || undefined,
      status: filtroStatus === NENHUM ? undefined : filtroStatus,
      portador: filtroPortador === NENHUM ? undefined : filtroPortador,
      categoria: filtroCategoria === NENHUM ? undefined : filtroCategoria,
      sort: `${sortCampo}:${sortDir}`,
      page,
      page_size: PAGE_SIZE,
    }),
    [buscaAplicada, filtroStatus, filtroPortador, filtroCategoria, sortCampo, sortDir, page]
  );

  // Busca no backend sempre que idFatura ou filtros mudarem (Req 7.6: API real).
  // Usamos um "token" para ignorar respostas fora de ordem (race na digitação).
  const reqToken = useRef(0);
  const carregar = useCallback(async () => {
    if (!idFatura) {
      setTransacoes([]);
      setTotal(0);
      return;
    }
    const meu = ++reqToken.current;
    setCarregando(true);
    setErro(false);
    try {
      const dados = await listarTransacoes(idFatura, filtros);
      if (meu !== reqToken.current) return; // resposta obsoleta
      setTransacoes(dados?.transacoes ?? []);
      setTotal(Number(dados?.total ?? 0));
    } catch {
      if (meu !== reqToken.current) return;
      setErro(true);
      setTransacoes([]);
      setTotal(0);
      toast.danger('Não foi possível carregar os lançamentos.');
    } finally {
      if (meu === reqToken.current) setCarregando(false);
    }
  }, [idFatura, filtros]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // ── Opções de edição/filtro derivadas (ver LIMITAÇÃO no topo) ──
  // Normaliza portadores do dashboard para { id, nome }.
  const opcoesPortadorBase = useMemo(
    () =>
      (portadores ?? [])
        .filter((p) => p && p.id_usuario)
        .map((p) => ({ id: p.id_usuario, nome: p.nome ?? 'Portador' })),
    [portadores]
  );

  // Normaliza categorias do dashboard para { id, nome, cor }.
  const opcoesCategoriaBase = useMemo(
    () =>
      (categorias ?? [])
        .filter((c) => c && c.id_categoria)
        .map((c) => ({ id: c.id_categoria, nome: c.nome ?? 'Categoria', cor: c.cor ?? null })),
    [categorias]
  );

  // Completa as opções com os valores presentes nas transações carregadas,
  // para não "sumir" o valor atual de uma linha fora das agregações.
  const opcoesPortador = useMemo(() => {
    const mapa = new Map(opcoesPortadorBase.map((o) => [o.id, o]));
    for (const t of transacoes) {
      if (t.id_usuario_portador && !mapa.has(t.id_usuario_portador)) {
        mapa.set(t.id_usuario_portador, {
          id: t.id_usuario_portador,
          nome: t.portador_nome || t.portador_nome_importado || 'Portador',
        });
      }
    }
    return [...mapa.values()];
  }, [opcoesPortadorBase, transacoes]);

  const opcoesCategoria = useMemo(() => {
    const mapa = new Map(opcoesCategoriaBase.map((o) => [o.id, o]));
    for (const t of transacoes) {
      if (t.id_categoria && !mapa.has(t.id_categoria)) {
        mapa.set(t.id_categoria, {
          id: t.id_categoria,
          nome: t.categoria_nome || 'Categoria',
          cor: t.categoria_cor ?? null,
        });
      }
    }
    return [...mapa.values()];
  }, [opcoesCategoriaBase, transacoes]);

  // ── Edição inline (Req 7.5 / 4.4) ──────────────────────────
  // Envia só o campo que mudou; atualiza a linha APÓS a resposta do servidor
  // (nada otimista) e avisa o pai para recarregar o dashboard (Req 4.5).
  const editarCampo = async (transacao, patch) => {
    if (bloqueado) return;
    setSalvandoId(transacao.id);
    try {
      const atualizada = await atualizarTransacao(idFatura, transacao.id, patch);
      setTransacoes((lista) =>
        lista.map((t) => (t.id === transacao.id ? { ...t, ...(atualizada ?? patch) } : t))
      );
      toast.success('Lançamento atualizado.');
      if (onTransacaoAtualizada) onTransacaoAtualizada();
    } catch (e) {
      toast.danger(
        e?.response?.data?.message || 'Não foi possível atualizar o lançamento.'
      );
    } finally {
      setSalvandoId(null);
    }
  };

  // Converte a key do Select (string ou NENHUM) em UUID ou null.
  const keyParaId = (key) => (!key || key === NENHUM ? null : String(key));

  // Alterna/define a ordenação. Clicar no mesmo campo inverte a direção.
  const ordenarPor = (campo) => {
    if (sortCampo === campo) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCampo(campo);
      setSortDir('desc');
    }
  };

  // Ícone de direção para o cabeçalho ordenável.
  const SetaSort = ({ campo }) => {
    if (sortCampo !== campo) return null;
    return sortDir === 'asc' ? (
      <FiArrowUp size={12} className="inline" />
    ) : (
      <FiArrowDown size={12} className="inline" />
    );
  };

  // ── Paginação ───────────────────────────────────────────────
  const totalPaginas = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const inicio = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const fim = Math.min(page * PAGE_SIZE, total);

  // ── Seletor de edição inline reutilizável ───────────────────
  // `valor` = id atual (ou null); `opcoes` = [{ id, nome }]; permite limpar.
  function EditSelect({ ariaLabel, valor, opcoes, permitirLimpar, onEscolher }) {
    // Monta UM array de itens (inclui "sem valor" como item real, nunca um
    // `&&` solto dentro do ListBox — isso quebra a coleção do React Aria).
    const itens = [
      ...(permitirLimpar ? [{ id: NENHUM, nome: '— Sem valor —' }] : []),
      ...opcoes,
    ];
    return (
      <Select
        aria-label={ariaLabel}
        value={valor ?? NENHUM}
        isDisabled={bloqueado || salvandoId !== null}
        onChange={(key) => onEscolher(keyParaId(key))}
        className="min-w-[9rem]"
      >
        <Select.Trigger className="h-8">
          <Select.Value placeholder="—" />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox items={itens}>
            {(o) => <ListBox.Item id={o.id}>{o.nome}</ListBox.Item>}
          </ListBox>
        </Select.Popover>
      </Select>
    );
  }

  // Cabeçalho do card (título + aviso de bloqueio) usado em todos os estados.
  const Cabecalho = (
    <Card.Header className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <Card.Title>Lançamentos</Card.Title>
        {total > 0 && (
          <span className="text-xs text-foreground-500">
            {total} lançamento{total === 1 ? '' : 's'}
          </span>
        )}
      </div>
      {bloqueado && (
        <div className="flex items-center gap-2 rounded-lg bg-default-100 px-3 py-2 text-xs text-foreground-500">
          <FiLock size={14} className="shrink-0" />
          Fatura {faturaStatus?.toLowerCase()}: edição de lançamentos bloqueada.
        </div>
      )}
    </Card.Header>
  );

  return (
    <Card>
      {Cabecalho}

      <Card.Content className="space-y-4">
        {/* ── Busca + filtros + ordenação ─────────────────────── */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Busca por estabelecimento */}
          <div className="sm:col-span-2 lg:col-span-1">
            <InputGroup>
              <InputGroup.Prefix>
                <FiSearch size={16} className="text-foreground-500" />
              </InputGroup.Prefix>
              <InputGroup.Input
                placeholder="Buscar estabelecimento"
                aria-label="Buscar por estabelecimento"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </InputGroup>
          </div>

          {/* Filtro por portador */}
          <Select
            aria-label="Filtrar por portador"
            value={filtroPortador}
            onChange={(key) => setFiltroPortador(key ? String(key) : NENHUM)}
          >
            <Select.Trigger>
              <Select.Value placeholder="Portador" />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox items={[{ id: NENHUM, nome: 'Todos os portadores' }, ...opcoesPortador]}>
                {(o) => <ListBox.Item id={o.id}>{o.nome}</ListBox.Item>}
              </ListBox>
            </Select.Popover>
          </Select>

          {/* Filtro por categoria */}
          <Select
            aria-label="Filtrar por categoria"
            value={filtroCategoria}
            onChange={(key) => setFiltroCategoria(key ? String(key) : NENHUM)}
          >
            <Select.Trigger>
              <Select.Value placeholder="Categoria" />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox items={[{ id: NENHUM, nome: 'Todas as categorias' }, ...opcoesCategoria]}>
                {(o) => <ListBox.Item id={o.id}>{o.nome}</ListBox.Item>}
              </ListBox>
            </Select.Popover>
          </Select>

          {/* Filtro por status */}
          <Select
            aria-label="Filtrar por status"
            value={filtroStatus}
            onChange={(key) => setFiltroStatus(key ? String(key) : NENHUM)}
          >
            <Select.Trigger>
              <Select.Value placeholder="Status" />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox items={[{ id: NENHUM, rotulo: 'Todos os status' }, ...STATUS_OPCOES]}>
                {(s) => <ListBox.Item id={s.id}>{s.rotulo}</ListBox.Item>}
              </ListBox>
            </Select.Popover>
          </Select>
        </div>

        {/* ── Estado: carregando ──────────────────────────────── */}
        {carregando && (
          <div className="flex items-center justify-center gap-2 py-12 text-foreground-500">
            <Spinner size="sm" />
            <span className="text-sm">Carregando lançamentos...</span>
          </div>
        )}

        {/* ── Estado: erro ────────────────────────────────────── */}
        {!carregando && erro && (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex items-center justify-center size-12 rounded-xl bg-danger/10 text-danger">
              <FiAlertCircle size={24} />
            </div>
            <div>
              <p className="font-semibold">Não foi possível carregar os lançamentos</p>
              <p className="text-sm text-foreground-500">Tente novamente.</p>
            </div>
            <Button color="primary" variant="flat" onPress={carregar}>
              Tentar de novo
            </Button>
          </div>
        )}

        {/* ── Estado: vazio ───────────────────────────────────── */}
        {!carregando && !erro && transacoes.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex items-center justify-center size-12 rounded-xl bg-default-100 text-foreground-500">
              <FiInbox size={24} />
            </div>
            <div>
              <p className="font-semibold">Nenhum lançamento</p>
              <p className="text-sm text-foreground-500">
                Ajuste a busca/filtros ou importe a fatura para ver os lançamentos aqui.
              </p>
            </div>
          </div>
        )}

        {/* ── Tabela ──────────────────────────────────────────── */}
        {!carregando && !erro && transacoes.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-black/10 dark:border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-default-100 text-left text-xs text-foreground-500">
                <tr>
                  <th className="px-3 py-2 font-medium">
                    <button
                      type="button"
                      onClick={() => ordenarPor('dt_compra')}
                      className="flex items-center gap-1 font-semibold"
                      aria-label="Ordenar por data"
                    >
                      Data <SetaSort campo="dt_compra" />
                    </button>
                  </th>
                  <th className="px-3 py-2 font-medium">Estabelecimento</th>
                  <th className="px-3 py-2 font-medium">Portador</th>
                  <th className="px-3 py-2 text-right font-medium">
                    <button
                      type="button"
                      onClick={() => ordenarPor('valor')}
                      className="ml-auto flex items-center gap-1 font-semibold"
                      aria-label="Ordenar por valor"
                    >
                      Valor <SetaSort campo="valor" />
                    </button>
                  </th>
                  <th className="px-3 py-2 font-medium">Parcela</th>
                  <th className="px-3 py-2 font-medium">Categoria</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {transacoes.map((t) => {
                  const st = rotuloStatus(t.status_liquidacao);
                  const temParcela = t.parcela_texto && t.parcela_texto !== '-';
                  const nomePortador =
                    t.portador_nome || t.portador_nome_importado || null;

                  return (
                    <tr key={t.id} className="border-t border-black/5 dark:border-white/5">
                      <td className="whitespace-nowrap px-3 py-2">
                        {formatarData(t.dt_compra)}
                      </td>
                      <td className="max-w-[16rem] truncate px-3 py-2">
                        {t.estabelecimento || '-'}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
                        {bloqueado ? (
                          nomePortador ? (
                            <Chip size="sm" variant="flat">
                              {nomePortador}
                            </Chip>
                          ) : (
                            '-'
                          )
                        ) : (
                          <EditSelect
                            ariaLabel={`Portador de ${t.estabelecimento || 'lançamento'}`}
                            valor={t.id_usuario_portador}
                            opcoes={opcoesPortador}
                            permitirLimpar
                            onEscolher={(id) =>
                              id !== (t.id_usuario_portador ?? null) &&
                              editarCampo(t, { id_usuario_portador: id })
                            }
                          />
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right font-medium">
                        {formatarDinheiroPrivado(t.valor, valoresOcultos)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
                        {temParcela ? (
                          <Chip size="sm" variant="flat">
                            {t.parcela_texto}
                          </Chip>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
                        {bloqueado ? (
                          t.categoria_nome ? (
                            <Chip
                              size="sm"
                              variant="flat"
                              style={
                                t.categoria_cor
                                  ? {
                                      backgroundColor: `${t.categoria_cor}22`,
                                      color: t.categoria_cor,
                                    }
                                  : undefined
                              }
                            >
                              {t.categoria_nome}
                            </Chip>
                          ) : (
                            '-'
                          )
                        ) : (
                          <EditSelect
                            ariaLabel={`Categoria de ${t.estabelecimento || 'lançamento'}`}
                            valor={t.id_categoria}
                            opcoes={opcoesCategoria}
                            permitirLimpar
                            onEscolher={(id) =>
                              id !== (t.id_categoria ?? null) &&
                              editarCampo(t, { id_categoria: id })
                            }
                          />
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
                        {bloqueado ? (
                          <Chip size="sm" variant="flat" color={st.cor}>
                            {st.texto}
                          </Chip>
                        ) : (
                          <Select
                            aria-label={`Status de ${t.estabelecimento || 'lançamento'}`}
                            value={t.status_liquidacao}
                            isDisabled={salvandoId !== null}
                            onChange={(key) => {
                              const novo = key ? String(key) : null;
                              if (novo && novo !== t.status_liquidacao) {
                                editarCampo(t, { status_liquidacao: novo });
                              }
                            }}
                            className="min-w-[9rem]"
                          >
                            <Select.Trigger className="h-8">
                              <Select.Value placeholder="Status" />
                              <Select.Indicator />
                            </Select.Trigger>
                            <Select.Popover>
                              <ListBox items={STATUS_OPCOES}>
                                {(s) => <ListBox.Item id={s.id}>{s.rotulo}</ListBox.Item>}
                              </ListBox>
                            </Select.Popover>
                          </Select>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Paginação ───────────────────────────────────────── */}
        {!carregando && !erro && total > 0 && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-foreground-500">
              {inicio}–{fim} de {total}
            </span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                isDisabled={page <= 1 || carregando}
                onPress={() => setPage((p) => Math.max(1, p - 1))}
                aria-label="Página anterior"
              >
                <FiChevronLeft size={16} />
                Anterior
              </Button>
              <span className="text-xs text-foreground-500">
                {page}/{totalPaginas}
              </span>
              <Button
                size="sm"
                variant="ghost"
                isDisabled={page >= totalPaginas || carregando}
                onPress={() => setPage((p) => Math.min(totalPaginas, p + 1))}
                aria-label="Próxima página"
              >
                Próxima
                <FiChevronRight size={16} />
              </Button>
            </div>
          </div>
        )}
      </Card.Content>
    </Card>
  );
}

export default FaturaTransacoesTable;






