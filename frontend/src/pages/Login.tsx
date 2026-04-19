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

  if (isAuthenticated) return <Navigate to="/courses" replace />;

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
            <img src="/favicon.svg" alt="Formaton" className={styles.brandIconImage} />
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

          {(isDemoMode || isDev) && (
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
