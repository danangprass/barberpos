<script lang="ts">
	let {
		icon = '○',
		title,
		hint = '',
		children
	}: {
		icon?: string;
		title: string;
		hint?: string;
		children?: import('svelte').Snippet;
	} = $props();
</script>

<div class="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
	<div class="grid size-12 place-items-center rounded-full bg-ink-800 text-xl text-ink-500">{icon}</div>
	<p class="mt-1 text-sm font-medium text-ink-300">{title}</p>
	{#if hint}<p class="max-w-xs text-xs text-ink-500">{hint}</p>{/if}
	{#if children}{@render children()}{/if}
</div>