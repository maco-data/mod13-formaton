import React from 'react';

type State = {
  hasError: boolean;
  message: string;
};

export default class AppErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = {
    hasError: false,
    message: '',
  };

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error.message || 'Error inesperado al renderizar la aplicación.',
    };
  }

  componentDidCatch(error: Error) {
    console.error('[AppErrorBoundary]', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          background: 'var(--bg)',
          color: 'var(--text-primary)',
        }}>
          <div style={{
            maxWidth: '560px',
            width: '100%',
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            boxShadow: 'var(--shadow)',
            padding: '24px',
          }}>
            <h2 style={{ marginBottom: '8px' }}>La interfaz encontró un error</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '12px' }}>
              La aplicación sigue desplegada, pero una pantalla falló al renderizar.
            </p>
            <pre style={{
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              background: 'var(--bg)',
              borderRadius: '12px',
              padding: '12px',
              color: 'var(--text-primary)',
            }}>
              {this.state.message}
            </pre>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
