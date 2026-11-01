<script setup lang="ts">
/** A bootstrap-icons glyph: <b-icon icon="grid" /> renders the `bi-grid` icon. */
defineProps<{ icon: string; variant?: string }>()
</script>

<template>
	<i class="bi" :class="[`bi-${icon}`, { [`text-${variant}`]: !!variant }]" aria-hidden="true" />
</template>
