import styles from './StatCard.module.css';

interface Props {
  value: string | number;
  label: string;
  icon: React.ReactNode;
  change?: string;
  changeUp?: boolean;
  color?: 'indigo' | 'cyan' | 'green' | 'amber';
  onClick?: () => void;
}

export default function StatCard({ value, label, icon, change, changeUp = true, color = 'indigo', onClick }: Props) {
  return (
    <div className={`${styles.card} ${styles[color]} ${onClick ? styles.clickable : ''}`} onClick={onClick}>
      <div className={styles.top}>
        <div className={`${styles.icon} ${styles[color]}`}>{icon}</div>
        {change && (
          <span className={`${styles.change} ${changeUp ? styles.up : styles.down}`}>
            {changeUp ? '↑' : '↓'} {change}
          </span>
        )}
      </div>
      <div className={styles.value}>{value}</div>
      <div className={styles.label}>{label}</div>
    </div>
  );
}
