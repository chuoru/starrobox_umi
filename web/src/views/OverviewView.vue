<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { api, type Episode } from '../api/client'

const episodes = ref<Episode[]>([])
const error = ref('')

onMounted(async () => {
	try {
		episodes.value = await api.episodes()
	} catch (e) {
		error.value = String(e)
	}
})
</script>

<template>
	<h1>Overview</h1>
	<p v-if="error" class="err">Could not load episodes: {{ error }}</p>
	<p v-else-if="episodes.length === 0">No episodes yet. Import a recording to create one.</p>
	<ul v-else>
		<li v-for="episode in episodes" :key="episode.id">{{ episode.id }}</li>
	</ul>
	<p class="hint">Design sketch to build from: <code>docs/ux/01-dataset-overview.html</code></p>
</template>

<style scoped>
.err { color: #ff6b6b; }
.hint { color: #7d8aa0; font-size: 13px; }
</style>
