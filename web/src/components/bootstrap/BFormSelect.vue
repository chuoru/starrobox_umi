<script setup lang="ts">
type Option = string | number | { value: string | number; text: string }

const model = defineModel<string | number | null>({ default: null })

defineProps<{
	options: Option[]
	size?: string
	id?: string
	disabled?: boolean
}>()

const valueOf = (o: Option) => (typeof o === 'object' ? o.value : o)
const textOf = (o: Option) => (typeof o === 'object' ? o.text : o)
</script>

<template>
	<select :id="id" v-model="model" :class="['form-select', { [`form-select-${size}`]: !!size }]" :disabled="disabled">
		<slot name="first" />
		<option v-for="o in options" :key="valueOf(o)" :value="valueOf(o)">{{ textOf(o) }}</option>
		<slot />
	</select>
</template>
