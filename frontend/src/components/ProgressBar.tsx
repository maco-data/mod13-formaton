import styles from './ProgressBar.module.css';

interface Props {
  value: number; // 0–100
  color?: string;
  height?: number;
  showLabel?: boolean;
}

export default function ProgressBar({ value, color = 'var(--primary)', height = 5, showLabel = false }: Props) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className={styles.wrap} style={{ height }}>
      <div className={styles.fill} style={{ width: `${pct}%`, background: color, height }} />
      {showLabel && <span className={styles.label}>{pct}%</span>}
    </div>
  );
}
