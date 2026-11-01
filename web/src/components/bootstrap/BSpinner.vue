<script setup lang="ts">
withDefaults(defineProps<{ variant?: string; label?: string; small?: boolean }>(), { variant: 'primary', label: 'Loading...' })
</script>

<template>
	<div class="spinner-border" :class="[`text-${variant}`, { 'spinner-border-sm': small }]" role="status">
		<span class="visually-hidden">{{ label }}</span>
	</div>
</template>
