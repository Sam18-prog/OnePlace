export type MemberRole = 'student' | 'organizer' | 'admin';

export type MemberStatus = 'active' | 'suspended';

export interface SchoolMembership {
  uid: string;
  schoolId: string;
  role: MemberRole;
  status: MemberStatus;
  displayName?: string;
  email?: string;
  assignedBy?: string;
  createdAt: Date;
  updatedAt?: Date;
  isBootstrappedAdmin?: boolean;
}

export interface MembershipCapabilities {
  isActiveMember: boolean;
  canAccessOrganizer: boolean;
  canManageAllSchoolEvents: boolean;
  canManageRoles: boolean;
  canManageSchoolSettings: boolean;
}
