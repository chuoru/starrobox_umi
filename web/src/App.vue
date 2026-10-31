<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { api } from './api/client'

const backend = ref<'checking' | 'up' | 'down'>('checking')

onMounted(async () => {
	try {
		await api.health()
		backend.value = 'up'
	} catch {
		backend.value = 'down'
	}
})
</script>

<template>
	<header class="bar">
		<strong>starrobox_umi</strong>
		<nav>
			<RouterLink to="/overview">Overview</RouterLink>
			<RouterLink to="/triage">Triage</RouterLink>
			<RouterLink to="/export">Annotate and export</RouterLink>
			<RouterLink to="/model-view">Model view</RouterLink>
		</nav>
		<span class="status" :data-state="backend">backend: {{ backend }}</span>
	</header>
	<main><RouterView /></main>
</template>

<style>
body { margin: 0; font-family: system-ui, sans-serif; background: #12151b; color: #dde2ea; }
.bar { display: flex; gap: 24px; align-items: center; padding: 10px 16px; border-bottom: 1px solid #262c38; }
nav { display: flex; gap: 16px; flex: 1; }
nav a { color: #9aa6b8; text-decoration: none; }
nav a.router-link-active { color: #fff; border-bottom: 2px solid #4c8dff; }
.status { font-size: 13px; }
.status[data-state='up'] { color: #4ecb8d; }
.status[data-state='down'] { color: #ff6b6b; }
main { padding: 16px; }
</style>
