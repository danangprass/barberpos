<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		open,
		title,
		subtitle = '',
		onclose,
		children,
		footer,
		width = 'max-w-2xl'
	}: {
		open: boolean;
		title: string;
		subtitle?: string;
		onclose: () => void;
		children: Snippet;
		footer?: Snippet;
		width?: string;
	} = $props();

	function onKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && open) onclose();
	}
</script>

<svelte:window onkeydown={onKeydown} />

{#if open}
	<div class="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
		<button
			class="absolute inset-0 bg-ink-950/80 backdrop-blur-sm"
			aria-label="close"
			onclick={onclose}
		></button>

		<div
			class="relative z-10 flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-ink-700 bg-ink-850 shadow-2xl sm:rounded-2xl {width}"
		>
			<header class="flex items-start justify-between gap-4 border-b border-ink-700 px-5 py-4">
				<div>
					<h2 class="text-base font-semibold text-ink-100">{title}</h2>
					{#if subtitle}<p class="mt-0.5 text-xs text-ink-400">{subtitle}</p>{/if}
				</div>
				<button
					class="btn btn-ghost size-9 shrink-0 p-0 text-lg leading-none"
					onclick={onclose}
					aria-label="close"
				>
					×
				</button>
			</header>

			<div class="min-h-0 flex-1 overflow-y-auto px-5 py-4">
				{@render children()}
			</div>

			{#if footer}
				<footer class="flex items-center justify-end gap-2 border-t border-ink-700 px-5 py-3">
					{@render footer()}
				</footer>
			{/if}
		</div>
	</div>
{/if}