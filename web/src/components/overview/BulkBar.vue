<script setup lang="ts">
import type { Status } from '../../api/client'

defineProps<{ count: number; busy: boolean; errors: string[] }>()
const emit = defineEmits<{ apply: [status: Status]; clear: []; dismissErrors: [] }>()
</script>

<template>
	<div class="wrap">
		<Transition name="slide">
			<div v-if="count" class="bulk" role="toolbar" aria-label="Bulk actions">
				<b aria-live="polite">{{ count }} selected</b>
				<button type="button" :disabled="busy" @click="emit('apply', 'curated')">Curate</button>
				<button type="button" :disabled="busy" @click="emit('apply', 'excluded')">Exclude</button>
				<button type="button" :disabled="busy" title="Sets status back to SLAM ok" @click="emit('apply', 'slam_ok')">Reset</button>
				<span v-if="busy" class="spin" aria-label="Saving" />
				<button type="button" class="ghost" @click="emit('clear')">Clear selection <kbd>Esc</kbd></button>
			</div>
		</Transition>
		<Transition name="slide">
			<div v-if="errors.length" class="err" role="alert">
				<span>
					Could not update {{ errors.length }} episode{{ errors.length > 1 ? 's' : '' }}; reverted.
					<span class="detail">{{ errors.slice(0, 3).join(' · ') }}{{ errors.length > 3 ? ' …' : '' }}</span>
				</span>
				<button type="button" class="ghost" @click="emit('dismissErrors')">Dismiss</button>
			</div>
		</Transition>
	</div>
</template>

<style scoped>
.bulk, .err { display: flex; align-items: center; gap: 10px; padding: 8px 14px; font-size: 13px; }
.bulk { background: #2a3f78; color: #fff; border-bottom: 1px solid #3b5499; }
.err { background: #4a1f1c; color: #ffd2cc; border-bottom: 1px solid #7a2f29; justify-content: space-between; }
.detail { opacity: 0.8; margin-left: 6px; font-size: 12px; }
button { padding: 4px 12px; border: 1px solid transparent; border-radius: 6px; background: #e6e9ef; color: #12151b; cursor: pointer; font: inherit; font-size: 13px; transition: background 0.12s, opacity 0.12s; }
button:hover:not(:disabled) { background: #fff; }
button:disabled { opacity: 0.5; cursor: progress; }
button:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
button.ghost { background: transparent; color: inherit; border-color: rgba(255, 255, 255, 0.35); margin-left: auto; }
button.ghost:hover { background: rgba(255, 255, 255, 0.12); }
.bulk b + button { margin-left: 4px; }
kbd { font: inherit; font-size: 10px; opacity: 0.7; border: 1px solid currentColor; border-radius: 3px; padding: 0 4px; margin-left: 4px; }
.spin { width: 14px; height: 14px; border-radius: 50%; border: 2px solid rgba(255, 255, 255, 0.3); border-top-color: #fff; animation: rot 0.7s linear infinite; }
@keyframes rot { to { transform: rotate(360deg); } }
.slide-enter-active, .slide-leave-active { transition: opacity 0.16s ease, transform 0.16s ease; }
.slide-enter-from, .slide-leave-to { opacity: 0; transform: translateY(-6px); }
@media (prefers-reduced-motion: reduce) { .slide-enter-active, .slide-leave-active { transition: none; } .spin { animation: none; } }
</style>
