/**
 * Setup Store
 * Manages first-run configuration flow and config uploads
 */

import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import type { BBSConfig, SectionConfig, CategoryConfig } from '$lib/config/types';

const SETUP_KEY = 'nostr_bbs_setup_complete';
const CONFIG_KEY = 'nostr_bbs_custom_config';
const DEPLOYMENT_KEY = 'nostr_bbs_deployment_config';

export type SetupStep =
	| 'welcome'
	| 'upload-config'
	| 'app-settings'
	| 'admin-setup'
	| 'sections-setup'
	| 'review'
	| 'complete';

interface SetupState {
	isComplete: boolean;
	currentStep: SetupStep;
	config: Partial<BBSConfig>;
	errors: string[];
	uploadedFile: string | null;
}

const initialState: SetupState = {
	isComplete: false,
	currentStep: 'welcome',
	config: {},
	errors: [],
	uploadedFile: null
};

function loadSetupState(): SetupState {
	if (!browser) return initialState;

	const isComplete = localStorage.getItem(SETUP_KEY) === 'true';
	const savedConfig = localStorage.getItem(CONFIG_KEY);

	let config: Partial<BBSConfig> = {};
	if (savedConfig) {
		try {
			config = JSON.parse(savedConfig);
		} catch {
			// Invalid saved config
		}
	}

	return {
		...initialState,
		isComplete,
		config,
		currentStep: isComplete ? 'complete' : 'welcome'
	};
}

