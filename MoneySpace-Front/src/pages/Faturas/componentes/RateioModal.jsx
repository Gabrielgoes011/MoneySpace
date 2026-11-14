// Tela de administração do rateio de um lançamento: quem divide a compra, quanto cada um deve,
// os pagamentos recebidos e o que quem adiantou a compra absorve.
// No PC abre como janela; no celular ocupa a tela toda. Funciona também com a fatura fechada.
import { useCallback, useEffect, useState } from 'react';
import { Modal, Button, Card, Chip, Input, Label, Spinner, TextField, toast } from '@heroui/react';
import { FiPlus, FiTrash2, FiDollarSign, FiEdit2, FiUserX, FiRotateCcw } from 'react-icons/fi';
import useIsMobile from '../../../hooks/useIsMobile';
import { moeda, dataCurta } from '../../../utils/formatar';
import {
  buscarRateio,
  cadastrarParte,
  editarParte,
  excluirParte,
  registrarPagamento,
  excluirPagamento,
  definirAbsorcao
} from '../../../services/rateioService';

// Como cada situação da parte aparece (a situação vem pronta do back)
const SITUACAO = {
  pendente: { rotulo: 'Pendente', cor: 'warning' },
  parcial: { rotulo: 'Pagou parte', cor: 'accent' },
  pago: { rotulo: 'Pago', cor: 'success' },
  'pagou a mais': { rotulo: 'Pagou a mais', cor: 'success' },
  absorvido: { rotulo: 'Absorvido', cor: 'default' },
};

// Hoje no fuso do aparelho (AAAA-MM-DD), para o campo de data do pagamento
const hoje = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

// Texto do saldo da parte: o que falta, o que passou ou o que quem adiantou assume
function textoSaldo(parte) {
  if (parte.absorvido) return `quem adiantou assume ${moeda(Math.max(parte.saldo, 0))}`;
  if (parte.saldo > 0) return `falta ${moeda(parte.saldo)}`;
  if (parte.saldo < 0) return `a mais ${moeda(-parte.saldo)}`;
  return 'quitado';
}

// Bloco de um número do resumo
function Indicador({ rotulo, valor, destaque = false }) {
  return (
    <Card>
      <Card.Content className="gap-0.5 p-3">
        <span className="text-xs text-muted">{rotulo}</span>
        <span className={`font-bold tabular-nums ${destaque ? 'text-lg text-accent' : 'text-base'}`}>{valor}</span>
      </Card.Content>
    </Card>
  );
}

