<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';

	let {
		icon = 'alert',
		title,
		hint = '',
		children
	}: {
		icon?: string;
		title: string;
		hint?: string;
		children?: Snippet;
	} = $props();
</script>

<div class="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
	<div class="grid size-12 place-items-center rounded-full bg-ink-200">
		<Icon name={icon} size={22} class="text-walnut-500" />
	</div>
	<p class="mt-1 text-sm font-medium text-ink-900">{title}</p>
	{#if hint}<p class="max-w-xs text-xs text-ink-600">{hint}</p>{/if}
	{#if children}{@render children()}{/if}
</div>
