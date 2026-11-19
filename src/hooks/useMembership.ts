import { useCallback, useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  DEFAULT_SCHOOL_NAME,
  DEFAULT_SCHOOL_TIMEZONE,
  type SchoolConfig,
} from '../config/school';
import { fetchSchoolConfig, fetchUserMembership } from '../services/membershipService';
import type { MembershipCapabilities, SchoolMembership } from '../types/membership';
import { logClientDiagnostic } from '../utils/errorHandling';
import { getMembershipCapabilities } from '../utils/eventValidation';
import { getRuntimeSchoolId } from '../utils/schoolContext';

export function useMembership(user: User | null, authLoading: boolean) {
  const activeSchoolId = useMemo(() => getRuntimeSchoolId(), []);

  const [schoolConfig, setSchoolConfig] = useState<SchoolConfig>({
    id: activeSchoolId,
    name: DEFAULT_SCHOOL_NAME,
    timezone: DEFAULT_SCHOOL_TIMEZONE,
    status: 'active',
    allowPublicDiscovery: true,
  });
  const [membership, setMembership] = useState<SchoolMembership | null>(null);
  const [membershipLoading, setMembershipLoading] = useState(true);

  const loadSchoolAndMembership = useCallback(async () => {
    setMembershipLoading(true);
    try {
      const config = await fetchSchoolConfig(activeSchoolId);
      setSchoolConfig(config);

      if (!user) {
        setMembership(null);
        return;
      }

      const resolved = await fetchUserMembership(config.id, user);
      setMembership(resolved);
    } catch (err) {
      logClientDiagnostic('useMembership.loadSchoolAndMembership', err);
      setMembership(null);
    } finally {
      setMembershipLoading(false);
    }
  }, [activeSchoolId, user]);

  useEffect(() => {
    if (authLoading) return;
    void loadSchoolAndMembership();
  }, [authLoading, loadSchoolAndMembership]);

  const capabilities: MembershipCapabilities = useMemo(
    () => getMembershipCapabilities(membership),
    [membership]
  );

  return {
    schoolId: schoolConfig.id,
    schoolConfig,
    membership,
    membershipLoading,
    capabilities,
    refreshMembership: loadSchoolAndMembership,
  };
}
