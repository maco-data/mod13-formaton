import { NavLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useNotifications } from '../hooks/useNotifications';
import styles from './Sidebar.module.css';

export default function Sidebar() {
  const { user, logout, isAdmin } = useAuth();
  const notificationCount = useNotifications();
  const safeGivenName = user?.givenName?.trim() || '';
  const safeFamilyName = user?.familyName?.trim() || '';
  const safeFullName = `${safeGivenName} ${safeFamilyName}`.trim() || user?.email || 'Usuario';

  const nav = isAdmin ? [
    {
      label: 'Principal',
      items: [
        { to: '/dashboard', icon: '▦', label: 'Panel general' },
        { to: '/courses', icon: '🎓', label: 'Formaciones', badge: notificationCount > 0 ? String(notificationCount) : undefined },
        { to: '/participants', icon: '👥', label: 'Participantes' },
        { to: '/certifications', icon: '🛡', label: 'Certificaciones' },
        { to: '/reports', icon: '📊', label: 'Informes' },
      ],
    },
    {
      label: 'Administración',
      items: [
        { to: '/calendar', icon: '📅', label: 'Calendario general' },
      ],
    },
  ] : [
    {
      label: 'Mi espacio',
      items: [
        { to: '/dashboard', icon: '▦', label: 'Resumen' },
        { to: '/courses', icon: '🎓', label: 'Cursos disponibles', badge: notificationCount > 0 ? String(notificationCount) : undefined },
        { to: '/participants', icon: '👤', label: 'Mi perfil' },
        { to: '/calendar', icon: '📅', label: 'Mi calendario' },
        { to: '/certifications', icon: '🛡', label: 'Mis certificados' },
      ],
    },
  ];

  const initials = user
    ? `${safeGivenName[0] ?? ''}${safeFamilyName[0] ?? ''}`.toUpperCase() || (user.email?.[0] ?? 'U').toUpperCase()
    : 'U';

  return (
    <aside className={styles.sidebar}>
      {/* Decorative blob */}
      <div className={styles.blob} />

      {/* Logo */}
      <div className={styles.logo}>
        <div className={styles.logoIcon}>
          <img src="/favicon.svg" alt="Formaton" className={styles.logoIconImage} />
        </div>
        <span className={styles.logoText}>Forma<span>ton</span></span>
      </div>

      {/* Nav */}
      <nav className={styles.nav}>
        {nav.map(section => (
          <div key={section.label} className={styles.section}>
            <div className={styles.sectionLabel}>{section.label}</div>
            {section.items.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `${styles.navItem} ${isActive ? styles.active : ''}`
                }
              >
                <span className={styles.navIcon}>{item.icon}</span>
                <span className={styles.navLabel}>{item.label}</span>
                {item.badge && (
                  <span className={styles.badge}>{item.badge}</span>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div className={styles.footer}>
        <button className={styles.userCard} onClick={logout} title="Cerrar sesión">
          <div className={styles.avatar}>{initials}</div>
          <div className={styles.userInfo}>
            <div className={styles.userName}>
              {safeFullName}
            </div>
            <div className={styles.userRole}>
              {user?.role === 'admin' ? 'Administrador/a RR.HH.' :
               user?.role === 'manager' ? 'Responsable de área' : 'Participante'}
            </div>
          </div>
        </button>
      </div>
    </aside>
  );
}
