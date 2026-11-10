// Relatórios: escolhe o cartão e a fatura e vê o relatório geral ou o gasto por semana.
// Compartilha o PDF (WhatsApp) ou baixa. Tudo sai do próprio aparelho.
import { useEffect, useState } from 'react';
import { Button, Card, Chip, Spinner, Tabs, toast } from '@heroui/react';
import { FiShare2, FiDownload, FiCopy, FiFileText } from 'react-icons/fi';
import Seletor from '../../components/Seletor';
import ResultadoSemanal from './componentes/ResultadoSemanal';
import { listarCartoes } from '../../services/cartaoService';
import { listarFaturasCartao } from '../../services/faturaService';
import { buscarRelatorioFatura, buscarRelatorioSemanal } from '../../services/relatorioService';
import {
  gerarPdfRelatorioFatura,
  montarTextoResumo,
  gerarPdfRelatorioSemanal,
  montarTextoSemanal,
  compartilharRelatorioPdf
} from '../../utils/relatorioFatura';
import { moeda } from '../../utils/formatar';

// Bloco de um número do resumo (totais e reserva)
function Indicador({ rotulo, valor, destaque = false }) {
  return (
    <Card>
      <Card.Content className="gap-0.5 p-4">
        <span className="text-xs text-muted">{rotulo}</span>
        <span className={`font-bold tabular-nums ${destaque ? 'text-xl text-accent' : 'text-lg'}`}>{valor}</span>
      </Card.Content>
    </Card>
  );
}