function createSetupStore() {
	const { subscribe, set, update } = writable<SetupState>(loadSetupState());

	return {
		subscribe,

		/**
		 * Check if setup has been completed
		 */
		get isSetupComplete(): boolean {
			return get({ subscribe }).isComplete;
		},

		/**
		 * Move to next setup step
		 */
		nextStep(): void {
			update((state) => {
				const steps: SetupStep[] = [
					'welcome',
					'upload-config',
					'app-settings',
					'admin-setup',
					'sections-setup',
					'review',
					'complete'
				];
				const currentIndex = steps.indexOf(state.currentStep);
				const nextIndex = Math.min(currentIndex + 1, steps.length - 1);
				return { ...state, currentStep: steps[nextIndex] };
			});
		},

		/**
		 * Move to previous setup step
		 */
		prevStep(): void {
			update((state) => {
				const steps: SetupStep[] = [
					'welcome',
					'upload-config',
					'app-settings',
					'admin-setup',
					'sections-setup',
					'review',
					'complete'
				];
				const currentIndex = steps.indexOf(state.currentStep);
				const prevIndex = Math.max(currentIndex - 1, 0);
				return { ...state, currentStep: steps[prevIndex] };
			});
		},

		/**
		 * Go to specific step
		 */
		goToStep(step: SetupStep): void {
			update((state) => ({ ...state, currentStep: step }));
		},

		/**
		 * Parse and validate uploaded YAML config
		 */
		async uploadConfig(yamlContent: string): Promise<{ success: boolean; errors: string[] }> {
			const errors: string[] = [];

			try {
				const parsed = parseYaml(yamlContent) as BBSConfig;

				// Validate required fields
				if (!parsed.app?.name) {
					errors.push('Missing app.name');
				}
				// Check for categories (new structure) or sections (legacy)
				const allSections = parsed.categories?.flatMap((c) => c.sections || []) || [];
				if (!allSections.length) {
					errors.push('No sections defined in categories');
				}
				if (!parsed.roles?.length) {
					errors.push('No roles defined');
				}

				// Validate section references
				if (parsed.roles && allSections.length) {
					const roleIds = new Set(parsed.roles.map((r) => r.id));
					for (const section of allSections) {
						if (!roleIds.has(section.access.defaultRole)) {
							errors.push(
								`Section "${section.id}" references unknown role: ${section.access.defaultRole}`
							);
						}
					}
				}

				if (errors.length === 0) {
					update((state) => ({
						...state,
						config: parsed,
						uploadedFile: yamlContent,
						errors: []
					}));
					return { success: true, errors: [] };
				}

				update((state) => ({ ...state, errors }));
				return { success: false, errors };
			} catch (error) {
				const parseError = error instanceof Error ? error.message : 'Invalid YAML format';
				errors.push(parseError);
				update((state) => ({ ...state, errors }));
				return { success: false, errors };
			}
		},

		/**
		 * Update app settings
		 */
		setAppSettings(settings: { name: string; version?: string; defaultPath?: string }): void {
			update((state) => {
				const allSections = state.config.categories?.flatMap((c) => c.sections || []) || [];
				const firstSectionId = allSections[0]?.id;
				const firstCategoryId = state.config.categories?.[0]?.id;
				const defaultPath = settings.defaultPath ||
					(firstCategoryId && firstSectionId ? `/${firstCategoryId}/${firstSectionId}` : '/');

				return {
					...state,
					config: {
						...state.config,
						app: {
							name: settings.name,
							version: settings.version || '1.0.0',
							defaultPath
						}
					}
				};
			});
		},

		/**
		 * Add or update a section in a category
		 */
		addSection(section: SectionConfig, categoryId?: string): void {
			update((state) => {
				const categories = [...(state.config.categories || [])];
				// Use first category if none specified
				const targetCategoryId = categoryId || categories[0]?.id;

				if (!targetCategoryId) {
					// Create default category if none exists
					categories.push({
						id: 'default',
						name: 'Default',
						description: 'Default category',
						icon: '📁',
						order: 0,
						sections: [section]
					});
				} else {
					const categoryIndex = categories.findIndex((c) => c.id === targetCategoryId);
					if (categoryIndex >= 0) {
						const sections = [...(categories[categoryIndex].sections || [])];
						const existingIndex = sections.findIndex((s) => s.id === section.id);
						if (existingIndex >= 0) {
							sections[existingIndex] = section;
						} else {
							sections.push(section);
						}
						categories[categoryIndex] = { ...categories[categoryIndex], sections };
					}
				}

				return {
					...state,
					config: { ...state.config, categories }
				};
			});
		},

		/**
		 * Remove a section from all categories
		 */
		removeSection(sectionId: string): void {
			update((state) => ({
				...state,
				config: {
					...state.config,
					categories: (state.config.categories || []).map((cat) => ({
						...cat,
						sections: (cat.sections || []).filter((s) => s.id !== sectionId)
					}))
				}
			}));
		},

		/**
		 * Add or update a role
		 */
		addRole(role: BBSConfig['roles'][0]): void {
			update((state) => {
				const roles = state.config.roles || [];
				const existingIndex = roles.findIndex((r) => r.id === role.id);

				if (existingIndex >= 0) {
					roles[existingIndex] = role;
				} else {
					roles.push(role);
				}

				return {
					...state,
					config: { ...state.config, roles }
				};
			});
		},

		/**
		 * Add or update a cohort
		 */
		addCohort(cohort: BBSConfig['cohorts'][0]): void {
			update((state) => {
				const cohorts = state.config.cohorts || [];
				const existingIndex = cohorts.findIndex((c) => c.id === cohort.id);

				if (existingIndex >= 0) {
					cohorts[existingIndex] = cohort;
				} else {
					cohorts.push(cohort);
				}

				return {
					...state,
					config: { ...state.config, cohorts }
				};
			});
		},

		/**
		 * Complete setup and save configuration
		 */
		completeSetup(): void {
			const state = get({ subscribe });

			if (browser) {
				localStorage.setItem(SETUP_KEY, 'true');
				localStorage.setItem(CONFIG_KEY, JSON.stringify(state.config));

				// Save deployment config separately for runtime access
				if (state.config.deployment || state.config.superuser) {
					const deploymentConfig = {
						...state.config.deployment,
						adminPubkey: state.config.superuser?.pubkey,
						relayUrl: state.config.deployment?.relayUrl || state.config.superuser?.relayUrl
					};
					localStorage.setItem(DEPLOYMENT_KEY, JSON.stringify(deploymentConfig));
				}
			}

			update((s) => ({
				...s,
				isComplete: true,
				currentStep: 'complete'
			}));
		},

		/**
		 * Export current config as YAML
		 */
		exportConfigYaml(): string {
			const state = get({ subscribe });
			return stringifyYaml(state.config, { indent: 2 });
		},

		/**
		 * Reset setup (for re-configuration)
		 */
		resetSetup(): void {
			if (browser) {
				localStorage.removeItem(SETUP_KEY);
				localStorage.removeItem(CONFIG_KEY);
				localStorage.removeItem(DEPLOYMENT_KEY);
			}
			set(initialState);
		},

		/**
		 * Skip setup (use defaults)
		 */
		skipSetup(): void {
			if (browser) {
				localStorage.setItem(SETUP_KEY, 'true');
			}
			update((state) => ({
				...state,
				isComplete: true,
				currentStep: 'complete'
			}));
		}
	};
}

export const setupStore = createSetupStore();

/**
 * Derived: Is setup required?
 */
export const needsSetup = derived(setupStore, ($store) => !$store.isComplete);

/**
 * Derived: Current setup step
 */
export const currentSetupStep = derived(setupStore, ($store) => $store.currentStep);

/**
 * Derived: Setup errors
 */
export const setupErrors = derived(setupStore, ($store) => $store.errors);

/**
 * Derived: Working config
 */
export const workingConfig = derived(setupStore, ($store) => $store.config);

/**
 * Get deployment configuration from localStorage (set during setup)
 */
export function getDeploymentConfig(): {
	relayUrl?: string;
	embeddingApiUrl?: string;
	gcsEmbeddingsUrl?: string;
	frontendUrl?: string;
	adminPubkey?: string;
} | null {
	if (!browser) return null;

	try {
		const stored = localStorage.getItem(DEPLOYMENT_KEY);
		if (stored) {
			return JSON.parse(stored);
		}
	} catch {
		// Invalid stored config
	}
	return null;
}
