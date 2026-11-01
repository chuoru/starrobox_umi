<script setup lang="ts">
import { computed } from 'vue'
import { SORTS, clearFilters, hasFilters, update, type Lens, type SortKey } from './lens'

const lens = defineModel<Lens>('lens', { required: true })
defineProps<{ disabled: boolean }>()

// Writable computeds keep real v-model behavior on the inputs, so text typed through an IME is not committed mid-word.
const q = computed({ get: () => lens.value.q, set: (v: string) => (lens.value = update(lens.value, 'q', v)) })
const sort = computed({ get: () => lens.value.sort, set: (v: SortKey) => (lens.value = update(lens.value, 'sort', v)) })
const sortOptions = Object.entries(SORTS).map(([value, s]) => ({ value, text: s.label }))
const flipDir = () => (lens.value = update(lens.value, 'dir', lens.value.dir === 'asc' ? 'desc' : 'asc'))
</script>

<template>
	<div class="tools border-bottom">
		<b-form-input v-model="q" class="search" type="search" size="sm" placeholder="Search id, scene, instruction" aria-label="Search episodes" :disabled="disabled" />
		<label class="d-flex align-items-center gap-2 text-muted small">
			Sort
			<b-form-select v-model="sort" size="sm" :options="sortOptions" :disabled="disabled" />
		</label>
		<b-button size="sm" variant="default" :disabled="disabled" :aria-label="lens.dir === 'asc' ? 'Ascending' : 'Descending'" @click="flipDir">
			{{ lens.dir === 'asc' ? 'Asc' : 'Desc' }}
		</b-button>
		<b-button v-if="hasFilters(lens)" size="sm" variant="primary" @click="lens = clearFilters(lens)">Reset all filters</b-button>
		<span class="hint text-muted small">Click to select, Shift-click for a range, arrows to move, O to open.</span>
	</div>
</template>

<style scoped>
.tools { display: flex; gap: 0.75rem; align-items: center; padding: 0.75rem 1rem; flex-wrap: wrap; }
.search { width: 260px; }
.hint { margin-left: auto; }
</style>
