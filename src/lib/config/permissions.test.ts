/**
 * Access Control Tests for Permission System
 *
 * Tests for canAccessSection(), canAccessCategory() and cohort-based permissions.
 * Verifies that users with specific cohorts cannot access restricted areas.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { UserPermissions, CategoryConfig, SectionConfig, CategoryAccessConfig } from './types';

// Mock the loader module
vi.mock('./loader', () => ({
	getRole: vi.fn(),
	getSection: vi.fn(),
	getCategory: vi.fn(),
	getCategories: vi.fn(),
	roleHasCapability: vi.fn(),
	roleIsHigherThan: vi.fn(),
	getHighestRole: vi.fn()
}));

import {
	canAccessSection,
	canAccessCategory,
	hasCapability,
	getEffectiveRole,
	isGlobalAdmin,
	isSectionAdmin,
	hasCrossZoneAccess,
	getAccessibleCategories,
	getAccessibleSections,
	createDefaultPermissions,
	createAdminPermissions,
	addCohort,
	removeCohort,
	addSectionRole,
	removeSectionRole
} from './permissions';

import {
	getRole,
	getSection,
	getCategory,
	getCategories,
	roleHasCapability,
	roleIsHigherThan
} from './loader';

/**
 * Test fixtures for cohort-based access control
 */
const COHORTS = {
	FAMILY: 'family',
	MINIMOONOIR: 'minimoonoir',
	BUSINESS: 'business',
	ADMIN: 'admin',
	CROSS_ACCESS: 'cross-access'
} as const;

/**
 * Create mock user permissions for testing
 */
function createTestPermissions(options: {
	pubkey?: string;
	cohorts: string[];
	globalRole?: 'guest' | 'member' | 'moderator' | 'section-admin' | 'admin';
	sectionRoles?: Array<{ sectionId: string; role: string }>;
}): UserPermissions {
	return {
		pubkey: options.pubkey || 'test-pubkey-123',
		cohorts: options.cohorts,
		globalRole: options.globalRole || 'member',
		sectionRoles: (options.sectionRoles || []).map(sr => ({
			sectionId: sr.sectionId,
			role: sr.role as any,
			assignedAt: Date.now()
		}))
	};
}

/**
 * Create mock category config for testing
 */
function createTestCategory(options: {
	id: string;
	name: string;
	access?: CategoryAccessConfig;
}): CategoryConfig {
	return {
		id: options.id,
		name: options.name,
		description: `${options.name} description`,
		icon: '📁',
		order: 1,
		sections: [],
		access: options.access
	};
}

/**
 * Create mock section config for testing
 */
function createTestSection(options: {
	id: string;
	name: string;
	autoApprove?: boolean;
	requiredCohorts?: string[];
}): SectionConfig {
	return {
		id: options.id,
		name: options.name,
		description: `${options.name} description`,
		icon: '📋',
		order: 1,
		access: {
			requiresApproval: !options.autoApprove,
			defaultRole: 'member',
			autoApprove: options.autoApprove || false,
			requiredCohorts: options.requiredCohorts
		},
		calendar: { access: 'full', canCreate: false },
		ui: { color: '#000000' }
	};
}

