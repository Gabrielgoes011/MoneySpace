// ========================================
// FATURAS  (controle de fatura & conferência da reserva)
// ========================================
// Tela principal (shell) do módulo de fatura. Orquestra o estado e hospeda os
// componentes-filhos:
//   1) Carrega os cartões de crédito da família (contas tipo CREDITO ativas).
//   2) Ao escolher um cartão, lista suas faturas (competências), mais recente 1º.
//   3) Ao escolher a competência, carrega o dashboard dela e segura em estado.
//
// "Nova competência" cria o 1º mês do cartão (POST /faturas) — sem ela não há o
// que importar. Trocar cartão/competência atualiza tudo via estado (sem refresh).

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, Chip, Button, Select, ListBox, Spinner, toast } from '@heroui/react';
import {
  FiCreditCard,
  FiFileText,
  FiPlus,
  FiAlertCircle,
  FiUploadCloud,
  FiLock,
  FiCheckSquare,
  FiCalendar,
} from 'react-icons/fi';
import { listarContas } from '../../services/contaService';
import { listarFaturas, obterDashboard, fecharFatura } from '../../services/faturaService';
import FaturaResumo from './componentes/FaturaResumo';
import ReservaCard from './componentes/ReservaCard';
import ImportarFaturaModal from './componentes/ImportarFaturaModal';
import FaturaTransacoesTable from './componentes/FaturaTransacoesTable';
import AnalisePortador from './componentes/AnalisePortador';
import AnaliseCategoria from './componentes/AnaliseCategoria';
import NovaCompetenciaModal from './componentes/NovaCompetenciaModal';

// Ordena as faturas pela competência (DATE no 1º dia do mês), mais recente 1º.
function ordenarRecentePrimeiro(faturas) {
  return [...faturas].sort((a, b) => {
    const ca = a?.competencia ?? '';
    const cb = b?.competencia ?? '';
    return String(cb).localeCompare(String(ca));
  });
}

