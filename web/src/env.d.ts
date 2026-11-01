/// <reference types="vite/client" />
declare module '*.vue' {
	import type { DefineComponent } from 'vue'
	const component: DefineComponent<object, object, unknown>
	export default component
}

declare module 'vue' {
	interface GlobalComponents {
		BAlert: typeof import('./components/bootstrap/BAlert.vue').default
		BButton: typeof import('./components/bootstrap/BButton.vue').default
		BCard: typeof import('./components/bootstrap/BCard.vue').default
		BFormInput: typeof import('./components/bootstrap/BFormInput.vue').default
		BFormSelect: typeof import('./components/bootstrap/BFormSelect.vue').default
		BIcon: typeof import('./components/bootstrap/BIcon.vue').default
		BSpinner: typeof import('./components/bootstrap/BSpinner.vue').default
	}
}

export {}
