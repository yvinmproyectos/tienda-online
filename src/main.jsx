import { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { useRegisterSW } from 'virtual:pwa-register/react'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', color: 'red', fontFamily: 'monospace' }}>
          <h1>¡Algo salió mal! (v2.1 Debug)</h1>
          <h3>Error: {this.state.error?.toString()}</h3>
          <pre style={{ background: '#f0f0f0', padding: '10px', overflow: 'auto' }}>
            {this.state.errorInfo?.componentStack}
          </pre>
          <button
            onClick={() => {
              if (navigator.serviceWorker) {
                navigator.serviceWorker.getRegistrations().then(function (registrations) {
                  for (let registration of registrations) {
                    registration.unregister();
                  }
                });
              }
              window.location.reload(true);
            }}
            style={{ padding: '10px 20px', background: '#333', color: '#fff', border: 'none', marginTop: '20px', cursor: 'pointer' }}
          >
            Borrar Caché y Recargar
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Force SW update check
const intervalMS = 60 * 60 * 1000 // 1 hour

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.ready.then(registration => {
    registration.update();
  });
}
