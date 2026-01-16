/**
 * Configuration Types
 * Type definitions for YAML-based 3-tier BBS configuration
 * Hierarchy: Category → Section → Forum (NIP-28 Channel)
 */

export type RoleId = 'guest' | 'member' | 'moderator' | 'section-admin' | 'admin';
export type CohortId = string;
export type CategoryId = string;
export type SectionId = string;
export type ForumId = string;
export type CalendarAccessLevel = 'full' | 'availability' | 'cohort' | 'none';
export type ChannelVisibility = 'public' | 'cohort' | 'invite';
export type ChannelAccessType = 'open' | 'gated';

export interface RoleCapability {
	id: string;
	description?: string;
}

export interface RoleConfig {
	id: RoleId;
	name: string;
	level: number;
	description: string;
	capabilities?: string[];
}

export interface CohortConfig {
	id: CohortId;
	name: string;
	description: string;
}

export interface AccessConfig {
	requiresApproval: boolean;
	defaultRole: RoleId;
	autoApprove?: boolean;
	requiredCohorts?: CohortId[];
}

export interface CalendarConfig {
	access: CalendarAccessLevel;
	canCreate: boolean;
	cohortRestricted?: boolean;
	/** Cross-zone visibility: show availability blocks from other zones */
	showBlocksFrom?: CategoryId[];
	/** Block display configuration */
	blockDisplay?: CalendarBlockDisplayConfig;
}

/**
 * Cross-zone calendar block visibility configuration
 */
export interface CalendarBlockDisplayConfig {
	/** Show which zone caused the block (e.g., "Family" or "DreamLab") */
	showSourceZone?: boolean;
	/** Show block reason/title (false = just colour) */
	showReason?: boolean;
	/** Custom colours for blocks from specific zones */
	zoneColours?: Record<CategoryId, string>;
}

/**
 * Block type for cross-zone calendar availability
 */
export type CalendarBlockType = 'hard' | 'soft' | 'tentative';

/**
 * Cross-zone availability block (aggregated from other zones)
 */
export interface AvailabilityBlock {
	id: string;
	start: number;
	end: number;
	/** Source zone that created this block */
	sourceZone: CategoryId;
	/** Hard = unavailable, Soft = reduced capacity, Tentative = might conflict */
	blockType: CalendarBlockType;
	/** Display colour for this block */
	displayColour: string;
	/** Visible label (e.g., "Family" or "DreamLab") - only if showSourceZone */
	label?: string;
	/** Reason/title - only visible to users with appropriate access */
	reason?: string;
}

/**
 * Default block colours by zone type
 */
export const BLOCK_COLOURS = {
	/** Family bookings - hard block, house less available */
	family: '#991b1b',      // dark red
	/** DreamLab bookings - soft block, reduced capacity */
	business: '#c2410c',    // dark orange
	/** Default for other zones */
	default: '#6b7280'      // grey
} as const;

export interface UIConfig {
	color: string;
}

/**
 * Branding configuration for per-category/section visual identity
 */
export interface BrandingConfig {
	/** Primary theme colour */
	primaryColor?: string;
	/** Secondary/accent colour */
	accentColor?: string;
	/** Logo URL (overrides global logo) */
	logoUrl?: string;
	/** Hero/header image URL */
	heroImageUrl?: string;
	/** Favicon URL (optional per-zone favicon) */
	faviconUrl?: string;
	/** Custom display name (overrides category/section name in UI) */
	displayName?: string;
	/** Tagline or subtitle */
	tagline?: string;
}

/**
 * Category-level access configuration for zone isolation
 */
export interface CategoryAccessConfig {
	/** Cohorts that can see this category (empty = visible to all) */
	visibleToCohorts?: CohortId[];
	/** Cohorts explicitly excluded from seeing this category */
	hiddenFromCohorts?: CohortId[];
	/** Minimum role required to see this category */
	minimumRole?: RoleId;
	/** If true, category is completely invisible to non-matching users */
	strictIsolation?: boolean;
}

