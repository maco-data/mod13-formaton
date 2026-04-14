import { NavLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import styles from './Sidebar.module.css';

const NAV = [
  {
    label: 'Principal',
    items: [
      { to: '/dashboard',      icon: '▦',  label: 'Panel general' },
      { to: '/courses',        icon: '🎓', label: 'Formaciones',   badge: '24' },
      { to: '/participants',   icon: '👥', label: 'Participantes' },
      { to: '/certifications', icon: '🛡', label: 'Certificaciones' },
      { to: '/reports',        icon: '📊', label: 'Informes' },
    ],
  },
  {
    label: 'Administración',
    items: [
      { to: '/calendar', icon: '📅', label: 'Calendario' },
    ],
  },
];

export default function Sidebar() {
  const { user, logout } = useAuth();

  const initials = user
    ? `${user.givenName[0] ?? ''}${user.familyName[0] ?? ''}`.toUpperCase()
    : 'U';

  return (
    <aside className={styles.sidebar}>
      {/* Decorative blob */}
      <div className={styles.blob} />

      {/* Logo */}
      <div className={styles.logo}>
        <div className={styles.logoIcon}>
          <svg viewBox="0 0 24 24" fill="white" width="20" height="20">
            <path d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6L23 9zm6.82 6L12 12.72 5.18 9 12 5.28 18.82 9zM17 15.99l-5 2.73-5-2.73v-3.72L12 15l5-2.73v3.72z"/>
          </svg>
        </div>
        <span className={styles.logoText}>Forma<span>ton</span></span>
      </div>

      {/* Nav */}
      <nav className={styles.nav}>
        {NAV.map(section => (
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
              {user ? `${user.givenName} ${user.familyName}` : 'Usuario'}
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