function Faturas() {
  // ── Cartões de crédito da família ───────────────────────────
  const [cartoes, setCartoes] = useState([]);
  const [carregandoCartoes, setCarregandoCartoes] = useState(true);
  const [idCartao, setIdCartao] = useState(null);

  // ── Faturas (competências) do cartão selecionado ────────────
  const [faturas, setFaturas] = useState([]);
  const [carregandoFaturas, setCarregandoFaturas] = useState(false);
  const [idFatura, setIdFatura] = useState(null);

  // ── Dashboard da competência selecionada ────────────────────
  const [dashboard, setDashboard] = useState(null);
  const [carregandoDashboard, setCarregandoDashboard] = useState(false);
  const [erroDashboard, setErroDashboard] = useState(false);

  // ── Modais ──────────────────────────────────────────────────
  const [importarAberto, setImportarAberto] = useState(false);
  const [novaCompetenciaAberta, setNovaCompetenciaAberta] = useState(false);

  // Força a tabela de lançamentos a recarregar após importar.
  const [recargaTransacoes, setRecargaTransacoes] = useState(0);

  // Trava o botão enquanto o fechamento da fatura está em andamento.
  const [fechandoFatura, setFechandoFatura] = useState(false);

  // 1) Carrega os cartões de crédito ao montar.
  useEffect(() => {
    (async () => {
      setCarregandoCartoes(true);
      try {
        const contas = await listarContas();
        const credito = contas.filter((c) => c.tipo === 'CREDITO' && c.ativo !== false);
        setCartoes(credito);
        if (credito.length > 0) setIdCartao(credito[0].id);
      } catch {
        toast.danger('Não foi possível carregar seus cartões.');
        setCartoes([]);
      } finally {
        setCarregandoCartoes(false);
      }
    })();
  }, []);

  // Re-lista as faturas do cartão atual (reuso: troca de cartão + pós-criação).
  const carregarFaturas = async (idDaConta, idParaSelecionar = null) => {
    if (!idDaConta) {
      setFaturas([]);
      setIdFatura(null);
      return;
    }
    setCarregandoFaturas(true);
    try {
      const lista = await listarFaturas(idDaConta);
      const ordenadas = ordenarRecentePrimeiro(lista);
      setFaturas(ordenadas);
      if (idParaSelecionar) {
        setIdFatura(idParaSelecionar);
      } else if (ordenadas.length > 0) {
        setIdFatura(ordenadas[0].id);
      } else {
        setIdFatura(null);
      }
    } catch {
      toast.danger('Não foi possível carregar as faturas deste cartão.');
      setFaturas([]);
      setIdFatura(null);
    } finally {
      setCarregandoFaturas(false);
    }
  };

  // 2) Quando troca o cartão, lista as faturas dele.
  useEffect(() => {
    if (!idCartao) {
      setFaturas([]);
      setIdFatura(null);
      return;
    }
    let ativo = true;
    (async () => {
      setCarregandoFaturas(true);
      setIdFatura(null);
      setDashboard(null);
      setErroDashboard(false);
      try {
        const lista = await listarFaturas(idCartao);
        if (!ativo) return;
        const ordenadas = ordenarRecentePrimeiro(lista);
        setFaturas(ordenadas);
        if (ordenadas.length > 0) setIdFatura(ordenadas[0].id);
      } catch {
        if (!ativo) return;
        toast.danger('Não foi possível carregar as faturas deste cartão.');
        setFaturas([]);
      } finally {
        if (ativo) setCarregandoFaturas(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, [idCartao]);

  // 3) Quando troca a competência, carrega o dashboard dela.
  useEffect(() => {
    if (!idFatura) {
      setDashboard(null);
      setErroDashboard(false);
      return;
    }
    let ativo = true;
    (async () => {
      setCarregandoDashboard(true);
      setErroDashboard(false);
      try {
        const dados = await obterDashboard(idFatura);
        if (!ativo) return;
        setDashboard(dados ?? null);
      } catch {
        if (!ativo) return;
        setErroDashboard(true);
        setDashboard(null);
        toast.danger('Não foi possível carregar os dados da fatura.');
      } finally {
        if (ativo) setCarregandoDashboard(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, [idFatura]);

  // Recarrega o dashboard da competência atual (após mutações).
  const recarregarDashboard = async () => {
    if (!idFatura) return;
    try {
      const dados = await obterDashboard(idFatura);
      setDashboard(dados ?? null);
      setErroDashboard(false);
    } catch {
      toast.danger('Não foi possível atualizar os dados da fatura.');
    }
  };

  // Após criar uma competência: re-lista e já seleciona a nova.
  const aoCriarCompetencia = async (faturaCriada) => {
    await carregarFaturas(idCartao, faturaCriada?.id ?? null);
  };

  // Resumo com guarda p/ competência vazia: zeros em vez de erro.
  const resumo = useMemo(() => {
    const r = dashboard?.resumo ?? {};
    return {
      total_fatura: r.total_fatura ?? '0.00',
      total_na_hora: r.total_na_hora ?? '0.00',
      total_pendente: r.total_pendente ?? '0.00',
      total_no_fechamento: r.total_no_fechamento ?? '0.00',
      meta_reserva: r.meta_reserva ?? '0.00',
      diferenca_reserva: r.diferenca_reserva ?? '0.00',
      status_conferencia: r.status_conferencia ?? null,
    };
  }, [dashboard]);

  const fatura = dashboard?.fatura ?? null;
  const porPortador = dashboard?.por_portador ?? [];
  const porCategoria = dashboard?.por_categoria ?? [];

  const cartaoSelecionado = useMemo(
    () => cartoes.find((c) => c.id === idCartao) ?? null,
    [cartoes, idCartao]
  );

  const podeFechar = fatura?.status === 'ABERTA';

  const fecharFaturaAtual = async () => {
    if (!idFatura || !podeFechar || fechandoFatura) return;

    const pendente = Number(resumo.total_pendente ?? 0);
    const avisoPendente =
      pendente > 0
        ? `\n\nAtenção: ainda há R$ ${pendente.toFixed(2).replace('.', ',')} em lançamentos pendentes. Você pode fechar mesmo assim.`
        : '';

    const ok = window.confirm(
      `Fechar a competência "${fatura?.nome_exibicao ?? ''}"? ` +
        'Depois de fechada, a fatura fica somente leitura (sem novas edições ou ' +
        'importações) e a próxima competência é aberta automaticamente.' +
        avisoPendente
    );
    if (!ok) return;

    setFechandoFatura(true);
    try {
      await toast.promise(fecharFatura(idFatura), {
        loading: 'Fechando a fatura...',
        success: 'Fatura fechada. Próxima competência disponível.',
        error: (erro) => erro?.response?.data?.message || 'Não foi possível fechar a fatura.',
      });
      await recarregarDashboard();
      if (idCartao) {
        try {
          const lista = await listarFaturas(idCartao);
          setFaturas(ordenarRecentePrimeiro(lista));
        } catch {
          toast.danger('Fatura fechada, mas não consegui atualizar a lista de competências.');
        }
      }
      setRecargaTransacoes((n) => n + 1);
    } catch (erro) {
      if (erro?.response?.status === 409) {
        toast.danger(erro.response?.data?.message || 'Esta fatura já está fechada.');
      }
    } finally {
      setFechandoFatura(false);
    }
  };

  const rotuloCartao = (c) => (c.final_cartao ? `${c.nome} ••${c.final_cartao}` : c.nome);

  const Cabecalho = (
    <div className="min-w-0">
      <h1 className="text-xl sm:text-2xl font-bold truncate">Faturas</h1>
      <p className="text-sm text-foreground-500">
        Controle de fatura do cartão e conferência da reserva
      </p>
    </div>
  );

  // Modal de nova competência (compartilhado entre os estados).
  const ModalNovaCompetencia = (
    <NovaCompetenciaModal
      aberto={novaCompetenciaAberta}
      aoFechar={() => setNovaCompetenciaAberta(false)}
      idCartao={idCartao}
      aoCriar={aoCriarCompetencia}
    />
  );

  // ── Estado: carregando os cartões ───────────────────────────
  if (carregandoCartoes) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 sm:space-y-6">
        {Cabecalho}
        <div className="flex items-center justify-center gap-2 py-16 text-foreground-500">
          <Spinner size="sm" />
          <span className="text-sm">Carregando seus cartões...</span>
        </div>
      </div>
    );
  }

  // ── Estado vazio: nenhum cartão de crédito ──────────────────
  if (cartoes.length === 0) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 sm:space-y-6">
        {Cabecalho}
        <Card>
          <Card.Content className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex items-center justify-center size-12 rounded-xl bg-primary/10 text-primary">
              <FiCreditCard size={24} />
            </div>
            <div>
              <p className="font-semibold">Nenhum cartão de crédito cadastrado</p>
              <p className="text-sm text-foreground-500">
                As faturas acompanham um cartão de crédito. Cadastre um cartão para começar.
              </p>
            </div>
            <Button color="primary" render={(props) => <Link to="/contas" {...props} />}>
              <FiPlus size={18} />
              Cadastrar cartão
            </Button>
          </Card.Content>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 sm:space-y-6">
      {Cabecalho}

      {/* ── Seletores de cartão e competência + Nova competência ─────────── */}
      <Card>
        <Card.Content className="flex flex-col gap-3 sm:gap-4 py-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {/* Cartão (contas CREDITO) */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-foreground-500">Cartão</span>
              <Select
                aria-label="Selecionar cartão"
                value={idCartao}
                onChange={(key) => setIdCartao(key ? String(key) : null)}
              >
                <Select.Trigger>
                  <Select.Value placeholder="Selecione o cartão" />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    {cartoes.map((c) => (
                      <ListBox.Item key={c.id} id={c.id}>
                        {rotuloCartao(c)}
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
            </div>

            {/* Competência (faturas do cartão) */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-foreground-500">Competência</span>
              <Select
                aria-label="Selecionar competência"
                value={idFatura}
                isDisabled={carregandoFaturas || faturas.length === 0}
                onChange={(key) => setIdFatura(key ? String(key) : null)}
              >
                <Select.Trigger>
                  <Select.Value
                    placeholder={
                      carregandoFaturas
                        ? 'Carregando...'
                        : faturas.length === 0
                          ? 'Sem competências'
                          : 'Selecione a competência'
                    }
                  />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    {faturas.length === 0 ? (
                      <ListBox.Item id="__vazio__" isDisabled>
                        Nenhuma competência
                      </ListBox.Item>
                    ) : (
                      faturas.map((f) => (
                        <ListBox.Item key={f.id} id={f.id}>
                          {f.nome_exibicao}
                        </ListBox.Item>
                      ))
                    )}
                  </ListBox>
                </Select.Popover>
              </Select>
            </div>
          </div>

          {/* Ação: nova competência (cria o mês de referência no cartão). */}
          <div className="flex justify-end">
            <Button
              color="primary"
              variant="flat"
              size="sm"
              onPress={() => setNovaCompetenciaAberta(true)}
              isDisabled={!idCartao}
            >
              <FiCalendar size={16} />
              Nova competência
            </Button>
          </div>
        </Card.Content>
      </Card>

      {/* ── Estado vazio: cartão sem nenhuma competência ──────── */}
      {!carregandoFaturas && faturas.length === 0 && (
        <Card>
          <Card.Content className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex items-center justify-center size-12 rounded-xl bg-default-100 text-foreground-500">
              <FiFileText size={24} />
            </div>
            <div>
              <p className="font-semibold">
                {cartaoSelecionado
                  ? `Nenhuma fatura para ${rotuloCartao(cartaoSelecionado)}`
                  : 'Nenhuma fatura'}
              </p>
              <p className="text-sm text-foreground-500">
                Crie a competência do mês para começar a importar a fatura deste cartão.
              </p>
            </div>
            <Button color="primary" onPress={() => setNovaCompetenciaAberta(true)}>
              <FiCalendar size={18} />
              Criar competência
            </Button>
          </Card.Content>
        </Card>
      )}

      {/* ── Estado: carregando o dashboard da competência ─────── */}
      {idFatura && carregandoDashboard && (
        <div className="flex items-center justify-center gap-2 py-12 text-foreground-500">
          <Spinner size="sm" />
          <span className="text-sm">Carregando dados da fatura...</span>
        </div>
      )}

      {/* ── Estado de erro ao carregar o dashboard ────────────── */}
      {idFatura && !carregandoDashboard && erroDashboard && (
        <Card>
          <Card.Content className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex items-center justify-center size-12 rounded-xl bg-danger/10 text-danger">
              <FiAlertCircle size={24} />
            </div>
            <div>
              <p className="font-semibold">Não foi possível carregar a fatura</p>
              <p className="text-sm text-foreground-500">
                Tente selecionar a competência novamente.
              </p>
            </div>
            <Button color="primary" variant="flat" onPress={() => setIdFatura((id) => id)}>
              Tentar de novo
            </Button>
          </Card.Content>
        </Card>
      )}

      {/* ── Conteúdo: competência selecionada e carregada ─────── */}
      {idFatura && !carregandoDashboard && !erroDashboard && (
        <div className="space-y-4 sm:space-y-6">
          {fatura?.status && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm text-foreground-500">Status da fatura:</span>
                <Chip
                  size="sm"
                  variant="flat"
                  color={
                    fatura.status === 'ABERTA'
                      ? 'primary'
                      : fatura.status === 'PAGA'
                        ? 'success'
                        : 'default'
                  }
                >
                  {fatura.status}
                </Chip>
              </div>

              {podeFechar ? (
                <Button
                  color="primary"
                  variant="flat"
                  size="sm"
                  onPress={fecharFaturaAtual}
                  isLoading={fechandoFatura}
                  isDisabled={fechandoFatura}
                >
                  <FiCheckSquare size={16} />
                  Fechar fatura
                </Button>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs text-foreground-500">
                  <FiLock size={14} />
                  Fatura {fatura.status.toLowerCase()} — somente leitura
                </span>
              )}
            </div>
          )}

          <FaturaResumo fatura={fatura} resumo={resumo} />

          <ReservaCard
            fatura={fatura}
            resumo={resumo}
            idFatura={idFatura}
            onReservaAtualizada={recarregarDashboard}
          />

          {/* Importar fatura (CSV). Bloqueado quando FECHADA/PAGA. */}
          {(() => {
            const bloqueadoImportar = fatura?.status === 'FECHADA' || fatura?.status === 'PAGA';
            return (
              <Card>
                <Card.Content className="flex flex-col gap-3 py-6 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">Importar fatura (CSV)</p>
                    <p className="text-xs text-foreground-500">
                      {bloqueadoImportar
                        ? `Fatura ${fatura?.status?.toLowerCase()}: a importação está bloqueada.`
                        : 'Envie o CSV do cartão para pré-visualizar e importar os lançamentos.'}
                    </p>
                  </div>
                  <Button
                    color="primary"
                    onPress={() => setImportarAberto(true)}
                    isDisabled={bloqueadoImportar}
                  >
                    {bloqueadoImportar ? <FiLock size={16} /> : <FiUploadCloud size={16} />}
                    Importar fatura (CSV)
                  </Button>
                </Card.Content>
              </Card>
            );
          })()}

          <ImportarFaturaModal
            aberto={importarAberto}
            aoFechar={() => setImportarAberto(false)}
            idFatura={idFatura}
            onImportado={() => {
              recarregarDashboard();
              setRecargaTransacoes((n) => n + 1);
            }}
          />

          <FaturaTransacoesTable
            key={`tx-${idFatura}-${recargaTransacoes}`}
            idFatura={idFatura}
            faturaStatus={fatura?.status}
            portadores={porPortador}
            categorias={porCategoria}
            onTransacaoAtualizada={recarregarDashboard}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <AnalisePortador portadores={porPortador} />
            <AnaliseCategoria categorias={porCategoria} />
          </div>
        </div>
      )}

      {/* Modal de nova competência (disponível em todos os estados com cartão). */}
      {ModalNovaCompetencia}
    </div>
  );
}

export default Faturas;



