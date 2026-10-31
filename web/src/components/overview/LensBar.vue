<script setup lang="ts">
import { computed } from 'vue'
import { SORTS, clearFilters, hasFilters, update, type Lens, type SortKey } from './lens'

const lens = defineModel<Lens>('lens', { required: true })
defineProps<{ disabled: boolean }>()

// Writable computeds keep real v-model behavior on the inputs, so text typed through an IME is not committed mid-word.
const q = computed({ get: () => lens.value.q, set: (v: string) => (lens.value = update(lens.value, 'q', v)) })
const sort = computed({ get: () => lens.value.sort, set: (v: SortKey) => (lens.value = update(lens.value, 'sort', v)) })
const flipDir = () => (lens.value = update(lens.value, 'dir', lens.value.dir === 'asc' ? 'desc' : 'asc'))
</script>

<template>
	<div class="tools">
		<input v-model="q" type="search" placeholder="Search id, scene, instruction" aria-label="Search episodes" :disabled="disabled" />
		<label>
			Sort
			<select v-model="sort" :disabled="disabled">
				<option v-for="(s, key) in SORTS" :key="key" :value="key">{{ s.label }}</option>
			</select>
		</label>
		<button type="button" :disabled="disabled" :aria-label="lens.dir === 'asc' ? 'Ascending' : 'Descending'" @click="flipDir">
			{{ lens.dir === 'asc' ? 'Asc' : 'Desc' }}
		</button>
		<button v-if="hasFilters(lens)" type="button" class="reset" @click="lens = clearFilters(lens)">Reset all filters</button>
		<span class="hint">Click to select, Shift-click for a range, arrows to move, O to open.</span>
	</div>
</template>

<style scoped>
.tools { display: flex; gap: 10px; align-items: center; padding: 8px 14px; border-bottom: 1px solid var(--ln); background: var(--pn); flex-wrap: wrap; }
.tools label { display: flex; align-items: center; gap: 6px; color: var(--mu); }
input[type='search'], select { padding: 5px 9px; border: 1px solid var(--ln); border-radius: 6px; background: var(--bg); color: var(--ink); font: inherit; }
input[type='search'] { width: 260px; }
input:focus-visible, select:focus-visible, button:focus-visible { outline: 2px solid var(--ac); outline-offset: 1px; }
button { padding: 5px 12px; border: 1px solid var(--ln); border-radius: 6px; background: var(--pn); color: var(--ink); cursor: pointer; font: inherit; transition: border-color 0.12s; }
button:hover:not(:disabled) { border-color: var(--ac); }
button:disabled, input:disabled, select:disabled { opacity: 0.5; cursor: default; }
.reset { color: var(--ac); }
.hint { margin-left: auto; color: var(--mu); font-size: 11px; }
</style>
