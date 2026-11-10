// Modal de cadastro de cartão. Só aparece para quem pode cadastrar (o pai decide).
import { useState } from 'react';
import { Modal, Button, Input, Label, TextField, Switch, toast } from '@heroui/react';
import Seletor from '../../../components/Seletor';
import { criarCartao } from '../../../services/cartaoService';

// Campo de texto padrão do formulário (mesmo estilo do cadastro de usuários)
function Campo({ rotulo, ...props }) {
  return (
    <TextField fullWidth>
      <Label>{rotulo}</Label>
      <Input {...props} />
    </TextField>
  );
}

// O formulário só existe com o modal aberto; `key` no pai reinicia o estado a cada abertura.
function Formulario({ state, usuarios, onSalvo }) {
  const [salvando, setSalvando] = useState(false);
  const [f, setF] = useState({
    nome: '',
    final: '',
    idUsuario: usuarios[0]?.id ?? '',
    limite: '',
    diaFechamento: '',
    diaVencimento: '',
    fechamentoManual: false, // quando o usuário mexe no fechamento, para de calcular sozinho
    principal: false,
  });
  const set = (campo) => (e) => setF((x) => ({ ...x, [campo]: e.target.value }));

  // Vencimento -> fechamento automático (7 dias antes; se cair no mês anterior, soma 30).
  // Só calcula enquanto o usuário não tiver digitado o fechamento à mão.
  const DIAS_ANTES_DO_VENCIMENTO = 7;
  const alterarVencimento = (e) => {
    const diaVencimentoDigitado = e.target.value;
    const diaVencimento = Number(diaVencimentoDigitado);

    setF((x) => {
      const diaValido = Number.isInteger(diaVencimento) && diaVencimento >= 1 && diaVencimento <= 31;
      if (x.fechamentoManual || !diaValido) return { ...x, diaVencimento: diaVencimentoDigitado };

      const diaFechamentoBruto = diaVencimento - DIAS_ANTES_DO_VENCIMENTO;
      const diaFechamento = diaFechamentoBruto >= 1 ? diaFechamentoBruto : diaFechamentoBruto + 30;
      return { ...x, diaVencimento: diaVencimentoDigitado, diaFechamento: String(diaFechamento) };
    });
  };

  // Digitar o fechamento à mão desliga o cálculo automático.
  const alterarFechamento = (e) => {
    const diaFechamentoDigitado = e.target.value;
    setF((x) => ({ ...x, diaFechamento: diaFechamentoDigitado, fechamentoManual: true }));
  };

  // Campos vazios viram undefined: o back trata como "não informado".
  const salvar = (e) => {
    e.preventDefault();
    const dados = {
      nome: f.nome.trim(),
      final: f.final.trim(),
      idUsuario: f.idUsuario,
      limite: f.limite === '' ? undefined : Number(f.limite.replace(',', '.')),
      diaFechamento: f.diaFechamento === '' ? undefined : Number(f.diaFechamento),
      diaVencimento: f.diaVencimento === '' ? undefined : Number(f.diaVencimento),
      principal: f.principal,
    };

    setSalvando(true);
    const promessa = criarCartao(dados)
      .then((cartao) => { onSalvo(cartao); state.close(); return cartao; })
      .finally(() => setSalvando(false));

    toast.promise(promessa, {
      loading: 'Salvando...',
      success: (cartao) => `Cartão ${cartao.nome} cadastrado.`,
      error: (erro) => erro.message,
    });
  };

  return (
    <form onSubmit={salvar}>
      <Modal.Header>
        <Modal.Heading>Novo cartão</Modal.Heading>
      </Modal.Header>
      <Modal.Body className="space-y-3 p-1">
        <Campo rotulo="Apelido do cartão" value={f.nome} onChange={set('nome')} placeholder="Ex.: Rico Mastercard" required />
        <Campo rotulo="Últimos 4 dígitos" inputMode="numeric" maxLength={4} value={f.final} onChange={set('final')} placeholder="0000" required />

        <div>
          <Label>Dono do cartão</Label>
          <Seletor
            rotulo="Dono do cartão"
            itens={usuarios.map((u) => ({ id: u.id, nome: u.nome }))}
            valor={f.idUsuario}
            onChange={(k) => setF((x) => ({ ...x, idUsuario: k }))}
            className="w-full"
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Campo rotulo="Limite (R$)" inputMode="decimal" value={f.limite} onChange={set('limite')} />
          <Campo rotulo="Fecha dia" inputMode="numeric" value={f.diaFechamento} onChange={alterarFechamento} />
          <Campo rotulo="Vence dia" inputMode="numeric" value={f.diaVencimento} onChange={alterarVencimento} />
        </div>

        <Switch isSelected={f.principal} onChange={(marcado) => setF((x) => ({ ...x, principal: marcado }))}>
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
          <Switch.Content>
            <Label>Cartão principal</Label>
            <span className="text-xs text-muted">Aparece no dashboard. Só pode existir um; o atual deixa de ser o principal.</span>
          </Switch.Content>
        </Switch>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onPress={state.close} type="button">Cancelar</Button>
        <Button type="submit" isDisabled={salvando || usuarios.length === 0}>Cadastrar</Button>
      </Modal.Footer>
    </form>
  );
}

export default function CartaoFormModal({ state, usuarios, onSalvo }) {
  return (
    <Modal state={state}>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-md">
            <Modal.CloseTrigger />
            <Formulario key={state.isOpen ? 'aberto' : 'fechado'} state={state} usuarios={usuarios} onSalvo={onSalvo} />
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
