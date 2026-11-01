<script setup lang="ts">
import type { Status } from '../../api/client'

defineProps<{ count: number; busy: boolean; errors: string[] }>()
const emit = defineEmits<{ apply: [status: Status]; clear: []; dismissErrors: [] }>()
</script>

<template>
	<div>
		<Transition name="slide">
			<div v-if="count" class="bulk border-bottom" role="toolbar" aria-label="Bulk actions">
				<b aria-live="polite">{{ count }} selected</b>
				<b-button size="sm" variant="primary" :disabled="busy" @click="emit('apply', 'curated')">Curate</b-button>
				<b-button size="sm" variant="secondary" :disabled="busy" @click="emit('apply', 'excluded')">Exclude</b-button>
				<b-button size="sm" variant="secondary" :disabled="busy" title="Sets status back to SLAM ok" @click="emit('apply', 'slam_ok')">Reset</b-button>
				<b-spinner v-if="busy" small label="Saving" />
				<b-button size="sm" variant="none" class="ms-auto" @click="emit('clear')">Clear selection <kbd>Esc</kbd></b-button>
			</div>
		</Transition>
		<Transition name="slide">
			<b-alert v-if="errors.length" variant="danger" class="err">
				<span>
					Could not update {{ errors.length }} episode{{ errors.length > 1 ? 's' : '' }}; reverted.
					<span class="small ms-1">{{ errors.slice(0, 3).join(' · ') }}{{ errors.length > 3 ? ' …' : '' }}</span>
				</span>
				<b-button size="sm" variant="none" @click="emit('dismissErrors')">Dismiss</b-button>
			</b-alert>
		</Transition>
	</div>
</template>

<style scoped>
.bulk { display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem 1rem; background: rgba(65, 180, 50, 0.1); }
.err { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; margin: 0; border-radius: 0; border-width: 0 0 1px; padding: 0.5rem 1rem; }
kbd { font-size: 0.7rem; padding: 0 4px; margin-left: 4px; }
.slide-enter-active, .slide-leave-active { transition: opacity 0.16s ease, transform 0.16s ease; }
.slide-enter-from, .slide-leave-to { opacity: 0; transform: translateY(-6px); }
@media (prefers-reduced-motion: reduce) { .slide-enter-active, .slide-leave-active { transition: none; } }
</style>
