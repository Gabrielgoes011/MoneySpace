// ========================================
// ErrorBoundary — captura crashes de render
// ========================================
// Evita a "tela branca": se um componente filho lançar durante o render, em vez
// de derrubar o app inteiro mostramos a mensagem + o "component stack" (qual
// componente quebrou) pra diagnóstico. Error boundaries precisam ser classe.

import { Component } from 'react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { erro: null, stack: null };
  }

  static getDerivedStateFromError(erro) {
    return { erro };
  }

  componentDidCatch(erro, info) {
    console.error('💥 ErrorBoundary capturou:', erro, info?.componentStack);
    this.setState({ stack: info?.componentStack || null });
  }

  handleReset = () => {
    this.setState({ erro: null, stack: null });
  };

  render() {
    if (this.state.erro) {
      return (
        <div className="mx-auto max-w-2xl p-6">
          <div className="rounded-xl border border-danger/30 bg-danger/5 p-5">
            <h2 className="text-lg font-bold text-danger">Algo quebrou nesta tela</h2>
            <p className="mt-1 text-sm text-foreground-600">
              Mensagem técnica + onde quebrou (component stack):
            </p>
            <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-black/5 p-3 text-xs text-foreground-700 dark:bg-white/5">
              {String(this.state.erro?.message || this.state.erro)}
            </pre>
            {this.state.stack && (
              <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-black/5 p-3 text-[11px] leading-snug text-foreground-600 dark:bg-white/5">
                {this.state.stack}
              </pre>
            )}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="rounded-lg bg-primary px-3 py-1.5 text-sm text-white"
              >
                Tentar de novo
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-lg border border-black/15 px-3 py-1.5 text-sm dark:border-white/15"
              >
                Recarregar página
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
