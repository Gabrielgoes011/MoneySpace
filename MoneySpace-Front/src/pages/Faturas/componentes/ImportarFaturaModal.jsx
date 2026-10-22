// ========================================
// ImportarFaturaModal — importação de CSV (Task 16)
// ========================================
// Fluxo em 3 passos dentro de um Modal do HeroUI:
//   1) Selecionar o arquivo CSV (campo de arquivo; mantém o File em estado).
//   2) Gerar a PRÉVIA: chama faturaService.previewImportacao(idFatura, file)
//      (sem persistir). Mostra as linhas válidas + os erros por linha (Req 3.4),
//      sempre exibindo as válidas mesmo havendo erros (Req 3.1).
//   3) Confirmar: faturaService.confirmarImportacao(idFatura, file) persiste de
//      forma atômica/idempotente. Só habilita após prévia com >= 1 linha válida.
//
// Feedback sempre via toast.promise (Req 11.4).
//
// 409 de duplicidade (Req 3.8): se o confirmar rejeitar com status 409, NÃO é
// erro genérico — mostra a mensagem do servidor ("Este arquivo já foi
// importado." ou fatura FECHADA/PAGA) via toast.danger e mantém o modal aberto.
//
// Valores monetários chegam como string (pg). Para exibição formatamos com
// formatarDinheiro; o valor cru da string também é aceitável na prévia.
//
// Props:
//   - aberto        (bool)   controla a visibilidade do modal
//   - aoFechar()             fecha o modal (o pai zera o `aberto`)
//   - idFatura      (uuid)   fatura destino da importação
//   - onImportado()          callback após importar com sucesso (pai recarrega)

import { useEffect, useRef, useState } from 'react';
import { Modal, Button, Chip, toast } from '@heroui/react';
import {
  FiUploadCloud,
  FiPaperclip,
  FiCheckCircle,
  FiAlertTriangle,
  FiFileText,
  FiX,
} from 'react-icons/fi';
import { formatarDinheiro, formatarData } from '../../../utils/format';
import {
  previewImportacao,
  confirmarImportacao,
} from '../../../services/faturaService';

// Aceita apenas arquivos .csv / texto. O backend revalida tipo e tamanho.
const ACCEPT = '.csv,text/csv,text/plain';

// Estado inicial limpo; usado ao abrir/fechar o modal.
function estadoInicial() {
  return {
    file: null,
    previa: null, // { hash, linhas_validas, erros, ja_importado? }
    gerandoPrevia: false,
    confirmando: false,
  };
}

// Rótulo legível do status de liquidação (vem em texto simples do backend).
function rotuloStatus(status) {
  switch (status) {
    case 'pendente':
      return { texto: 'Pendente', cor: 'warning' };
    case 'na hora':
      return { texto: 'Na hora', cor: 'primary' };
    case 'no fechamento':
      return { texto: 'No fechamento', cor: 'secondary' };
    case 'nao aplicavel':
      return { texto: 'N/A', cor: 'default' };
    default:
      return { texto: status || '-', cor: 'default' };
  }
}

