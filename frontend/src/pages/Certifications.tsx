import { useEffect, useMemo, useState } from 'react';
import StatCard from '../components/StatCard';
import ProgressBar from '../components/ProgressBar';
import { useToast } from '../store/ui.store';
import { useCerts } from '../hooks/useCerts';
import { useAuth } from '../hooks/useAuth';
import participantsService, { type Participant } from '../services/participants.service';
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

interface ExpiringCertItem {
  id: string;
  certId: string;
  name: string;
  cert: string;
  days: number;
  color: string;
}

function formatDate(value?: string) {
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
}

function getDaysUntil(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function getStatusLabel(status: SelectedCert['status']) {
  if (status === 'valid') return 'Vigente';
  if (status === 'expired') return 'Caducado';
  return 'Revocado';
}

function getStatusTone(status: SelectedCert['status']) {
  if (status === 'valid') return styles.statusValid;
  if (status === 'expired') return styles.statusExpired;
  return styles.statusRevoked;
}

export default function Certifications() {
  const { showToast } = useToast();
  const { isAdmin, user } = useAuth();
  const { certs, loading, error, reload, verify } = useCerts(isAdmin ? undefined : user?.sub);
  const [selectedCert, setSelectedCert] = useState<SelectedCert | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [participantMap, setParticipantMap] = useState<Record<string, Participant>>({});

  useEffect(() => {
    if (!isAdmin) {
      setParticipantMap({});
      return;
    }

    const expiringUserIds = Array.from(new Set(
      certs
        .filter((cert) => {
          const days = getDaysUntil(cert.expiresAt);
          return days !== null && days <= 30;
        })
        .map((cert) => cert.userId)
    )).slice(0, 8);

    if (expiringUserIds.length === 0) {
      setParticipantMap({});
      return;
    }

    let cancelled = false;

    void Promise.all(
      expiringUserIds.map(async (userId) => {
        try {
          const participant = await participantsService.get(userId);
          return [userId, participant] as const;
        } catch {
          return null;
        }
      })
    ).then((entries) => {
      if (cancelled) return;
      const nextMap: Record<string, Participant> = {};
      entries.forEach((entry) => {
        if (!entry) return;
        nextMap[entry[0]] = entry[1];
      });
      setParticipantMap(nextMap);
    });

    return () => {
      cancelled = true;
    };
  }, [certs, isAdmin]);

  const grouped = useMemo(() => Object.values(certs.reduce<Record<string, {
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
  })), [certs]);

  const expiring = useMemo(() => certs
    .filter((cert) => cert.expiresAt)
    .map((cert, index) => {
      const days = getDaysUntil(cert.expiresAt);
      if (days === null) return null;

      const participant = participantMap[cert.userId];
      const ownName = user ? `${user.givenName} ${user.familyName}`.trim() : undefined;
      const displayName = isAdmin
        ? participant?.fullName || `${participant?.givenName ?? ''} ${participant?.familyName ?? ''}`.trim() || cert.userId
        : ownName || user?.email || 'Mi certificado';

      return {
        name: displayName,
        cert: cert.workshopName,
        days: Math.max(0, days),
        color: days <= 10 ? '#EF4444' : '#F59E0B',
        id: `${cert.certId}-${index}`,
        certId: cert.certId,
      } satisfies ExpiringCertItem;
    })
    .filter((cert): cert is ExpiringCertItem => cert !== null)
    .filter((cert) => cert.days <= 30)
    .sort((a, b) => a.days - b.days)
    .slice(0, 4), [certs, isAdmin, participantMap, user]);

  const visibleCerts = useMemo(
    () => [...certs].sort((a, b) => b.issuedAt.localeCompare(a.issuedAt)),
    [certs]
  );

  const validCerts = certs.filter((cert) => cert.status === 'valid').length;
  const expiredCerts = certs.filter((cert) => cert.status === 'expired').length;
  const expiringSoon = expiring.length;
  const compliance = certs.length > 0 ? Math.round((validCerts / certs.length) * 100) : 0;

  const studentPrimaryStat = validCerts;
  const studentSecondaryStat = certs.length;

  const openCertDetail = async (certId: string) => {
    const cert = certs.find((item) => item.certId === certId);
    if (!cert) return;

    try {
      setDetailLoading(true);
      const participantPromise = isAdmin
        ? participantsService.get(cert.userId).catch(() => null)
        : Promise.resolve(null);
      const [verification, participant] = await Promise.all([
        verify(certId),
        participantPromise,
      ]);

      const ownName = user ? `${user.givenName} ${user.familyName}`.trim() : undefined;

      setSelectedCert({
        certId: verification.certId,
        workshopName: verification.workshopName,
        norm: verification.norm,
        issuedAt: verification.issuedAt,
        expiresAt: verification.expiresAt,
        status: verification.status as SelectedCert['status'],
        userId: cert.userId,
        userName: participant
          ? participant.fullName || `${participant.givenName} ${participant.familyName}`.trim()
          : ownName,
        userEmail: participant?.email ?? user?.email,
        score: cert.score,
      });
    } catch (err) {
      showToast((err as Error).message);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleExport = () => {
    if (certs.length === 0) {
      showToast(isAdmin ? 'No hay certificados para exportar todavía' : 'Aún no tienes certificados para exportar');
      return;
    }
    showToast(isAdmin ? 'Exportación de certificados en preparación' : 'La exportación personal estará disponible próximamente');
  };

  const renderEmptyState = () => (
    <div className={styles.certCard}>
      <div className={styles.certInfo}>
        <div className={styles.certName}>
          {error
            ? 'No se pudieron cargar los certificados'
            : isAdmin
              ? 'Aún no hay certificados emitidos'
              : 'Todavía no tienes certificados disponibles'}
        </div>
        <div className={styles.certNorm}>
          {error
            ? error
            : isAdmin
              ? 'Cuando se emitan certificados desde las formaciones, aparecerán aquí agrupados por curso.'
              : 'Cuando completes una formación certificable, podrás consultarla desde este espacio.'}
        </div>
        {error ? (
          <button className={styles.btnOutline} onClick={() => void reload()}>
            Reintentar
          </button>
        ) : null}
      </div>
    </div>
  );

  return (
    <div className={styles.page}>
      <div className={styles.statsGrid}>
        {isAdmin ? (
          <>
            <StatCard value={loading ? '...' : validCerts} label="Certificados vigentes" icon="✅" color="green" />
            <StatCard value={loading ? '...' : expiringSoon} label="Por vencer (30 días)" icon="⏰" changeUp={false} color="amber" />
            <StatCard value={loading ? '...' : `${compliance}%`} label="Cumplimiento normativo" icon="🛡" color="indigo" />
          </>
        ) : (
          <>
            <StatCard value={loading ? '...' : studentPrimaryStat} label="Mis certificados vigentes" icon="✅" color="green" />
            <StatCard value={loading ? '...' : expiringSoon} label="Mis renovaciones cercanas" icon="⏰" changeUp={false} color="amber" />
            <StatCard value={loading ? '...' : studentSecondaryStat} label="Histórico disponible" icon="🏅" color="indigo" />
          </>
        )}
      </div>

      <div className={styles.mainGrid}>
        <div>
          <div className={styles.sectionHeader}>
            <div>
              <h2 className={styles.sectionTitle}>
                {isAdmin ? 'Certificaciones activas' : 'Mis certificados'}
              </h2>
              <div className={styles.sectionSubtitle}>
                {isAdmin
                  ? 'Resumen por formación y acceso rápido al detalle de cada certificado.'
                  : 'Consulta vigencia, fechas de emisión y detalle de tus certificados.'}
              </div>
            </div>
            <button className={styles.btnOutline} onClick={handleExport}>
              📥 {isAdmin ? 'Exportar informe' : 'Exportar mis certificados'}
            </button>
          </div>

          {isAdmin ? (
            <div className={styles.certGrid}>
              {grouped.map((group) => (
                <div
                  key={group.id}
                  className={styles.certCard}
                  onClick={() => {
                    const firstCert = certs.find((cert) => cert.workshopId === group.id);
                    if (firstCert) {
                      void openCertDetail(firstCert.certId);
                    }
                  }}
                >
                  <div className={styles.certIcon} style={{ background: `${group.color}18` }}>{group.icon}</div>
                  <div className={styles.certInfo}>
                    <div className={styles.certName}>{group.name}</div>
                    <div className={styles.certNorm}>{group.norm}</div>
                    <div className={styles.certProgress}>
                      <ProgressBar value={group.pct} color={group.color} height={5} />
                      <span className={styles.certPct} style={{ color: group.color }}>{group.pct}%</span>
                    </div>
                    <div className={styles.certCount}>
                      {group.pct === 100 ? 'Cumplimiento total' : `${group.validCount} / ${group.count} certificados vigentes`}
                    </div>
                  </div>
                </div>
              ))}
              {!loading && grouped.length === 0 ? renderEmptyState() : null}
            </div>
          ) : (
            <div className={styles.listCard}>
              {visibleCerts.map((cert) => {
                const daysUntilExpiry = getDaysUntil(cert.expiresAt);
                return (
                  <button
                    key={cert.certId}
                    className={styles.certificateRow}
                    onClick={() => void openCertDetail(cert.certId)}
                  >
                    <div className={styles.certificateMain}>
                      <div className={styles.certificateTitle}>{cert.workshopName}</div>
                      <div className={styles.certificateMeta}>
                        {cert.norm ?? 'Sin normativa asociada'} · Emitido {formatDate(cert.issuedAt)}
                      </div>
                    </div>
                    <div className={styles.certificateSide}>
                      <span className={`${styles.statusBadge} ${getStatusTone(cert.status)}`}>
                        {getStatusLabel(cert.status)}
                      </span>
                      <div className={styles.certificateHint}>
                        {daysUntilExpiry === null
                          ? 'Sin caducidad'
                          : daysUntilExpiry < 0
                            ? 'Caducado'
                            : `${Math.max(0, daysUntilExpiry)} días restantes`}
                      </div>
                    </div>
                  </button>
                );
              })}
              {!loading && visibleCerts.length === 0 ? renderEmptyState() : null}
            </div>
          )}
        </div>

        <div className={styles.sidebar}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>
                {isAdmin ? 'Próximos vencimientos' : 'Mis próximos vencimientos'}
              </span>
              <span className={styles.alertBadge}>⚠ {expiring.length}</span>
            </div>
            <div className={styles.expiringList}>
              {expiring.map((item) => (
                <div
                  key={item.id}
                  className={styles.expiringItem}
                  onClick={() => void openCertDetail(item.certId)}
                >
                  <div className={styles.expiringDot} style={{ background: item.color }} />
                  <div className={styles.expiringInfo}>
                    <div className={styles.expiringName}>{item.name}</div>
                    <div className={styles.expiringCert}>{item.cert}</div>
                  </div>
                  <span className={styles.expiringDays} style={{ color: item.color }}>
                    {item.days}d
                  </span>
                </div>
              ))}
              {!loading && expiring.length === 0 ? (
                <div className={styles.expiringItem}>
                  <div className={styles.expiringInfo}>
                    <div className={styles.expiringName}>
                      {isAdmin ? 'Sin vencimientos próximos' : 'No tienes renovaciones cercanas'}
                    </div>
                    <div className={styles.expiringCert}>
                      {isAdmin
                        ? 'No hay certificados que expiren en los próximos 30 días.'
                        : 'Tus certificados vigentes no caducan en los próximos 30 días.'}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardHeader}><span className={styles.cardTitle}>{isAdmin ? 'Acciones' : 'Siguientes pasos'}</span></div>
            <div className={styles.actionsList}>
              {(isAdmin
                ? [
                    { icon: '🏅', label: 'Emitir desde una formación', message: 'La emisión se realiza desde el detalle de cada formación.' },
                    { icon: '🔔', label: 'Preparar renovaciones', message: expiringSoon > 0 ? `${expiringSoon} certificados requieren seguimiento cercano.` : 'No hay renovaciones urgentes ahora mismo.' },
                    { icon: '📊', label: 'Revisar cumplimiento', message: `Cumplimiento actual: ${compliance}%.` },
                    { icon: '📥', label: 'Exportar informe', message: 'La exportación consolidada estará disponible próximamente.' },
                  ]
                : [
                    { icon: '✅', label: 'Ver certificados vigentes', message: validCerts > 0 ? `Tienes ${validCerts} certificados vigentes.` : 'Todavía no tienes certificados vigentes.' },
                    { icon: '⏰', label: 'Revisar caducidades', message: expiringSoon > 0 ? `Tienes ${expiringSoon} certificado(s) próximos a vencer.` : 'No tienes caducidades próximas.' },
                    { icon: '📚', label: 'Consultar formaciones', message: 'Si necesitas renovar uno, puedes revisar las formaciones disponibles desde Cursos.' },
                    { icon: '📥', label: 'Exportar historial', message: certs.length > 0 ? 'La exportación personal estará disponible próximamente.' : 'Necesitas al menos un certificado para exportar tu historial.' },
                  ]).map((action) => (
                <button key={action.label} className={styles.actionBtn} onClick={() => showToast(action.message)}>
                  <span>{action.icon}</span> {action.label}
                </button>
              ))}
            </div>
          </div>

          {isAdmin ? (
            <div className={styles.card}>
              <div className={styles.cardHeader}><span className={styles.cardTitle}>Resumen rápido</span></div>
              <div className={styles.summaryList}>
                <div className={styles.summaryItem}>
                  <strong>{validCerts}</strong>
                  <span>vigentes</span>
                </div>
                <div className={styles.summaryItem}>
                  <strong>{expiredCerts}</strong>
                  <span>caducados</span>
                </div>
                <div className={styles.summaryItem}>
                  <strong>{grouped.length}</strong>
                  <span>formaciones con certificados</span>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {(detailLoading || selectedCert) ? (
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
                    <div className={styles.detailValue}>
                      <span className={`${styles.statusBadge} ${getStatusTone(selectedCert.status)}`}>
                        {getStatusLabel(selectedCert.status)}
                      </span>
                    </div>
                  </div>
                  <div className={styles.detailCard}>
                    <div className={styles.detailLabel}>{isAdmin ? 'Participante' : 'Titular'}</div>
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
      ) : null}
    </div>
  );
}
