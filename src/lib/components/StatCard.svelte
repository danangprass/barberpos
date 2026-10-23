<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		label,
		value,
		hint = '',
		icon = '',
		tone = 'default'
	}: {
		label: string;
		value: string;
		hint?: string;
		icon?: string;
		tone?: 'default' | 'brass' | 'jade' | 'rust';
	} = $props();

	const toneClass = $derived(
		{
			default: 'text-ink-100',
			brass: 'text-brass-400',
			jade: 'text-jade-400',
			rust: 'text-rust-400'
		}[tone]
	);
</script>

<div class="card p-4">
	<div class="mb-1 flex items-center gap-2">
		{#if icon}<span class="text-ink-500">{icon}</span>{/if}
		<p class="text-xs font-medium tracking-wide text-ink-400 uppercase">{label}</p>
	</div>
	<p class="text-2xl font-semibold tabular-nums {toneClass}">{value}</p>
	{#if hint}<p class="mt-1 text-xs text-ink-500">{hint}</p>{/if}
</div>