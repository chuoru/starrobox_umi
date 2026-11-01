<script setup lang="ts">
withDefaults(defineProps<{ variant?: string }>(), { variant: 'info' })
</script>

<template>
	<div role="alert" class="alert" :class="`alert-${variant}`"><slot /></div>
</template>
