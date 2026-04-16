import { useMemo } from 'react';
import { useAuth } from './useAuth';
import { useCourses } from './useCourses';
import { useCerts } from './useCerts';

export function useNotifications() {
  const { user, isAdmin } = useAuth();
  const { courses } = useCourses();
  const { certs } = useCerts(isAdmin ? undefined : user?.sub);

  return useMemo(() => {
    const now = Date.now();

    if (isAdmin) {
      const upcomingCourses = courses.filter((course) => {
        const startAt = new Date(course.startAt).getTime();
        return course.status === 'scheduled' && startAt >= now && startAt - now <= 7 * 24 * 60 * 60 * 1000;
      }).length;

      const fullCourses = courses.filter((course) => course.enrolledCount >= course.capacity).length;
      const expiringCerts = certs.filter((cert) => {
        if (!cert.expiresAt) return false;
        const expiresAt = new Date(cert.expiresAt).getTime();
        return expiresAt >= now && expiresAt - now <= 30 * 24 * 60 * 60 * 1000;
      }).length;

      return upcomingCourses + fullCourses + expiringCerts;
    }

    return courses.filter((course) => {
      const startAt = new Date(course.startAt).getTime();
      return course.status === 'scheduled' && startAt >= now && startAt - now <= 7 * 24 * 60 * 60 * 1000;
    }).length;
  }, [certs, courses, isAdmin, user?.sub]);
}