export default function Relatorios() {
  const [cartoes, setCartoes] = useState(null);
  const [cartaoId, setCartaoId] = useState('');
  const [faturas, setFaturas] = useState([]);
  const [faturaId, setFaturaId] = useState('');
  const [aba, setAba] = useState('geral');
  const [relatorio, setRelatorio] = useState(null);
  const [relatorioSemanal, setRelatorioSemanal] = useState(null);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState('');

  // Cartões: começa pelo principal
  useEffect(() => {
    listarCartoes()
      .then((resposta) => {
        setCartoes(resposta.cartoes);
        const cartaoInicial = resposta.cartoes.find((cartao) => cartao.principal) ?? resposta.cartoes[0];
        if (cartaoInicial) setCartaoId(cartaoInicial.id);
      })
      .catch((e) => setErro(e.message));
  }, []);

  // Faturas do cartão escolhido: começa pela mais recente
  useEffect(() => {
    if (!cartaoId) return;
    listarFaturasCartao(cartaoId)
      .then((resposta) => {
        setFaturas(resposta.faturas);
        setFaturaId(resposta.faturas[0]?.id ?? '');
      })
      .catch((e) => toast.danger(e.message));
  }, [cartaoId]);

  // Trocar de fatura apaga os relatórios anteriores
  useEffect(() => {
    setRelatorio(null);
    setRelatorioSemanal(null);
  }, [faturaId]);

  if (erro) {
    return <p className="rounded-xl border border-dashed border-separator p-10 text-center text-danger">{erro}</p>;
  }
  if (!cartoes) {
    return <div className="flex justify-center p-16"><Spinner /></div>;
  }

  // Gera o relatório da aba escolhida
  const gerar = () => {
    setGerando(true);
    const buscar = aba === 'geral' ? buscarRelatorioFatura : buscarRelatorioSemanal;
    const aplicar = aba === 'geral' ? setRelatorio : setRelatorioSemanal;
    buscar(faturaId)
      .then(aplicar)
      .catch((e) => toast.danger(e.message))
      .finally(() => setGerando(false));
  };

  // Abre a folha de compartilhar (WhatsApp) com o PDF; sem suporte, baixa o arquivo.
  const compartilhar = async () => {
    const { doc, nomeArquivo } = aba === 'geral'
      ? gerarPdfRelatorioFatura(relatorio)
      : gerarPdfRelatorioSemanal(relatorioSemanal);
    const texto = aba === 'geral' ? montarTextoResumo(relatorio) : montarTextoSemanal(relatorioSemanal);
    try {
      const resultado = await compartilharRelatorioPdf(doc, nomeArquivo, texto);
      if (resultado === 'baixado') toast.success('PDF baixado. Envie pelo WhatsApp.');
    } catch {
      toast.danger('Não foi possível compartilhar o relatório.');
    }
  };

  const baixar = () => {
    const { doc, nomeArquivo } = aba === 'geral'
      ? gerarPdfRelatorioFatura(relatorio)
      : gerarPdfRelatorioSemanal(relatorioSemanal);
    doc.save(nomeArquivo);
  };

  const copiarResumo = () => {
    const texto = aba === 'geral' ? montarTextoResumo(relatorio) : montarTextoSemanal(relatorioSemanal);
    navigator.clipboard.writeText(texto)
      .then(() => toast.success('Resumo copiado.'))
      .catch(() => toast.danger('Não foi possível copiar o resumo.'));
  };

  const cartaoEscolhido = cartoes.find((cartao) => cartao.id === cartaoId);
  const opcoesFatura = faturas.map((fatura) => ({
    id: fatura.id,
    nome: fatura.fechada ? `${fatura.titulo} · fechada` : fatura.titulo,
  }));
  const temRelatorio = aba === 'geral' ? relatorio : relatorioSemanal;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Relatórios</h1>
        <p className="text-sm text-muted">Resumo da fatura para mandar no grupo da família</p>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
        {cartoes.length > 0 && (
          <Seletor
            rotulo="Cartão"
            itens={cartoes.map((cartao) => ({ id: cartao.id, nome: `${cartao.nome} ••${cartao.final}` }))}
            valor={cartaoId}
            onChange={setCartaoId}
          />
        )}
        {opcoesFatura.length > 0 && (
          <Seletor rotulo="Fatura" itens={opcoesFatura} valor={faturaId} onChange={setFaturaId} />
        )}
      </div>

      <Tabs selectedKey={aba} onSelectionChange={(chave) => { setAba(chave); }}>
        <Tabs.ListContainer>
          <Tabs.List aria-label="Tipo de relatório">
            <Tabs.Tab id="geral">Geral<Tabs.Indicator /></Tabs.Tab>
            <Tabs.Tab id="semanal">Por semana<Tabs.Indicator /></Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>
      </Tabs>

      {opcoesFatura.length === 0 && cartaoEscolhido && (
        <p className="rounded-xl border border-dashed border-separator p-10 text-center text-muted">
          O cartão {cartaoEscolhido.nome} ainda não tem faturas. Crie uma na aba Faturas.
        </p>
      )}

      {opcoesFatura.length > 0 && (
        <Button onPress={gerar} isDisabled={!faturaId || gerando} variant={temRelatorio ? 'secondary' : 'primary'} className="w-full sm:w-auto">
          <FiFileText size={16} />
          {gerando ? 'Gerando...' : temRelatorio ? 'Atualizar' : aba === 'geral' ? 'Gerar relatório geral' : 'Gerar gasto por semana'}
        </Button>
      )}

      {aba === 'geral' && relatorio && (
        <>
          <Card>
            <Card.Content className="gap-2 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">{relatorio.cabecalho.titulo}</p>
                  <p className="text-sm text-muted">
                    {relatorio.cabecalho.nomeCartao} ••{relatorio.cabecalho.finalCartao} · fecha {relatorio.cabecalho.dataFechamento} · vence {relatorio.cabecalho.dataVencimento}
                  </p>
                </div>
                <Chip size="sm" variant="soft" color={relatorio.cabecalho.fechada ? 'default' : 'success'}>
                  {relatorio.cabecalho.fechada ? 'Fechada' : 'Aberta'}
                </Chip>
              </div>
            </Card.Content>
          </Card>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <Indicador rotulo="Total da fatura" valor={moeda(relatorio.resumo.totalGeral)} destaque />
            <Indicador rotulo="Na hora (pago)" valor={moeda(relatorio.resumo.totalNaHora)} />
            <Indicador rotulo="Pendente" valor={moeda(relatorio.resumo.totalPendente)} />
            <Indicador rotulo="No fechamento" valor={moeda(relatorio.resumo.totalNoFechamento)} />
            <Indicador rotulo="Saldo da reserva" valor={moeda(relatorio.resumo.saldoReserva)} />
            <Indicador
              rotulo={relatorio.resumo.sobraOuFalta >= 0 ? 'Sobra na reserva' : 'Falta na reserva'}
              valor={moeda(Math.abs(relatorio.resumo.sobraOuFalta))}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <Card.Header><Card.Title>Quem gastou</Card.Title></Card.Header>
              <Card.Content className="gap-2">
                {relatorio.porPortador.map((p) => (
                  <div key={p.nome} className="flex justify-between gap-2 text-sm">
                    <span>{p.nome} <span className="text-muted">({p.quantidade})</span></span>
                    <span className="font-semibold tabular-nums">{moeda(p.total)}</span>
                  </div>
                ))}
              </Card.Content>
            </Card>

            <Card>
              <Card.Header><Card.Title>Por categoria</Card.Title></Card.Header>
              <Card.Content className="gap-2">
                {relatorio.porCategoria.map((c) => (
                  <div key={c.nome} className="flex justify-between gap-2 text-sm">
                    <span>{c.nome} <span className="text-muted">({c.quantidade})</span></span>
                    <span className="font-semibold tabular-nums">{moeda(c.total)}</span>
                  </div>
                ))}
              </Card.Content>
            </Card>
          </div>

          <p className="text-sm text-muted">
            O PDF traz os {relatorio.resumo.quantidadeLancamentos} lançamentos completos.
          </p>

          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
            <Button onPress={compartilhar} className="sm:flex-1">
              <FiShare2 size={16} /> Compartilhar (WhatsApp)
            </Button>
            <Button variant="secondary" onPress={baixar}>
              <FiDownload size={16} /> Baixar PDF
            </Button>
            <Button variant="ghost" onPress={copiarResumo}>
              <FiCopy size={16} /> Copiar resumo
            </Button>
          </div>
        </>
      )}

      {aba === 'semanal' && relatorioSemanal && (
        <ResultadoSemanal
          relatorio={relatorioSemanal}
          onCompartilhar={compartilhar}
          onBaixar={baixar}
          onCopiar={copiarResumo}
        />
      )}
    </div>
  );
}
