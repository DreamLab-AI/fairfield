/**
 * DESIGN SYSTEM - Tailwind Configuration
 *
 * This configuration defines the core design tokens for the application.
 * All custom styles are organized in /src/app.css with clear categorization.
 *
 * @see /src/app.css for component-level design patterns
 * @type {import('tailwindcss').Config}
 */
export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme: {
		extend: {
			/**
			 * COLOR SYSTEM
			 * Extended primary color scale for granular control
			 */
			colors: {
				primary: {
					50: '#f0f9ff',
					100: '#e0f2fe',
					200: '#bae6fd',
					300: '#7dd3fc',
					400: '#38bdf8',
					500: '#0ea5e9',
					600: '#0284c7',
					700: '#0369a1',
					800: '#075985',
					900: '#0c4a6e'
				}
			},
			/**
			 * Z-INDEX SCALE
			 * Consistent layering system matching CSS variables
			 */
			zIndex: {
				'dropdown': '1000',
				'sticky': '1020',
				'fixed': '1030',
				'modal-backdrop': '1040',
				'modal': '1050',
				'popover': '1060',
				'tooltip': '1070',
				'toast': '1080',
				'overlay-max': '1090'
			},
			/**
			 * SPACING SCALE
			 * 8px grid system with additional values
			 */
			spacing: {
				'4.5': '1.125rem',  /* 18px */
				'5.5': '1.375rem',  /* 22px */
				'13': '3.25rem',    /* 52px */
				'15': '3.75rem',    /* 60px */
				'18': '4.5rem',     /* 72px */
				'22': '5.5rem',     /* 88px */
				'26': '6.5rem',     /* 104px */
				'30': '7.5rem',     /* 120px */
			},
			/**
			 * TYPOGRAPHY
			 * Custom font families with system fallbacks
			 */
			fontFamily: {
				sans: ['Inter', 'system-ui', 'sans-serif'],
				mono: ['Fira Code', 'monospace']
			},
			/**
			 * BORDER RADIUS - MD3 Shape System
			 */
			borderRadius: {
				'xs': '4px',
				'sm': '8px',
				'md': '12px',
				'lg': '16px',
				'xl': '24px',
				'2xl': '28px'
			},
			/**
			 * BOX SHADOW - MD3 Elevation System
			 */
			boxShadow: {
				'elevation-1': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
				'elevation-2': '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
				'elevation-3': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
				'elevation-4': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
				'elevation-5': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
				'inner-glow': 'inset 0 2px 4px 0 rgba(255, 255, 255, 0.05)'
			},
			/**
			 * TRANSITION TIMING FUNCTIONS - MD3 Motion
			 */
			transitionTimingFunction: {
				'standard': 'cubic-bezier(0.2, 0, 0, 1)',
				'standard-decelerate': 'cubic-bezier(0, 0, 0, 1)',
				'standard-accelerate': 'cubic-bezier(0.3, 0, 1, 1)',
				'emphasized': 'cubic-bezier(0.2, 0, 0, 1)',
				'emphasized-decelerate': 'cubic-bezier(0.05, 0.7, 0.1, 1)',
				'emphasized-accelerate': 'cubic-bezier(0.3, 0, 0.8, 0.15)'
			},
			/**
			 * TRANSITION DURATION - MD3 Motion
			 */
			transitionDuration: {
				'50': '50ms',
				'100': '100ms',
				'150': '150ms',
				'200': '200ms',
				'250': '250ms',
				'300': '300ms',
				'350': '350ms',
				'400': '400ms',
				'450': '450ms',
				'500': '500ms',
				'600': '600ms',
				'700': '700ms',
				'800': '800ms'
			},
			/**
			 * ANIMATIONS
			 * Custom keyframe animations for transitions
			 * Usage: class="animate-fade-in" or class="animate-slide-up"
			 */
			animation: {
				'fade-in': 'fadeIn 0.2s ease-in-out',
				'fade-out': 'fadeOut 0.2s ease-in-out',
				'slide-up': 'slideUp 0.3s ease-out',
				'slide-down': 'slideDown 0.3s ease-out',
				'slide-in-right': 'slideInRight 0.3s ease-out',
				'slide-out-right': 'slideOutRight 0.3s ease-out',
				'scale-in': 'scaleIn 0.2s ease-out',
				'scale-out': 'scaleOut 0.15s ease-in',
				'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
				'bounce-in': 'bounceIn 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
				'shake': 'shake 0.5s ease-in-out',
				'spin-slow': 'spin 3s linear infinite',
				'wiggle': 'wiggle 1s ease-in-out infinite'
			},
			keyframes: {
				fadeIn: {
					'0%': { opacity: '0' },
					'100%': { opacity: '1' }
				},
				fadeOut: {
					'0%': { opacity: '1' },
					'100%': { opacity: '0' }
				},
				slideUp: {
					'0%': { transform: 'translateY(10px)', opacity: '0' },
					'100%': { transform: 'translateY(0)', opacity: '1' }
				},
				slideDown: {
					'0%': { transform: 'translateY(-10px)', opacity: '0' },
					'100%': { transform: 'translateY(0)', opacity: '1' }
				},
				slideInRight: {
					'0%': { transform: 'translateX(100%)', opacity: '0' },
					'100%': { transform: 'translateX(0)', opacity: '1' }
				},
				slideOutRight: {
					'0%': { transform: 'translateX(0)', opacity: '1' },
					'100%': { transform: 'translateX(100%)', opacity: '0' }
				},
				scaleIn: {
					'0%': { transform: 'scale(0.9)', opacity: '0' },
					'100%': { transform: 'scale(1)', opacity: '1' }
				},
				scaleOut: {
					'0%': { transform: 'scale(1)', opacity: '1' },
					'100%': { transform: 'scale(0.9)', opacity: '0' }
				},
				bounceIn: {
					'0%': { transform: 'scale(0)', opacity: '0' },
					'50%': { transform: 'scale(1.1)' },
					'100%': { transform: 'scale(1)', opacity: '1' }
				},
				shake: {
					'0%, 100%': { transform: 'translateX(0)' },
					'25%': { transform: 'translateX(-5px)' },
					'75%': { transform: 'translateX(5px)' }
				},
				wiggle: {
					'0%, 100%': { transform: 'rotate(-3deg)' },
					'50%': { transform: 'rotate(3deg)' }
				}
			}
		}
	},
	plugins: [require('daisyui')],
	/**
	 * DAISYUI THEME CONFIGURATION
	 *
	 * Button Variants:
	 * - btn-primary: Main actions (save, submit, confirm)
	 * - btn-secondary: Alternative actions
	 * - btn-ghost: Subtle actions (close, cancel)
	 * - btn-error: Destructive actions (delete, remove)
	 * - btn-warning: Warning actions (reveal private key)
	 * - btn-success: Positive actions (approve, accept)
	 * - btn-info: Informational actions
	 *
	 * Button Sizes:
	 * - btn-xs: 1.75rem min-height (compact, inline actions)
	 * - btn-sm: 2rem min-height (default for most UI)
	 * - btn (default): 2.75rem min-height (accessible touch target)
	 * - btn-lg: 3.5rem min-height (prominent CTAs)
	 *
	 * Modal Patterns:
	 * - Always include closeOnEscape and closeOnBackdrop options
	 * - Use X button in top-right for close
	 * - Support keyboard navigation (Tab, Escape)
	 * - Restore focus to trigger element on close
	 */
	daisyui: {
		themes: [
			{
				light: {
					primary: '#0284c7',
					'primary-content': '#ffffff',
					secondary: '#7c3aed',
					accent: '#059669',
					neutral: '#1e293b',
					'neutral-content': '#ffffff',
					'base-100': '#ffffff',
					'base-200': '#f8fafc',
					'base-300': '#e2e8f0',
					'base-content': '#1e293b',
					info: '#0891b2',
					success: '#16a34a',
					warning: '#d97706',
					error: '#dc2626'
				},
				dark: {
					primary: '#38bdf8',
					'primary-content': '#0f172a',
					secondary: '#a78bfa',
					accent: '#34d399',
					neutral: '#64748b',
					'neutral-content': '#f1f5f9',
					'base-100': '#0f172a',
					'base-200': '#1e293b',
					'base-300': '#334155',
					'base-content': '#f1f5f9',
					info: '#22d3ee',
					success: '#4ade80',
					warning: '#fbbf24',
					error: '#f87171'
				}
			}
		],
		darkTheme: 'dark',
		base: true,
		styled: true,
		utils: true,
		logs: false
	}
};
