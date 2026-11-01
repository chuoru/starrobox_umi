import type { App } from 'vue'
import BAlert from './BAlert.vue'
import BButton from './BButton.vue'
import BCard from './BCard.vue'
import BFormInput from './BFormInput.vue'
import BFormSelect from './BFormSelect.vue'
import BIcon from './BIcon.vue'
import BSpinner from './BSpinner.vue'

/** Registers the Bootstrap wrapper components globally, as FCC_DASHBOARD/client does. Types are in env.d.ts. */
export default {
	install(app: App) {
		app.component('BAlert', BAlert)
		app.component('BButton', BButton)
		app.component('BCard', BCard)
		app.component('BFormInput', BFormInput)
		app.component('BFormSelect', BFormSelect)
		app.component('BIcon', BIcon)
		app.component('BSpinner', BSpinner)
	},
}
