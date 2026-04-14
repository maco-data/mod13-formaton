import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import styles from './Login.module.css';

export default function Login() {
  const { isAuthenticated, login, loading, error, isDemoMode } = useAuth();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const isDev = import.meta.env.VITE_ENV === 'dev';

  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await login(email, password);
    } catch {
      // error shown via useAuth
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.left}>
        <div className={styles.brand}>
          <div className={styles.brandIcon}>
            <svg viewBox="0 0 24 24" fill="white" width="28" height="28">
              <path d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6L23 9zm6.82 6L12 12.72 5.18 9 12 5.28 18.82 9zM17 15.99l-5 2.73-5-2.73v-3.72L12 15l5-2.73v3.72z"/>
            </svg>
          </div>
          <span className={styles.brandName}>Formaton</span>
        </div>

        <div className={styles.heroText}>
          <h1>Gestión de formación<br />corporativa, simplificada.</h1>
          <p>Planifica, ejecuta y certifica la formación de tu equipo desde un único lugar.</p>
        </div>

        <div className={styles.features}>
          {['Seguimiento en tiempo real','Certificaciones normativas','Informes y dashboards','Integración con Fundae'].map(f => (
            <div key={f} className={styles.feature}>
              <span className={styles.featureCheck}>✓</span>
              <span>{f}</span>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.right}>
        <form className={styles.card} onSubmit={handleSubmit}>
          <div className={styles.formHeader}>
            <h2>Acceder a Formaton</h2>
            <p>Introduce tus credenciales corporativas</p>
          </div>

          {isDemoMode && (
            <div className={styles.demoBanner}>
              🧪 <strong>Modo demo</strong> — introduce cualquier email y contraseña para entrar.
            </div>
          )}

          {!isDemoMode && isDev && (
            <div className={styles.demoBanner}>
              Admin: <strong>admin@formaton.demo</strong> · Student: <strong>student@formaton.demo</strong> · Clave: <strong>Formaton2026!</strong>
            </div>
          )}

          {error && <div className={styles.errorBanner}>{error}</div>}

          <div className={styles.group}>
            <label>Correo electrónico</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="nombre@empresa.es"
              required
              autoFocus
            />
          </div>

          <div className={styles.group}>
            <label>Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <button type="submit" className={styles.btnSubmit} disabled={submitting || loading}>
            {submitting ? <span className={styles.btnSpinner} /> : null}
            {submitting ? 'Accediendo...' : 'Entrar'}
          </button>

          <p className={styles.hint}>
            ¿Olvidaste tu contraseña? Contacta con tu administrador de RR.HH.
          </p>
        </form>
      </div>
    </div>
  );
}
