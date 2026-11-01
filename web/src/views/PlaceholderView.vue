<script setup lang="ts">
import { useRoute } from 'vue-router'
import ContentHeader from '../components/shared/ContentHeader.vue'

const route = useRoute()
</script>

<template>
	<div class="p-4">
		<ContentHeader :title="String(route.meta.title)" />
		<b-card>
			<p class="mb-0">Not built yet. Design sketch to build from: <code>docs/ux/{{ route.meta.sketch }}</code></p>
		</b-card>
	</div>
</template>
