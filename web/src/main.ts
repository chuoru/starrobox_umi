import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'

const router = createRouter({
	history: createWebHistory(),
	routes: [
		{ path: '/', redirect: '/overview' },
		{ path: '/overview', component: () => import('./views/OverviewView.vue'), meta: { title: 'Overview' } },
		{ path: '/triage', component: () => import('./views/PlaceholderView.vue'), meta: { title: 'Triage', sketch: '03-quality-curation.html' } },
		{ path: '/episode/:id', component: () => import('./views/EpisodeView.vue'), meta: { title: 'Episode' } },
		{ path: '/export', component: () => import('./views/PlaceholderView.vue'), meta: { title: 'Annotate and export', sketch: '04-annotate-split-export.html' } },
		{ path: '/model-view', component: () => import('./views/PlaceholderView.vue'), meta: { title: 'Model view', sketch: '05-model-view.html' } },
	],
})

createApp(App).use(router).mount('#app')
