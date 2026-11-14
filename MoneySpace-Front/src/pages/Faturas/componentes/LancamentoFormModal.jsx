// Lançamento manual de gasto na fatura aberta. Com `lancamento`, o mesmo formulário edita.
import { useState } from 'react';
import { Modal, Button, Input, Label, Switch, TextField, toast } from '@heroui/react';
import Seletor from '../../../components/Seletor';
import { cadastrarLancamento, editarLancamento } from '../../../services/faturaService';
import { STATUS } from '../../../utils/statusFatura';
import { properCase } from '../../../utils/formatar';

const SEM_VALOR = 'nenhum';

// Campo de texto padrão do formulário
function Campo({ rotulo, ...props }) {
  return (
    <TextField fullWidth>
      <Label>{rotulo}</Label>
      <Input {...props} />
    </TextField>
  );
}

// Valores iniciais: lançamento para editar (preenche com o atual) ou novo (padrões).
function valoresIniciais(lancamento, usuarios, categorias) {
  if (!lancamento) {
    return {
      dataCompra: new Date().toISOString().slice(0, 10),
      estabelecimento: '',
      valor: '',
      idUsuario: SEM_VALOR,
      categoria: SEM_VALOR,
      parcela: '-',
      statusTransacao: 'pendente',
      rateado: false,
    };
  }

  // o lançamento guarda o NOME do portador: acha o usuário com esse nome
  const usuario = usuarios.find((u) => u.nome.toUpperCase() === String(lancamento.portador ?? '').toUpperCase());
  const categoriaCadastrada = categorias.find((c) => c.valor === lancamento.categoria);

  return {
    dataCompra: lancamento.data,
    estabelecimento: lancamento.estabelecimento,
    valor: String(lancamento.valor).replace('.', ','),
    idUsuario: usuario?.id ?? SEM_VALOR,
    categoria: categoriaCadastrada?.valor ?? SEM_VALOR,
    parcela: lancamento.parcela ?? '-',
    statusTransacao: lancamento.status,
    rateado: !!lancamento.rateado,
  };
}

// O formulário só existe com o modal aberto; `key` no pai reinicia o estado a cada abertura.
function Formulario({ state, idFatura, lancamento, usuarios, categorias, onSalvo }) {
  const editando = !!lancamento;
  const [salvando, setSalvando] = useState(false);
  const [f, setF] = useState(() => valoresIniciais(lancamento, usuarios, categorias));
  const set = (campo) => (e) => setF((x) => ({ ...x, [campo]: e.target.value }));

  // Ao criar, "Nenhum" não é enviado. Ao editar, "Nenhum" manda vazio para tirar o portador/categoria.
  const salvar = (e) => {
    e.preventDefault();
    const statusBanco = STATUS[f.statusTransacao].valorBanco;

    const promessa = editando
      ? editarLancamento(lancamento.id, {
          dataCompra: f.dataCompra,
          estabelecimento: f.estabelecimento,
          valor: f.valor,
          idUsuario: f.idUsuario === SEM_VALOR ? '' : f.idUsuario,
          categoria: f.categoria === SEM_VALOR ? '' : f.categoria,
          parcela: f.parcela,
          statusTransacao: statusBanco,
          rateado: f.rateado,
        })
      : cadastrarLancamento({
          idFatura,
          dataCompra: f.dataCompra,
          estabelecimento: f.estabelecimento,
          valor: f.valor,
          idUsuario: f.idUsuario === SEM_VALOR ? undefined : f.idUsuario,
          categoria: f.categoria === SEM_VALOR ? undefined : f.categoria,
          parcela: f.parcela,
          statusTransacao: statusBanco,
          rateado: f.rateado,
        });

    setSalvando(true);
    const promessaFinal = promessa
      .then((resposta) => { onSalvo(resposta); state.close(); return resposta; })
      .finally(() => setSalvando(false));

    toast.promise(promessaFinal, {
      loading: 'Salvando...',
      success: () => (editando ? 'Lançamento atualizado.' : 'Gasto lançado.'),
      error: (erro) => erro.message,
    });
  };

  const opcoesUsuario = [{ id: SEM_VALOR, nome: 'Sem portador' }, ...usuarios.map((u) => ({ id: u.id, nome: u.nome }))];
  const opcoesCategoria = [
    { id: SEM_VALOR, nome: 'Sem categoria' },
    ...categorias.map((c) => ({ id: c.valor, nome: properCase(c.valor) })),
  ];
  const opcoesStatus = Object.keys(STATUS).map((chave) => ({ id: chave, nome: STATUS[chave].label }));

  return (
    <form onSubmit={salvar}>
      <Modal.Header>
        <Modal.Heading>{editando ? 'Editar lançamento' : 'Lançar gasto'}</Modal.Heading>
      </Modal.Header>
      <Modal.Body className="space-y-3 p-1">
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Data da compra" type="date" value={f.dataCompra} onChange={set('dataCompra')} required />
          <Campo rotulo="Valor (R$)" inputMode="decimal" value={f.valor} onChange={set('valor')} placeholder="0,00" required />
        </div>
        <Campo rotulo="Estabelecimento" value={f.estabelecimento} onChange={set('estabelecimento')} placeholder="Ex.: Mercado X" required />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Portador</Label>
            <Seletor rotulo="Portador" itens={opcoesUsuario} valor={f.idUsuario}
              onChange={(k) => setF((x) => ({ ...x, idUsuario: k }))} className="w-full" />
          </div>
          <div>
            <Label>Categoria</Label>
            <Seletor rotulo="Categoria" itens={opcoesCategoria} valor={f.categoria}
              onChange={(k) => setF((x) => ({ ...x, categoria: k }))} className="w-full" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Parcela" value={f.parcela} onChange={set('parcela')} placeholder="- ou 2 de 3" />
          <div>
            <Label>Status</Label>
            <Seletor rotulo="Status" itens={opcoesStatus} valor={f.statusTransacao}
              onChange={(k) => setF((x) => ({ ...x, statusTransacao: k }))} className="w-full" />
          </div>
        </div>

        <Switch isSelected={f.rateado} onChange={(marcado) => setF((x) => ({ ...x, rateado: marcado }))}>
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
          <Switch.Content>
            <Label>Racha esta compra entre pessoas</Label>
            <span className="text-xs text-muted">
              A linha fica destacada. Depois de salvar, use o botão Rateio da linha para dividir e acompanhar os pagamentos.
            </span>
          </Switch.Content>
        </Switch>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onPress={state.close} type="button">Cancelar</Button>
        <Button type="submit" isDisabled={salvando}>{editando ? 'Salvar' : 'Lançar'}</Button>
      </Modal.Footer>
    </form>
  );
}

export default function LancamentoFormModal({ state, idFatura, lancamento = null, usuarios, categorias, onSalvo }) {
  return (
    <Modal state={state}>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-lg">
            <Modal.CloseTrigger />
            <Formulario
              key={`${lancamento?.id ?? 'novo'}-${state.isOpen ? 'aberto' : 'fechado'}`}
              state={state}
              idFatura={idFatura}
              lancamento={lancamento}
              usuarios={usuarios}
              categorias={categorias}
              onSalvo={onSalvo}
            />
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
