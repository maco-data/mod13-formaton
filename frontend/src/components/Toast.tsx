import { useToast } from '../store/ui.store';
import styles from './Toast.module.css';

export default function Toast() {
  const { toastMsg, toastVisible } = useToast();
  return (
    <div className={`${styles.toast} ${toastVisible ? styles.show : ''}`}>
      <span className={styles.icon}>✓</span>
      {toastMsg}
    </div>
  );
}
