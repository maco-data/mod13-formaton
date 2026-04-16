import { useState } from 'react';
import StatCard from '../components/StatCard';
import ProgressBar from '../components/ProgressBar';
import { useToast } from '../store/ui.store';
import { useCerts } from '../hooks/useCerts';
import participantsService from '../services/participants.service';
import styles from './Certifications.module.css';

const CERT_THEMES = ['#EF4444', '#10B981', '#4F46E5', '#F59E0B', '#06B6D4', '#8B5CF6'];
const CERT_ICONS = ['🦺', '🍽', '🛡', '📋', '💻', '🚗'];

interface SelectedCert {
  certId: string;
  workshopName: string;
  norm?: string;
  issuedAt: string;
  expiresAt?: string;
  status: 'valid' | 'expired' | 'revoked';
  userId: string;
  userName?: string;
  userEmail?: string;
  score?: number;
}

export default function Certifications() {
  const { showToast } = useToast();
  const { certs, loading, error, reload, verify } = useCerts();
  const [selectedCert, setSelectedCert] = useState<SelectedCert | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const grouped = Object.values(certs.reduce<Record<string, {
    id: string;
    name: string;
    norm: string;
    count: number;
    validCount: number;
  }>>((acc, cert) => {
    const current = acc[cert.workshopId] ?? {
      id: cert.workshopId,
      name: cert.workshopName,
      norm: cert.norm ?? 'Sin normativa asociada',
      count: 0,
      validCount: 0,
    };

    current.count += 1;
    if (cert.status === 'valid') current.validCount += 1;
    acc[cert.workshopId] = current;
    return acc;
  }, {})).map((group, index) => ({
    ...group,
    pct: group.count > 0 ? Math.round((group.validCount / group.count) * 100) : 0,
    color: CERT_THEMES[index % CERT_THEMES.length],
    icon: CERT_ICONS[index % CERT_ICONS.length],
  }));

  const expiring = certs
    .filter((cert) => cert.expiresAt)
    .map((cert, index) => {
      const expiresAt = new Date(cert.expiresAt as string);
      const days = Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
      return {
        name: cert.userId,
        cert: cert.workshopName,
        days,
        color: days <= 10 ? '#EF4444' : '#F59E0B',
        id: `${cert.certId}-${index}`,
      };
    })
    .filter((cert) => cert.days <= 30)
    .sort((a, b) => a.days - b.days)
    .slice(0, 4);

  const validCerts = certs.filter((cert) => cert.status === 'valid').length;
  const expiringSoon = expiring.length;
  const compliance = certs.length > 0 ? Math.round((validCerts / certs.length) * 100) : 0;

  const formatDate = (value?: string) => {
    if (!value) return 'Sin fecha';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const openCertDetail = async (certId: string) => {
    const cert = certs.find((item) => item.certId === certId);
    if (!cert) return;

    try {
      setDetailLoading(true);
      const [verification, participant] = await Promise.all([
        verify(certId),
        participantsService.get(cert.userId).catch(() => null),
      ]);

      setSelectedCert({
        certId: verification.certId,
        workshopName: verification.workshopName,
        norm: verification.norm,
        issuedAt: verification.issuedAt,
        expiresAt: verification.expiresAt,
        status: verification.status as SelectedCert['status'],
        userId: cert.userId,
        userName: participant ? participant.fullName || `${participant.givenName} ${participant.familyName}`.trim() : undefined,
        userEmail: participant?.email,
        score: cert.score,
      });
    } catch (err) {
      showToast((err as Error).message);
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      {/* KPIs */}
      <div className={styles.statsGrid}>
        <StatCard value={loading ? '...' : validCerts} label="Certificados vigentes" icon="✅" color="green" />
        <StatCard value={loading ? '...' : expiringSoon} label="Por vencer (30 días)" icon="⏰" changeUp={false} color="amber" />
        <StatCard value={loading ? '...' : `${compliance}%`} label="Cumplimiento normativo" icon="🛡" color="indigo" />
      </div>

      <div className={styles.mainGrid}>
        {/* Cert cards */}
        <div>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Certificaciones activas</h2>
            <button className={styles.btnOutline} onClick={() => showToast('Exportando informe...')}>
              📥 Exportar
            </button>
          </div>

          <div className={styles.certGrid}>
            {grouped.map(c => (
              <div key={c.id} className={styles.certCard} onClick={() => {
                const firstCert = certs.find((cert) => cert.workshopId === c.id);
                if (firstCert) {
                  void openCertDetail(firstCert.certId);
                }
              }}>
                <div className={styles.certIcon} style={{ background: `${c.color}18` }}>{c.icon}</div>
                <div className={styles.certInfo}>
                  <div className={styles.certName}>{c.name}</div>
                  <div className={styles.certNorm}>{c.norm}</div>
                  <div className={styles.certProgress}>
                    <ProgressBar value={c.pct} color={c.color} height={5} />
                    <span className={styles.certPct} style={{ color: c.color }}>{c.pct}%</span>
                  </div>
                  <div className={styles.certCount}>
                    {c.pct === 100
                      ? '✓ Cumplimiento total'
                      : `${c.validCount} / ${c.count} empleados certificados`}
                  </div>
                </div>
              </div>
            ))}
            {!loading && grouped.length === 0 && (
              <div className={styles.certCard}>
                <div className={styles.certInfo}>
                  <div className={styles.certName}>{error ? 'No se pudieron cargar las certificaciones' : 'Aún no hay certificaciones'}</div>
                  <div className={styles.certNorm}>{error ?? 'Cuando el backend devuelva datos aparecerán aquí agrupadas por formación.'}</div>
                  {error && (
                    <button className={styles.btnOutline} onClick={() => void reload()}>
                      Reintentar
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar: expiring + actions */}
        <div className={styles.sidebar}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>Próximos vencimientos</span>
              <span className={styles.alertBadge}>⚠ {expiring.length}</span>
            </div>
            <div className={styles.expiringList}>
              {expiring.map((e) => (
                <div
                  key={e.id}
                  className={styles.expiringItem}
                  onClick={() => {
                    const cert = certs.find((item) => item.certId === e.id.split('-')[0]);
                    if (cert) {
                      void openCertDetail(cert.certId);
                    }
                  }}
                >
                  <div className={styles.expiringDot} style={{ background: e.color }} />
                  <div className={styles.expiringInfo}>
                    <div className={styles.expiringName}>{e.name}</div>
                    <div className={styles.expiringCert}>{e.cert}</div>
                  </div>
                  <span className={styles.expiringDays} style={{ color: e.color }}>
                    {e.days}d
                  </span>
                </div>
              ))}
              {!loading && expiring.length === 0 && (
                <div className={styles.expiringItem}>
                  <div className={styles.expiringInfo}>
                    <div className={styles.expiringName}>Sin vencimientos próximos</div>
                    <div className={styles.expiringCert}>No hay certificados que expiren en los próximos 30 días.</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardHeader}><span className={styles.cardTitle}>Acciones</span></div>
            <div className={styles.actionsList}>
              {[
                { icon:'🏅', label:'Emitir certificados masivo' },
                { icon:'📤', label:'Importar certificados externos' },
                { icon:'🔔', label:'Enviar recordatorio de renovación' },
                { icon:'📊', label:'Informe de cumplimiento normativo' },
              ].map(a => (
                <button key={a.label} className={styles.actionBtn} onClick={() => showToast(a.label)}>
                  <span>{a.icon}</span> {a.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {(detailLoading || selectedCert) && (
        <div className={styles.overlay} onClick={(event) => {
          if (event.target === event.currentTarget) setSelectedCert(null);
        }}>
          <div className={styles.detailModal}>
            <div className={styles.detailHeader}>
              <div>
                <div className={styles.detailEyebrow}>Certificado</div>
                <h2>{detailLoading ? 'Cargando certificado...' : selectedCert?.workshopName}</h2>
              </div>
              <button className={styles.closeBtn} onClick={() => setSelectedCert(null)}>✕</button>
            </div>

            {!detailLoading && selectedCert ? (
              <div className={styles.detailBody}>
                <div className={styles.detailGrid}>
                  <div className={styles.detailCard}>
                    <div className={styles.detailLabel}>Cert ID</div>
                    <div className={styles.detailValue}>{selectedCert.certId}</div>
                  </div>
                  <div className={styles.detailCard}>
                    <div className={styles.detailLabel}>Estado</div>
                    <div className={styles.detailValue}>{selectedCert.status}</div>
                  </div>
                  <div className={styles.detailCard}>
                    <div className={styles.detailLabel}>Participante</div>
                    <div className={styles.detailValue}>{selectedCert.userName ?? selectedCert.userId}</div>
                    <div className={styles.detailMeta}>{selectedCert.userEmail ?? 'Sin email disponible'}</div>
                  </div>
                  <div className={styles.detailCard}>
                    <div className={styles.detailLabel}>Normativa</div>
                    <div className={styles.detailValue}>{selectedCert.norm ?? 'Sin normativa'}</div>
                  </div>
                </div>

                <div className={styles.detailCard}>
                  <div className={styles.detailLabel}>Fechas</div>
                  <div className={styles.detailMeta}>Emitido: {formatDate(selectedCert.issuedAt)}</div>
                  <div className={styles.detailMeta}>Expira: {formatDate(selectedCert.expiresAt)}</div>
                  {typeof selectedCert.score === 'number' ? (
                    <div className={styles.detailMeta}>Puntuación: {selectedCert.score}</div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