function ImportarFaturaModal({ aberto, aoFechar, idFatura, onImportado }) {
  const [estado, setEstado] = useState(estadoInicial);
  const inputRef = useRef(null);

  const { file, previa, gerandoPrevia, confirmando } = estado;

  // Reinicia tudo ao abrir/fechar (Req: resetar estado ao fechar/reabrir).
  useEffect(() => {
    setEstado(estadoInicial());
    if (inputRef.current) inputRef.current.value = '';
  }, [aberto]);

  const atualizar = (patch) => setEstado((e) => ({ ...e, ...patch }));

  // Prévia disponível e com pelo menos uma linha válida habilita o confirmar.
  const linhasValidas = previa?.linhas_validas ?? [];
  const erros = previa?.erros ?? [];
  const jaImportado = Boolean(previa?.ja_importado);
  const podeConfirmar =
    Boolean(previa) && linhasValidas.length > 0 && !confirmando && !gerandoPrevia;

  // ── Passo 1: escolher arquivo ──────────────────────────────
  const aoEscolherArquivo = (e) => {
    const arquivo = e.target.files?.[0] ?? null;
    // Trocar o arquivo invalida qualquer prévia anterior.
    atualizar({ file: arquivo, previa: null });
  };

  const abrirSeletor = () => inputRef.current?.click();

  const removerArquivo = () => {
    atualizar({ file: null, previa: null });
    if (inputRef.current) inputRef.current.value = '';
  };

  // ── Passo 2: gerar prévia (sem persistir) — Req 3.1 / 3.4 / 11.4 ──
  // Observação: toast.promise retorna o id do toast (não o valor resolvido),
  // então guardamos a referência da Promise e damos await nela à parte para
  // capturar os dados da prévia e tratar o erro aqui.
  const gerarPrevia = async () => {
    if (!file || !idFatura) return;
    atualizar({ gerandoPrevia: true, previa: null });
    const req = previewImportacao(idFatura, file);
    toast.promise(req, {
      loading: 'Lendo o arquivo...',
      success: 'Prévia gerada. Confira antes de confirmar.',
      error: (err) =>
        err?.response?.data?.message ?? 'Não foi possível ler o arquivo.',
    });
    try {
      const dados = await req;
      atualizar({ previa: dados ?? { linhas_validas: [], erros: [] } });
    } catch {
      // O toast.promise já mostrou o erro; mantém o modal aberto p/ nova tentativa.
      atualizar({ previa: null });
    } finally {
      atualizar({ gerandoPrevia: false });
    }
  };

  // ── Passo 3: confirmar importação — Req 3.8 / 11.4 ─────────
  const confirmar = async () => {
    if (!podeConfirmar || !file || !idFatura) return;
    atualizar({ confirmando: true });
    const req = confirmarImportacao(idFatura, file);
    toast.promise(req, {
      loading: 'Importando lançamentos...',
      success: 'Importação concluída com sucesso.',
      // Mensagem do servidor quando houver; 409 ganha texto específico.
      error: (err) => {
        if (err?.response?.status === 409) {
          return err?.response?.data?.message ?? 'Este arquivo já foi importado.';
        }
        return (
          err?.response?.data?.message ??
          'Não foi possível concluir a importação.'
        );
      },
    });
    try {
      await req;
      if (onImportado) onImportado();
      aoFechar();
    } catch {
      // Falha (409 de duplicidade/fatura fechada ou outro erro): o toast.promise
      // acima já sinalizou com a mensagem específica do servidor. Nada a
      // reverter; o modal permanece aberto para o usuário ajustar o arquivo.
    } finally {
      atualizar({ confirmando: false });
    }
  };

  return (
    <Modal>
      <Modal.Backdrop isOpen={aberto} onOpenChange={(v) => !v && aoFechar()}>
        <Modal.Container>
          <Modal.Dialog className="max-w-3xl">
            <Modal.CloseTrigger />

            <Modal.Header>
              <Modal.Heading className="flex items-center gap-2">
                <FiUploadCloud size={18} className="text-primary" />
                Importar fatura (CSV)
              </Modal.Heading>
            </Modal.Header>

            <Modal.Body className="flex flex-col gap-4">
              {/* ── Passo 1: seleção do arquivo ───────────────────── */}
              <div className="flex flex-col gap-2">
                <span className="text-xs font-medium text-foreground-500">
                  Arquivo CSV da fatura
                </span>

                {/* Input nativo escondido; disparado por um botão estilizado. */}
                <input
                  ref={inputRef}
                  type="file"
                  accept={ACCEPT}
                  className="hidden"
                  onChange={aoEscolherArquivo}
                  aria-label="Selecionar arquivo CSV da fatura"
                />

                {file ? (
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-black/10 dark:border-white/10 p-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <FiPaperclip size={16} className="shrink-0 text-foreground-500" />
                      <span className="truncate text-sm">{file.name}</span>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onPress={removerArquivo}
                      isDisabled={gerandoPrevia || confirmando}
                      aria-label="Remover arquivo"
                    >
                      <FiX size={16} />
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={abrirSeletor}
                    className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-black/15 dark:border-white/15 p-6 text-center text-foreground-500 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                  >
                    <FiUploadCloud size={28} />
                    <span className="text-sm font-medium">
                      Clique para escolher o arquivo .csv
                    </span>
                    <span className="text-xs">
                      O arquivo é apenas lido para a prévia; nada é salvo até você confirmar.
                    </span>
                  </button>
                )}

                {/* Botão de gerar prévia (passo 2). */}
                {file && !previa && (
                  <Button
                    color="primary"
                    variant="flat"
                    onPress={gerarPrevia}
                    isPending={gerandoPrevia}
                    isDisabled={gerandoPrevia}
                  >
                    <FiFileText size={16} />
                    Gerar prévia
                  </Button>
                )}
              </div>

              {/* ── Aviso de arquivo já importado (se o backend sinalizar) ── */}
              {previa && jaImportado && (
                <div className="flex items-start gap-3 rounded-xl bg-warning/10 p-3 text-warning">
                  <FiAlertTriangle size={18} className="shrink-0" />
                  <p className="text-sm">
                    Este arquivo já foi importado nesta fatura. Confirmar de novo
                    não cria lançamentos duplicados.
                  </p>
                </div>
              )}

              {/* ── Passo 2: resultado da prévia ──────────────────── */}
              {previa && (
                <div className="flex flex-col gap-4">
                  {/* Resumo da contagem */}
                  <div className="flex flex-wrap items-center gap-2">
                    <Chip
                      size="sm"
                      variant="flat"
                      color={linhasValidas.length > 0 ? 'success' : 'default'}
                    >
                      <FiCheckCircle size={14} className="mr-1" />
                      {linhasValidas.length} linha(s) válida(s)
                    </Chip>
                    {erros.length > 0 && (
                      <Chip size="sm" variant="flat" color="danger">
                        <FiAlertTriangle size={14} className="mr-1" />
                        {erros.length} com erro
                      </Chip>
                    )}
                  </div>

                  {/* Linhas válidas — tabela com scroll horizontal no mobile */}
                  {linhasValidas.length > 0 ? (
                    <div className="max-h-72 overflow-auto rounded-xl border border-black/10 dark:border-white/10">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-default-100 text-left text-xs text-foreground-500">
                          <tr>
                            <th className="px-3 py-2 font-medium">Data</th>
                            <th className="px-3 py-2 font-medium">Estabelecimento</th>
                            <th className="px-3 py-2 font-medium">Portador</th>
                            <th className="px-3 py-2 font-medium">Parcela</th>
                            <th className="px-3 py-2 font-medium">Status</th>
                            <th className="px-3 py-2 text-right font-medium">Valor</th>
                          </tr>
                        </thead>
                        <tbody>
                          {linhasValidas.map((l, i) => {
                            const st = rotuloStatus(l.status_liquidacao);
                            return (
                              <tr
                                key={`${l.fingerprint_linha ?? ''}-${i}`}
                                className="border-t border-black/5 dark:border-white/5"
                              >
                                <td className="whitespace-nowrap px-3 py-2">
                                  {formatarData(l.dt_compra)}
                                </td>
                                <td className="max-w-[16rem] truncate px-3 py-2">
                                  {l.estabelecimento || '-'}
                                </td>
                                <td className="whitespace-nowrap px-3 py-2">
                                  {l.portador_nome_importado || '-'}
                                </td>
                                <td className="whitespace-nowrap px-3 py-2">
                                  {l.parcela_texto && l.parcela_texto !== '-' ? (
                                    <Chip size="sm" variant="flat">
                                      {l.parcela_texto}
                                    </Chip>
                                  ) : (
                                    '-'
                                  )}
                                </td>
                                <td className="whitespace-nowrap px-3 py-2">
                                  <Chip size="sm" variant="flat" color={st.cor}>
                                    {st.texto}
                                  </Chip>
                                </td>
                                <td className="whitespace-nowrap px-3 py-2 text-right font-medium">
                                  {formatarDinheiro(l.valor)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="rounded-xl bg-default-100 p-4 text-center text-sm text-foreground-500">
                      Nenhuma linha válida encontrada neste arquivo.
                    </div>
                  )}

                  {/* Erros por linha — não bloqueiam ver as válidas (Req 3.4) */}
                  {erros.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <span className="text-xs font-medium text-danger">
                        Linhas ignoradas por erro
                      </span>
                      <ul className="max-h-40 space-y-1 overflow-auto rounded-xl border border-danger/20 bg-danger/5 p-3 text-sm text-danger">
                        {erros.map((e, i) => (
                          <li key={`${e.linha ?? i}-${i}`} className="flex gap-2">
                            <span className="shrink-0 font-semibold">
                              Linha {e.linha ?? '?'}:
                            </span>
                            <span className="min-w-0">{e.motivo || 'Erro não especificado.'}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </Modal.Body>

            <Modal.Footer>
              <Button
                variant="ghost"
                onPress={aoFechar}
                isDisabled={gerandoPrevia || confirmando}
              >
                Cancelar
              </Button>
              {/* Confirmação explícita (Req 3): só após prévia com >= 1 válida. */}
              <Button
                color="primary"
                onPress={confirmar}
                isPending={confirmando}
                isDisabled={!podeConfirmar}
              >
                <FiCheckCircle size={16} />
                Confirmar importação
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

export default ImportarFaturaModal;


