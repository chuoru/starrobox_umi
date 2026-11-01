<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { api } from '../api/client'

interface MenuItem {
	to: string
	label: string
	icon: string
	/** Route path prefixes that light up this item, for pages that live below it. */
	also?: string[]
}

const menu: MenuItem[] = [
	{ to: '/overview', label: 'Overview', icon: 'grid-3x3-gap', also: ['/episode'] },
	{ to: '/triage', label: 'Triage', icon: 'funnel' },
	{ to: '/export', label: 'Annotate and export', icon: 'tags' },
	{ to: '/model-view', label: 'Model view', icon: 'eye' },
]

const route = useRoute()
const expanded = ref(false)
const isActive = (item: MenuItem) => [item.to, ...(item.also ?? [])].some((p) => route.path === p || route.path.startsWith(p + '/'))
const backend = ref<'checking' | 'up' | 'down'>('checking')
const backendLabel = computed(() => `backend: ${backend.value}`)

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
	<div class="layout">
		<header class="fixed-header d-flex justify-content-between align-items-center">
			<div class="start-items d-flex align-items-center">
				<button type="button" :aria-label="expanded ? 'Collapse menu' : 'Expand menu'" :aria-expanded="expanded" @click="expanded = !expanded">
					<b-icon icon="list" />
				</button>
				<router-link to="/overview" class="d-flex align-items-center">
					<span class="app-name">STARROBOX</span>
					<span class="app-badge">UMI</span>
				</router-link>
			</div>
			<div class="end-items">
				<span class="status" :data-state="backend">{{ backendLabel }}</span>
			</div>
		</header>
		<div class="layout-body">
			<nav class="sidebar" :class="{ min: !expanded }" aria-label="Main">
				<ul class="sidebar-menu">
					<li v-for="item in menu" :key="item.to" :class="{ active: isActive(item) }">
						<router-link :to="item.to" :title="expanded ? undefined : item.label" :aria-current="isActive(item) ? 'page' : undefined">
							<span class="icon"><b-icon :icon="item.icon" /></span>
							<span class="label">{{ item.label }}</span>
						</router-link>
					</li>
				</ul>
			</nav>
			<main class="main-content"><slot /></main>
		</div>
	</div>
</template>

<style scoped>
.layout {
	--layout-accent: var(--bs-primary);
	--layout-sidebar-text: rgba(255, 255, 255, 0.72);
	--layout-sidebar-text-hover: #fff;
	--header-height: 60px;
	--sidebar-expand-width: 260px;
	--sidebar-shrink-width: 65px;
	height: 100vh;
	display: flex;
	flex-direction: column;
}

.fixed-header {
	height: var(--header-height);
	flex: none;
	padding: 0 12px;
	background: #fff;
	box-shadow: 0 0.5rem 1rem rgb(0 0 0 / 5%), inset 0 -1px 0 rgb(0 0 0 / 15%);
	z-index: 1010;
}
.start-items > button {
	color: var(--bs-gray-700);
	background: transparent;
	border: none;
	margin-right: 20px;
	font-size: 1.6rem;
	line-height: 1;
}
.start-items > button:hover { color: #000; }
.start-items > a { color: var(--bs-gray-700); }
.start-items > a:hover { color: #000; }
.app-name { font-weight: 700; font-size: 1.1rem; margin-right: 10px; }
.app-badge {
	font-size: 0.7rem;
	font-weight: 700;
	color: #fff;
	background: var(--layout-accent);
	border-radius: 5px;
	padding: 3px 8px;
	white-space: nowrap;
}
.status { font-size: 0.8rem; color: var(--bs-gray-600); }
.status[data-state='up'] { color: var(--umi-primary-text); }
.status[data-state='down'] { color: var(--bs-danger); }

.layout-body { flex: 1; display: flex; min-height: 0; }

.sidebar {
	flex: none;
	width: var(--sidebar-expand-width);
	background: var(--bs-secondary);
	transition: width 0.3s;
	overflow-x: hidden;
	overflow-y: auto;
	z-index: 600;
}
.sidebar.min { width: var(--sidebar-shrink-width); }
.sidebar-menu { list-style: none; margin: 0; padding: 30px 0; }
.sidebar-menu > li { display: flex; padding-left: 10px; }
.sidebar-menu > li > a {
	flex: 1;
	display: flex;
	align-items: center;
	padding: 18px 16px 18px 10px;
	white-space: nowrap;
	text-transform: uppercase;
	letter-spacing: 1.6px;
	font-weight: 500;
	font-size: 0.85rem;
	color: var(--layout-sidebar-text);
	text-decoration: none;
	transition: color 0.3s;
}
.sidebar-menu > li > a:hover { color: var(--layout-sidebar-text-hover); }
.sidebar-menu .icon {
	width: 24px;
	height: 30px;
	margin-right: 12px;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	font-size: 1.35rem;
}
.sidebar-menu > li.active > a {
	color: var(--umi-primary-text);
	background: #fff;
	border-top-left-radius: 9999px;
	border-bottom-left-radius: 9999px;
}
.sidebar.min .label { display: none; }
.sidebar-menu > li > a:focus-visible { outline: 2px solid #fff; outline-offset: -2px; }

.main-content {
	flex: 1;
	min-width: 0;
	min-height: 0;
	display: flex;
	flex-direction: column;
	overflow: auto;
	background: var(--bs-body-bg);
}
</style>
