<script setup lang="ts">
defineProps<{ noBody?: boolean }>()
</script>

<template>
	<div class="card">
		<slot v-if="noBody" />
		<div v-else class="card-body"><slot /></div>
	</div>
</template>
