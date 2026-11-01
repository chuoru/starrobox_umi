<script setup lang="ts">
const model = defineModel<string | number>({ default: '' })

withDefaults(
	defineProps<{
		type?: string
		id?: string
		size?: string
		placeholder?: string
		autocomplete?: string
		disabled?: boolean
	}>(),
	{ type: 'text' },
)
</script>

<template>
	<input
		:id="id"
		v-model="model"
		:type="type"
		:class="['form-control', { [`form-control-${size}`]: !!size }]"
		:placeholder="placeholder"
		:autocomplete="autocomplete"
		:disabled="disabled"
	/>
</template>
