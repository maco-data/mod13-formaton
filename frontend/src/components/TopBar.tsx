import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useToast } from '../store/ui.store';
import { useAuth } from '../hooks/useAuth';
import { useNotifications } from '../hooks/useNotifications';
import styles from './TopBar.module.css';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Panel general',
  '/courses': 'Formaciones',
  '/participants': 'Participantes',
  '/certifications': 'Certificaciones',
  '/reports': 'Informes',
  '/calendar': 'Calendario',
};

export default function TopBar() {
  const [query, setQuery] = useState('');
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { isAdmin, logout } = useAuth();
  const notificationCount = useNotifications();

  const pageTitle = PAGE_TITLES[location.pathname] ?? 'Formaton';
  const isCoursesPage = location.pathname === '/courses';
  const canCreateCourse = isCoursesPage && isAdmin;

  const handleSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!query.trim()) {
      showToast('Escribe algo para buscar');
      return;
    }

    if (location.pathname !== '/courses') {
      navigate(`/courses?search=${encodeURIComponent(query.trim())}`);
      return;
    }

    navigate(`/courses?search=${encodeURIComponent(query.trim())}`);
  };

  const handlePrimaryAction = () => {
    if (canCreateCourse) {
      navigate('/courses?create=1');
      return;
    }

    if (isCoursesPage) {
      showToast('Solo los administradores pueden crear formaciones');
      return;
    }

    navigate('/courses');
    showToast('Abriendo catálogo de formaciones');
  };

  const handleLogout = async () => {
    await logout();
    showToast('Sesión cerrada');
  };

  return (
    <header className={styles.topbar}>
        <div className={styles.title}>{pageTitle}</div>

        <form className={styles.search} onSubmit={handleSearch}>
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar..."
            aria-label="Buscar"
          />
        </form>

        <button
          type="button"
          className={styles.iconBtn}
          onClick={() => showToast(notificationCount > 0 ? `Tienes ${notificationCount} notificaciones relevantes` : 'No tienes notificaciones pendientes')}
          aria-label="Notificaciones"
          title="Notificaciones"
        >
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="18" height="18">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.8}
              d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m6 0a3 3 0 11-6 0m6 0H9"
            />
          </svg>
          {notificationCount > 0 ? <span className={styles.notifDot} /> : null}
        </button>

        {(!isCoursesPage || isAdmin) && (
          <button
            type="button"
            className={styles.iconBtn}
            onClick={handlePrimaryAction}
            aria-label={canCreateCourse ? 'Nueva formación' : 'Ir a formaciones'}
            title={canCreateCourse ? 'Nueva formación' : 'Ir a formaciones'}
          >
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="18" height="18">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                d="M12 5v14m-7-7h14"
              />
            </svg>
          </button>
        )}

        <button
          type="button"
          className={styles.iconBtn}
          onClick={handleLogout}
          aria-label="Cerrar sesión"
          title="Cerrar sesión"
        >
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="18" height="18">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.8}
              d="M17 16l4-4m0 0l-4-4m4 4H9m4 4v1a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2h5a2 2 0 012 2v1"
            />
          </svg>
        </button>
      </header>
  );
}
