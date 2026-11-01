<script setup lang="ts">
defineProps<{ title?: string }>()
</script>

<template>
	<div class="d-flex align-items-center mb-3">
		<div class="me-auto d-flex flex-column">
			<h4 class="mb-0">{{ title }}</h4>
			<slot v-if="$slots.breadcrumbs" name="breadcrumbs" />
		</div>
		<slot />
	</div>
</template>