// Uma parte: situação, pagamentos e as ações (pagar, absorver, mudar o valor, remover)
function ParteRateio({ parte, portador, onExecutar }) {
  const [acao, setAcao] = useState(null); // 'pagar' | 'valor' | 'absorver' | null
  const [valor, setValor] = useState('');
  const [data, setData] = useState(hoje());
  const situacao = SITUACAO[parte.situacao] ?? SITUACAO.pendente;

  const abrir = (nomeAcao, valorInicial = '') => {
    setValor(valorInicial);
    setData(hoje());
    setAcao(nomeAcao);
  };

  // Cada ação só fecha o formulário se deu certo (se falhar, o usuário corrige e tenta de novo)
  const rodar = async (promessa, mensagem) => {
    if (await onExecutar(promessa, mensagem)) setAcao(null);
  };

  const pagar = (e) => {
    e.preventDefault();
    rodar(registrarPagamento(parte.id, { valor, dataPagamento: data }), 'Pagamento registrado.');
  };

  const mudarValor = (e) => {
    e.preventDefault();
    rodar(editarParte(parte.id, valor), 'Valor da parte atualizado.');
  };

  return (
    <Card>
      <Card.Content className="gap-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold">{parte.nome}</p>
            <p className="text-xs text-muted">
              previsto {moeda(parte.valorPrevisto)} · pago {moeda(parte.valorPago)} · {textoSaldo(parte)}
            </p>
          </div>
          <Chip size="sm" variant="soft" color={situacao.cor}>{situacao.rotulo}</Chip>
        </div>

        {parte.pagamentos.length > 0 && (
          <div className="divide-y divide-separator rounded-lg border border-separator text-sm">
            {parte.pagamentos.map((pagamento) => (
              <div key={pagamento.id} className="flex items-center justify-between gap-2 px-3 py-1.5">
                <span className="text-muted">{dataCurta(pagamento.data)}</span>
                <span className="ml-auto font-medium tabular-nums">{moeda(pagamento.valor)}</span>
                <Button isIconOnly size="sm" variant="ghost" aria-label="Apagar este pagamento"
                  onPress={() => onExecutar(excluirPagamento(pagamento.id), 'Pagamento removido.')}>
                  <FiTrash2 size={14} />
                </Button>
              </div>
            ))}
          </div>
        )}

        {acao === null && (
          <div className="flex flex-wrap gap-2">
            {!parte.absorvido && (
              <Button size="sm" onPress={() => abrir('pagar', parte.saldo > 0 ? String(parte.saldo).replace('.', ',') : '')}>
                <FiDollarSign size={14} /> Registrar pagamento
              </Button>
            )}
            {parte.absorvido ? (
              <Button size="sm" variant="secondary"
                onPress={() => rodar(definirAbsorcao(parte.id, false), 'Absorção desfeita.')}>
                <FiRotateCcw size={14} /> Desfazer absorção
              </Button>
            ) : (
              <Button size="sm" variant="secondary" onPress={() => setAcao('absorver')}>
                <FiUserX size={14} /> Absorver
              </Button>
            )}
            <Button size="sm" variant="ghost" onPress={() => abrir('valor', String(parte.valorPrevisto).replace('.', ','))}>
              <FiEdit2 size={14} /> Valor previsto
            </Button>
            <Button isIconOnly size="sm" variant="ghost" aria-label={`Remover ${parte.nome}`}
              isDisabled={parte.valorPago > 0}
              onPress={() => rodar(excluirParte(parte.id), 'Pessoa removida do rateio.')}>
              <FiTrash2 size={14} />
            </Button>
          </div>
        )}

        {acao === 'pagar' && (
          <form onSubmit={pagar} className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <TextField fullWidth>
                <Label>Valor recebido (R$)</Label>
                <Input inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" autoFocus required />
              </TextField>
              <TextField fullWidth>
                <Label>Data</Label>
                <Input type="date" value={data} onChange={(e) => setData(e.target.value)} required />
              </TextField>
            </div>
            <p className="text-xs text-muted">Pode pagar em várias vezes e pode passar do previsto.</p>
            <div className="flex gap-2">
              <Button size="sm" type="submit">Registrar</Button>
              <Button size="sm" variant="secondary" type="button" onPress={() => setAcao(null)}>Cancelar</Button>
            </div>
          </form>
        )}

        {acao === 'valor' && (
          <form onSubmit={mudarValor} className="space-y-2">
            <TextField fullWidth>
              <Label>Valor previsto de {parte.nome} (R$)</Label>
              <Input inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} autoFocus required />
            </TextField>
            <div className="flex gap-2">
              <Button size="sm" type="submit">Salvar valor</Button>
              <Button size="sm" variant="secondary" type="button" onPress={() => setAcao(null)}>Cancelar</Button>
            </div>
          </form>
        )}

        {acao === 'absorver' && (
          <div className="space-y-2 rounded-lg border border-warning/40 bg-warning/5 p-3 text-sm">
            <p>
              {portador ?? 'Quem adiantou a compra'} vai assumir {moeda(Math.max(parte.saldo, 0))} que falta de {parte.nome}.
              Essa parte sai do que ainda precisa ser cobrado. Dá para desfazer depois.
            </p>
            <div className="flex gap-2">
              <Button size="sm" onPress={() => rodar(definirAbsorcao(parte.id, true), 'Parte absorvida.')}>Sim, absorver</Button>
              <Button size="sm" variant="secondary" onPress={() => setAcao(null)}>Cancelar</Button>
            </div>
          </div>
        )}
      </Card.Content>
    </Card>
  );
}

