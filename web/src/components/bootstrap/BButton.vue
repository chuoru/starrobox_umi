<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
	size?: string
	variant?: string
	/** A route path. When set, the button renders as a router link. */
	to?: string
}>()

const classObject = computed(() => ({
	btn: true,
	[`btn-${props.size}`]: !!props.size,
	[`btn-${props.variant}`]: !!props.variant,
}))
</script>

<template>
	<router-link v-if="to" :to="to" :class="classObject"><slot /></router-link>
	<button v-else type="button" :class="classObject"><slot /></button>
</template>

<style scoped>
.btn.btn-default,
.btn.btn-none {
	background: transparent !important;
	box-shadow: none !important;
	border-color: transparent !important;
}
.btn.btn-default:focus,
.btn.btn-none:focus {
	background-color: var(--bs-gray-200) !important;
}
.btn.btn-default {
	color: var(--umi-primary-text) !important;
}
.btn.btn-none {
	color: var(--bs-gray-700) !important;
}
</style>