/**
 * Tier configuration for naming flexibility
 */
export interface TierConfig {
	level: number;
	name: string;
	plural: string;
}

/**
 * Forum (Tier 3) - Maps to NIP-28 Channel
 * Forums are dynamically populated from Nostr events
 */
export interface ForumConfig {
	id: ForumId;
	name: string;
	description: string;
	icon?: string;
	order: number;
	pinned?: boolean;
	locked?: boolean;
}

/**
 * Section (Tier 2) - Container for Forums
 */
export interface SectionConfig {
	id: SectionId;
	name: string;
	description: string;
	icon: string;
	order: number;
	access: AccessConfig;
	calendar: CalendarConfig;
	ui: UIConfig;
	allowForumCreation?: boolean;
	showStats?: boolean;
	/** Per-section branding override (inherits from category if not set) */
	branding?: BrandingConfig;
}

/**
 * Category (Tier 1) - Top-level container with zone isolation support
 */
export interface CategoryConfig {
	id: CategoryId;
	name: string;
	description: string;
	icon: string;
	order: number;
	sections: SectionConfig[];
	ui?: UIConfig;
	/** Category-level access control for zone isolation */
	access?: CategoryAccessConfig;
	/** Per-category branding (hero images, logos, theming) */
	branding?: BrandingConfig;
}

export interface CalendarAccessLevelConfig {
	id: CalendarAccessLevel;
	name: string;
	description: string;
	canView: boolean;
	canViewDetails: boolean | 'cohort-match';
}

export interface ChannelVisibilityConfig {
	id: ChannelVisibility;
	name: string;
	description: string;
}

export interface ChannelAccessTypeConfig {
	id: ChannelAccessType;
	name: string;
	description: string;
}

export interface AppConfig {
	name: string;
	version: string;
	defaultPath?: string; // e.g., '/fairfield/fairfield-guests' (for category-based routing)
	defaultSection?: string; // e.g., 'fairfield-guests' (for flat section routing)
	tiers?: TierConfig[];
}

export interface SuperuserConfig {
	pubkey: string;
	name: string;
	relayUrl?: string;
}

export interface DeploymentConfig {
	relayUrl?: string;
	embeddingApiUrl?: string;
	gcsEmbeddingsUrl?: string;
	frontendUrl?: string;
}

export interface BBSConfig {
	app: AppConfig;
	superuser?: SuperuserConfig;
	deployment?: DeploymentConfig;
	roles: RoleConfig[];
	cohorts: CohortConfig[];
	categories: CategoryConfig[];
	/** Flat sections array (alternative to categories[].sections for simpler setups) */
	sections?: SectionConfig[];
	calendarAccessLevels?: CalendarAccessLevelConfig[];
	channelVisibility?: ChannelVisibilityConfig[];
}

// Alias for backward compatibility during migration
export type SectionsConfig = BBSConfig;

/**
 * Breadcrumb navigation item
 */
export interface BreadcrumbItem {
	label: string;
	path: string;
	icon?: string;
}

/**
 * User's role assignment for a section
 */
export interface UserSectionRole {
	sectionId: SectionId;
	role: RoleId;
	assignedAt: number;
	assignedBy?: string;
}

/**
 * User's role assignment for a category (zone)
 */
export interface UserCategoryRole {
	categoryId: CategoryId;
	role: RoleId;
	assignedAt: number;
	assignedBy?: string;
}

/**
 * User's complete permission state
 */
export interface UserPermissions {
	pubkey: string;
	cohorts: CohortId[];
	globalRole: RoleId;
	sectionRoles: UserSectionRole[];
	/** Category-level role assignments for zone access */
	categoryRoles?: UserCategoryRole[];
	/** Primary zone for cross-access users (where they can create events) */
	primaryZone?: CategoryId;
}