describe('Permission System - Cohort-Based Access Control', () => {
	beforeEach(() => {
		vi.clearAllMocks();

		// Setup default role mocks
		vi.mocked(getRole).mockImplementation((roleId) => {
			const roles: Record<string, { id: string; name: string; level: number }> = {
				guest: { id: 'guest', name: 'Guest', level: 0 },
				member: { id: 'member', name: 'Member', level: 1 },
				moderator: { id: 'moderator', name: 'Moderator', level: 2 },
				'section-admin': { id: 'section-admin', name: 'Section Admin', level: 3 },
				admin: { id: 'admin', name: 'Admin', level: 4 }
			};
			return roles[roleId] as any;
		});

		vi.mocked(roleHasCapability).mockReturnValue(false);
		vi.mocked(roleIsHigherThan).mockImplementation((a, b) => {
			const levels: Record<string, number> = {
				guest: 0, member: 1, moderator: 2, 'section-admin': 3, admin: 4
			};
			return (levels[a] || 0) > (levels[b] || 0);
		});
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('canAccessCategory() - Zone-Level Visibility', () => {
		it('should DENY access to "minimoonoir" category for "family" cohort user', () => {
			// This is the core bug scenario: family users seeing minimoonoir channels
			const familyUser = createTestPermissions({
				cohorts: [COHORTS.FAMILY],
				globalRole: 'member'
			});

			const minimoonoirCategory = createTestCategory({
				id: 'minimoonoir-zone',
				name: 'minimoonoir',
				access: {
					visibleToCohorts: [COHORTS.MINIMOONOIR, COHORTS.CROSS_ACCESS],
					strictIsolation: true
				}
			});

			vi.mocked(getCategory).mockReturnValue(minimoonoirCategory);

			const canAccess = canAccessCategory(familyUser, 'minimoonoir-zone');

			expect(canAccess).toBe(false);
		});

		it('should ALLOW access to "minimoonoir" category for "minimoonoir" cohort user', () => {
			const minimoonoirUser = createTestPermissions({
				cohorts: [COHORTS.MINIMOONOIR],
				globalRole: 'member'
			});

			const minimoonoirCategory = createTestCategory({
				id: 'minimoonoir-zone',
				name: 'minimoonoir',
				access: {
					visibleToCohorts: [COHORTS.MINIMOONOIR, COHORTS.CROSS_ACCESS]
				}
			});

			vi.mocked(getCategory).mockReturnValue(minimoonoirCategory);

			const canAccess = canAccessCategory(minimoonoirUser, 'minimoonoir-zone');

			expect(canAccess).toBe(true);
		});

		it('should ALLOW cross-access cohort to see all categories', () => {
			const crossAccessUser = createTestPermissions({
				cohorts: [COHORTS.CROSS_ACCESS],
				globalRole: 'member'
			});

			const restrictedCategory = createTestCategory({
				id: 'restricted-zone',
				name: 'Restricted',
				access: {
					visibleToCohorts: [COHORTS.MINIMOONOIR]
				}
			});

			vi.mocked(getCategory).mockReturnValue(restrictedCategory);

			const canAccess = canAccessCategory(crossAccessUser, 'restricted-zone');

			expect(canAccess).toBe(true);
		});

		it('should ALLOW global admin to see all categories', () => {
			const adminUser = createTestPermissions({
				cohorts: [],
				globalRole: 'admin'
			});

			const restrictedCategory = createTestCategory({
				id: 'secret-zone',
				name: 'Top Secret',
				access: {
					visibleToCohorts: ['top-secret-cohort']
				}
			});

			vi.mocked(getCategory).mockReturnValue(restrictedCategory);

			const canAccess = canAccessCategory(adminUser, 'secret-zone');

			expect(canAccess).toBe(true);
		});

		it('should DENY access when user has a hidden cohort', () => {
			const familyUser = createTestPermissions({
				cohorts: [COHORTS.FAMILY],
				globalRole: 'member'
			});

			const businessCategory = createTestCategory({
				id: 'business-zone',
				name: 'Business',
				access: {
					hiddenFromCohorts: [COHORTS.FAMILY]
				}
			});

			vi.mocked(getCategory).mockReturnValue(businessCategory);

			const canAccess = canAccessCategory(familyUser, 'business-zone');

			expect(canAccess).toBe(false);
		});

		it('should ALLOW access when no access restrictions are defined', () => {
			const regularUser = createTestPermissions({
				cohorts: ['some-cohort'],
				globalRole: 'member'
			});

			const publicCategory = createTestCategory({
				id: 'public-zone',
				name: 'Public'
				// No access config = visible to all
			});

			vi.mocked(getCategory).mockReturnValue(publicCategory);

			const canAccess = canAccessCategory(regularUser, 'public-zone');

			expect(canAccess).toBe(true);
		});

		it('should return false when category does not exist', () => {
			const user = createTestPermissions({
				cohorts: [COHORTS.FAMILY],
				globalRole: 'member'
			});

			vi.mocked(getCategory).mockReturnValue(undefined);

			const canAccess = canAccessCategory(user, 'non-existent');

			expect(canAccess).toBe(false);
		});

		it('should enforce minimum role requirement', () => {
			const guestUser = createTestPermissions({
				cohorts: ['member-cohort'],
				globalRole: 'guest'
			});

			const memberOnlyCategory = createTestCategory({
				id: 'members-only',
				name: 'Members Only',
				access: {
					minimumRole: 'member'
				}
			});

			vi.mocked(getCategory).mockReturnValue(memberOnlyCategory);

			const canAccess = canAccessCategory(guestUser, 'members-only');

			expect(canAccess).toBe(false);
		});
	});

	describe('canAccessSection() - Section-Level Access Control', () => {
		it('should ALLOW access to auto-approve sections', () => {
			const guestUser = createTestPermissions({
				cohorts: [],
				globalRole: 'guest'
			});

			const publicSection = createTestSection({
				id: 'public-lobby',
				name: 'Public Lobby',
				autoApprove: true
			});

			vi.mocked(getSection).mockReturnValue(publicSection);

			const canAccess = canAccessSection(guestUser, 'public-lobby');

			expect(canAccess).toBe(true);
		});

		it('should DENY access when user lacks required cohort', () => {
			const familyUser = createTestPermissions({
				cohorts: [COHORTS.FAMILY],
				globalRole: 'member'
			});

			const businessSection = createTestSection({
				id: 'business-section',
				name: 'Business Discussion',
				autoApprove: false,
				requiredCohorts: [COHORTS.BUSINESS]
			});

			vi.mocked(getSection).mockReturnValue(businessSection);

			const canAccess = canAccessSection(familyUser, 'business-section');

			expect(canAccess).toBe(false);
		});

		it('should ALLOW access when user has required cohort', () => {
			const businessUser = createTestPermissions({
				cohorts: [COHORTS.BUSINESS],
				globalRole: 'member'
			});

			const businessSection = createTestSection({
				id: 'business-section',
				name: 'Business Discussion',
				autoApprove: false,
				requiredCohorts: [COHORTS.BUSINESS]
			});

			vi.mocked(getSection).mockReturnValue(businessSection);

			const canAccess = canAccessSection(businessUser, 'business-section');

			expect(canAccess).toBe(true);
		});

		it('should ALLOW access when user has any of the required cohorts', () => {
			const multiCohortSection = createTestSection({
				id: 'multi-cohort',
				name: 'Multi-Cohort Section',
				autoApprove: false,
				requiredCohorts: [COHORTS.FAMILY, COHORTS.BUSINESS]
			});

			vi.mocked(getSection).mockReturnValue(multiCohortSection);

			const familyUser = createTestPermissions({
				cohorts: [COHORTS.FAMILY],
				globalRole: 'member'
			});

			const businessUser = createTestPermissions({
				cohorts: [COHORTS.BUSINESS],
				globalRole: 'member'
			});

			expect(canAccessSection(familyUser, 'multi-cohort')).toBe(true);
			expect(canAccessSection(businessUser, 'multi-cohort')).toBe(true);
		});

		it('should ALLOW global admin to access any section', () => {
			const adminUser = createTestPermissions({
				cohorts: [],
				globalRole: 'admin'
			});

			const restrictedSection = createTestSection({
				id: 'restricted',
				name: 'Restricted',
				autoApprove: false,
				requiredCohorts: ['super-special-cohort']
			});

			vi.mocked(getSection).mockReturnValue(restrictedSection);

			const canAccess = canAccessSection(adminUser, 'restricted');

			expect(canAccess).toBe(true);
		});

		it('should ALLOW access when user has section-specific role', () => {
			const userWithSectionRole = createTestPermissions({
				cohorts: [],
				globalRole: 'guest',
				sectionRoles: [{ sectionId: 'private-section', role: 'member' }]
			});

			const privateSection = createTestSection({
				id: 'private-section',
				name: 'Private Section',
				autoApprove: false
			});

			vi.mocked(getSection).mockReturnValue(privateSection);

			const canAccess = canAccessSection(userWithSectionRole, 'private-section');

			expect(canAccess).toBe(true);
		});

		it('should return false when section does not exist', () => {
			const user = createTestPermissions({
				cohorts: [COHORTS.FAMILY],
				globalRole: 'member'
			});

			vi.mocked(getSection).mockReturnValue(undefined);

			const canAccess = canAccessSection(user, 'non-existent');

			expect(canAccess).toBe(false);
		});
	});

	describe('getAccessibleCategories() - Filtered Category List', () => {
		it('should filter out categories user cannot access', () => {
			const familyUser = createTestPermissions({
				cohorts: [COHORTS.FAMILY],
				globalRole: 'member'
			});

			const allCategories: CategoryConfig[] = [
				createTestCategory({
					id: 'family-zone',
					name: 'Family',
					access: { visibleToCohorts: [COHORTS.FAMILY] }
				}),
				createTestCategory({
					id: 'business-zone',
					name: 'Business',
					access: { visibleToCohorts: [COHORTS.BUSINESS] }
				}),
				createTestCategory({
					id: 'minimoonoir-zone',
					name: 'minimoonoir',
					access: { visibleToCohorts: [COHORTS.MINIMOONOIR] }
				}),
				createTestCategory({
					id: 'public-zone',
					name: 'Public'
					// No access config = visible to all
				})
			];

			vi.mocked(getCategories).mockReturnValue(allCategories);
			vi.mocked(getCategory).mockImplementation((id) =>
				allCategories.find(c => c.id === id)
			);

			const accessible = getAccessibleCategories(familyUser);

			expect(accessible).toHaveLength(2);
			expect(accessible.map(c => c.id)).toContain('family-zone');
			expect(accessible.map(c => c.id)).toContain('public-zone');
			expect(accessible.map(c => c.id)).not.toContain('business-zone');
			expect(accessible.map(c => c.id)).not.toContain('minimoonoir-zone');
		});
	});

	describe('hasCrossZoneAccess()', () => {
		it('should return true for admin users', () => {
			const adminUser = createTestPermissions({
				cohorts: [],
				globalRole: 'admin'
			});

			expect(hasCrossZoneAccess(adminUser)).toBe(true);
		});

		it('should return true for users with admin cohort', () => {
			const adminCohortUser = createTestPermissions({
				cohorts: [COHORTS.ADMIN],
				globalRole: 'member'
			});

			expect(hasCrossZoneAccess(adminCohortUser)).toBe(true);
		});

		it('should return true for users with cross-access cohort', () => {
			const crossAccessUser = createTestPermissions({
				cohorts: [COHORTS.CROSS_ACCESS],
				globalRole: 'member'
			});

			expect(hasCrossZoneAccess(crossAccessUser)).toBe(true);
		});

		it('should return false for regular users', () => {
			const regularUser = createTestPermissions({
				cohorts: [COHORTS.FAMILY],
				globalRole: 'member'
			});

			expect(hasCrossZoneAccess(regularUser)).toBe(false);
		});
	});

	describe('isGlobalAdmin()', () => {
		it('should return true for admin global role', () => {
			const adminUser = createTestPermissions({
				cohorts: [],
				globalRole: 'admin'
			});

			expect(isGlobalAdmin(adminUser)).toBe(true);
		});

		it('should return true for users with admin cohort', () => {
			const adminCohortUser = createTestPermissions({
				cohorts: [COHORTS.ADMIN],
				globalRole: 'member'
			});

			expect(isGlobalAdmin(adminCohortUser)).toBe(true);
		});

		it('should return false for regular members', () => {
			const regularUser = createTestPermissions({
				cohorts: [COHORTS.FAMILY],
				globalRole: 'member'
			});

			expect(isGlobalAdmin(regularUser)).toBe(false);
		});
	});

	describe('Permission Utilities', () => {
		describe('createDefaultPermissions()', () => {
			it('should create guest permissions with empty cohorts', () => {
				const perms = createDefaultPermissions('pubkey-123');

				expect(perms.pubkey).toBe('pubkey-123');
				expect(perms.cohorts).toEqual([]);
				expect(perms.globalRole).toBe('guest');
				expect(perms.sectionRoles).toEqual([]);
			});
		});

		describe('createAdminPermissions()', () => {
			it('should create admin permissions with admin cohort', () => {
				const perms = createAdminPermissions('admin-pubkey');

				expect(perms.pubkey).toBe('admin-pubkey');
				expect(perms.cohorts).toContain('admin');
				expect(perms.globalRole).toBe('admin');
			});
		});

		describe('addCohort()', () => {
			it('should add cohort to user permissions', () => {
				const user = createTestPermissions({
					cohorts: [COHORTS.FAMILY],
					globalRole: 'member'
				});

				const updated = addCohort(user, COHORTS.BUSINESS);

				expect(updated.cohorts).toContain(COHORTS.FAMILY);
				expect(updated.cohorts).toContain(COHORTS.BUSINESS);
			});

			it('should not duplicate existing cohort', () => {
				const user = createTestPermissions({
					cohorts: [COHORTS.FAMILY],
					globalRole: 'member'
				});

				const updated = addCohort(user, COHORTS.FAMILY);

				expect(updated.cohorts).toHaveLength(1);
				expect(updated).toBe(user); // Returns same object when no change
			});
		});

		describe('removeCohort()', () => {
			it('should remove cohort from user permissions', () => {
				const user = createTestPermissions({
					cohorts: [COHORTS.FAMILY, COHORTS.BUSINESS],
					globalRole: 'member'
				});

				const updated = removeCohort(user, COHORTS.BUSINESS);

				expect(updated.cohorts).toContain(COHORTS.FAMILY);
				expect(updated.cohorts).not.toContain(COHORTS.BUSINESS);
			});
		});

		describe('addSectionRole()', () => {
			it('should add section role to user', () => {
				const user = createTestPermissions({
					cohorts: [COHORTS.FAMILY],
					globalRole: 'member'
				});

				const updated = addSectionRole(user, 'new-section', 'moderator', 'admin-pubkey');

				expect(updated.sectionRoles).toHaveLength(1);
				expect(updated.sectionRoles[0].sectionId).toBe('new-section');
				expect(updated.sectionRoles[0].role).toBe('moderator');
			});

			it('should replace existing section role', () => {
				const user = createTestPermissions({
					cohorts: [COHORTS.FAMILY],
					globalRole: 'member',
					sectionRoles: [{ sectionId: 'section-1', role: 'member' }]
				});

				const updated = addSectionRole(user, 'section-1', 'moderator');

				expect(updated.sectionRoles).toHaveLength(1);
				expect(updated.sectionRoles[0].role).toBe('moderator');
			});
		});

		describe('removeSectionRole()', () => {
			it('should remove section role from user', () => {
				const user = createTestPermissions({
					cohorts: [COHORTS.FAMILY],
					globalRole: 'member',
					sectionRoles: [
						{ sectionId: 'section-1', role: 'member' },
						{ sectionId: 'section-2', role: 'moderator' }
					]
				});

				const updated = removeSectionRole(user, 'section-1');

				expect(updated.sectionRoles).toHaveLength(1);
				expect(updated.sectionRoles[0].sectionId).toBe('section-2');
			});
		});
	});

	describe('getEffectiveRole()', () => {
		it('should return admin for global admin', () => {
			const adminUser = createTestPermissions({
				cohorts: [],
				globalRole: 'admin'
			});

			vi.mocked(getSection).mockReturnValue(createTestSection({
				id: 'any-section',
				name: 'Any Section'
			}));

			const role = getEffectiveRole(adminUser, 'any-section');

			expect(role).toBe('admin');
		});

		it('should return section-specific role when higher than global', () => {
			const user = createTestPermissions({
				cohorts: [],
				globalRole: 'member',
				sectionRoles: [{ sectionId: 'moderated-section', role: 'moderator' }]
			});

			vi.mocked(getSection).mockReturnValue(createTestSection({
				id: 'moderated-section',
				name: 'Moderated Section'
			}));

			const role = getEffectiveRole(user, 'moderated-section');

			expect(role).toBe('moderator');
		});

		it('should return global role when higher than section role', () => {
			const user = createTestPermissions({
				cohorts: [],
				globalRole: 'moderator',
				sectionRoles: [{ sectionId: 'section-1', role: 'member' }]
			});

			vi.mocked(getSection).mockReturnValue(createTestSection({
				id: 'section-1',
				name: 'Section 1'
			}));

			const role = getEffectiveRole(user, 'section-1');

			expect(role).toBe('moderator');
		});

		it('should return guest for auto-approve sections without specific role', () => {
			const guestUser = createTestPermissions({
				cohorts: [],
				globalRole: 'guest'
			});

			vi.mocked(getSection).mockReturnValue(createTestSection({
				id: 'public-section',
				name: 'Public Section',
				autoApprove: true
			}));

			const role = getEffectiveRole(guestUser, 'public-section');

			expect(role).toBe('guest');
		});
	});
});

describe('Direct URL Navigation Access Control', () => {
	// These tests document expected behavior for route protection
	// The actual route protection should be implemented in SvelteKit load functions

	describe('Channel Route Protection', () => {
		it('should document expected 403 behavior for restricted channel access', () => {
			// When a user navigates directly to /chat/{restricted-channel-id}
			// the load function should:
			// 1. Fetch the channel's cohort requirements
			// 2. Check user's cohorts against channel requirements
			// 3. Return 403 if user lacks required cohorts

			const familyUserCohorts = [COHORTS.FAMILY];
			const channelRequiredCohorts = [COHORTS.MINIMOONOIR, COHORTS.CROSS_ACCESS];

			const hasAccess = channelRequiredCohorts.some(cohort =>
				familyUserCohorts.includes(cohort)
			);

			expect(hasAccess).toBe(false);
			// Expected: Load function should throw error(403, 'Access denied')
		});

		it('should document expected access for authorized users', () => {
			const minimoonoirUserCohorts = [COHORTS.MINIMOONOIR];
			const channelRequiredCohorts = [COHORTS.MINIMOONOIR, COHORTS.CROSS_ACCESS];

			const hasAccess = channelRequiredCohorts.some(cohort =>
				minimoonoirUserCohorts.includes(cohort)
			);

			expect(hasAccess).toBe(true);
			// Expected: Load function should allow access and return channel data
		});
	});

	describe('Message Posting Access Control', () => {
		it('should document expected validation for message sending', () => {
			// Before sendChannelMessage() is called, the calling code should:
			// 1. Fetch the channel's access type (open vs gated)
			// 2. For gated channels, verify user's cohorts match channel cohorts
			// 3. Reject the message if validation fails

			interface AccessCheck {
				channelAccessType: 'open' | 'gated';
				channelCohorts: string[];
				userCohorts: string[];
			}

			function canPostToChannel(check: AccessCheck): boolean {
				// Open channels allow anyone to post
				if (check.channelAccessType === 'open') {
					return true;
				}

				// Gated channels require cohort match
				return check.channelCohorts.some(cohort =>
					check.userCohorts.includes(cohort)
				);
			}

			// Scenario 1: Family user posting to minimoonoir gated channel
			expect(canPostToChannel({
				channelAccessType: 'gated',
				channelCohorts: [COHORTS.MINIMOONOIR],
				userCohorts: [COHORTS.FAMILY]
			})).toBe(false);

			// Scenario 2: minimoonoir user posting to minimoonoir gated channel
			expect(canPostToChannel({
				channelAccessType: 'gated',
				channelCohorts: [COHORTS.MINIMOONOIR],
				userCohorts: [COHORTS.MINIMOONOIR]
			})).toBe(true);

			// Scenario 3: Any user posting to open channel
			expect(canPostToChannel({
				channelAccessType: 'open',
				channelCohorts: [COHORTS.MINIMOONOIR],
				userCohorts: [COHORTS.FAMILY]
			})).toBe(true);
		});
	});
});

describe('Channel Name Hiding for Unauthorized Users', () => {
	// These tests document expected behavior where channel names should be
	// hidden from users who don't have access

	it('should document expected channel name hiding behavior', () => {
		interface ChannelDisplay {
			id: string;
			name: string;
			cohorts: string[];
		}

		function getVisibleChannelName(
			channel: ChannelDisplay,
			userCohorts: string[]
		): string {
			const hasAccess = channel.cohorts.length === 0 ||
				channel.cohorts.some(c => userCohorts.includes(c));

			if (hasAccess) {
				return channel.name;
			}

			// Hide name for unauthorized users
			return '[Restricted Channel]';
		}

		const restrictedChannel: ChannelDisplay = {
			id: 'minimoonoir-channel',
			name: 'minimoonoir Private Discussion',
			cohorts: [COHORTS.MINIMOONOIR]
		};

		// Family user should see hidden name
		expect(getVisibleChannelName(restrictedChannel, [COHORTS.FAMILY]))
			.toBe('[Restricted Channel]');

		// minimoonoir user should see real name
		expect(getVisibleChannelName(restrictedChannel, [COHORTS.MINIMOONOIR]))
			.toBe('minimoonoir Private Discussion');

		// Public channels (no cohorts) visible to all
		const publicChannel: ChannelDisplay = {
			id: 'public-channel',
			name: 'Public Discussion',
			cohorts: []
		};

		expect(getVisibleChannelName(publicChannel, [COHORTS.FAMILY]))
			.toBe('Public Discussion');
	});
});