// Conteúdo da janela: só existe com o modal aberto (a `key` do pai reinicia tudo a cada abertura)
function Conteudo({ state, lancamento, onMudou }) {
  const [rateio, setRateio] = useState(null);
  const [erro, setErro] = useState('');
  const [nome, setNome] = useState('');
  const [valor, setValor] = useState('');

  const carregar = useCallback(
    () => buscarRateio(lancamento.id).then(setRateio).catch((e) => setErro(e.message)),
    [lancamento.id]
  );

  useEffect(() => { carregar(); }, [carregar]);

  // Roda uma escrita com aviso na tela e busca o rateio de novo. Devolve true se deu certo.
  const executar = (promessa, mensagem) => {
    const concluida = promessa.then(async (resposta) => {
      await carregar();
      onMudou();
      return resposta;
    });
    toast.promise(concluida, { loading: 'Salvando...', success: () => mensagem, error: (e) => e.message });
    return concluida.then(() => true).catch(() => false);
  };

  const incluirPessoa = async (e) => {
    e.preventDefault();
    const deuCerto = await executar(cadastrarParte({ idLancamento: lancamento.id, nome, valor }), 'Pessoa incluída no rateio.');
    if (deuCerto) { setNome(''); setValor(''); }
  };

  if (erro) {
    return (
      <>
        <Modal.Header><Modal.Heading>Rateio</Modal.Heading></Modal.Header>
        <Modal.Body><p className="text-danger">{erro}</p></Modal.Body>
        <Modal.Footer><Button variant="secondary" onPress={state.close}>Fechar</Button></Modal.Footer>
      </>
    );
  }
  if (!rateio) {
    return <div className="flex justify-center p-16"><Spinner /></div>;
  }

  const { resumo, partes, pessoas } = rateio;
  const portador = rateio.lancamento.portador;

  return (
    <>
      <Modal.Header>
        <div className="min-w-0">
          <Modal.Heading className="truncate">Rateio · {rateio.lancamento.estabelecimento}</Modal.Heading>
          <p className="text-sm text-muted">
            {dataCurta(rateio.lancamento.dataCompra)} · {moeda(rateio.lancamento.valor)} · adiantou: {portador ?? 'sem portador'}
          </p>
        </div>
      </Modal.Header>

      <Modal.Body className="space-y-4 p-1">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
          <Indicador rotulo="Total da compra" valor={moeda(resumo.valorLancamento)} />
          <Indicador rotulo="Previsto" valor={moeda(resumo.totalPrevisto)} />
          <Indicador rotulo="Já recebido" valor={moeda(resumo.totalPago)} />
          <Indicador rotulo="A cobrar" valor={moeda(resumo.totalACobrar)} destaque />
          <Indicador rotulo="Absorvido" valor={moeda(resumo.totalAbsorvido)} />
        </div>

        {partes.length > 0 && resumo.naoRateado > 0 && (
          <p className="rounded-lg border border-dashed border-separator p-3 text-sm text-muted">
            Parte de {portador ?? 'quem adiantou a compra'}: {moeda(resumo.naoRateado)} (o que não foi dividido com ninguém).
          </p>
        )}
        {resumo.naoRateado < 0 && (
          <p className="rounded-lg border border-warning/40 bg-warning/5 p-3 text-sm">
            As partes passam {moeda(-resumo.naoRateado)} do valor da compra. Confira os valores previstos.
          </p>
        )}

        {partes.length === 0 && (
          <p className="rounded-xl border border-dashed border-separator p-6 text-center text-sm text-muted">
            Ninguém no rateio ainda. Inclua as pessoas abaixo, cada uma com a sua parte.
          </p>
        )}

        <div className="space-y-3">
          {partes.map((parte) => (
            <ParteRateio key={parte.id} parte={parte} portador={portador} onExecutar={executar} />
          ))}
        </div>

        <form onSubmit={incluirPessoa} className="space-y-2 rounded-xl border border-separator p-3">
          <p className="text-sm font-semibold">Incluir pessoa</p>
          <div className="grid grid-cols-2 gap-2">
            <TextField fullWidth>
              <Label>Nome</Label>
              <Input list="pessoas-rateio" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Marcos" required />
            </TextField>
            <TextField fullWidth>
              <Label>Parte (R$)</Label>
              <Input
                inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} required
                placeholder={resumo.naoRateado > 0 ? String(resumo.naoRateado).replace('.', ',') : '0,00'}
              />
            </TextField>
          </div>
          <datalist id="pessoas-rateio">
            {pessoas.map((pessoa) => <option key={pessoa} value={pessoa} />)}
          </datalist>
          <Button size="sm" type="submit"><FiPlus size={14} /> Incluir</Button>
        </form>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onPress={state.close}>Fechar</Button>
      </Modal.Footer>
    </>
  );
}

export default function RateioModal({ state, lancamento, onMudou }) {
  const isMobile = useIsMobile();

  return (
    <Modal state={state}>
      <Modal.Backdrop>
        <Modal.Container size={isMobile ? 'full' : 'lg'}>
          <Modal.Dialog className={isMobile ? undefined : 'sm:max-w-2xl'}>
            <Modal.CloseTrigger />
            {lancamento && (
              <Conteudo
                key={`${lancamento.id}-${state.isOpen ? 'aberto' : 'fechado'}`}
                state={state}
                lancamento={lancamento}
                onMudou={onMudou}
              />
            )}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
