<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()
</script>

<template>
	<h1>{{ route.meta.title }}</h1>
	<p>Not built yet. Design sketch to build from: <code>docs/ux/{{ route.meta.sketch }}</code></p>
</template>
