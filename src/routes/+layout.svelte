<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { boot, bootError, loading } from '#lib/data/cache';
	import { restoreSession } from '#lib/stores/session.svelte';
	import { t } from '#lib/i18n';

	let { children } = $props();

	onMount(() => {
		void (async () => {
			await boot();
			await restoreSession();
		})();
	});
</script>

{#if $loading}
	<div class="grid h-dvh place-items-center bg-ink-950">
		<div class="flex flex-col items-center gap-3">
			<div class="size-10 animate-spin rounded-full border-2 border-ink-700 border-t-walnut-500"></div>
			<p class="text-sm text-ink-400">Memuat…</p>
		</div>
	</div>
{:else if $bootError}
	<div class="grid h-dvh place-items-center bg-ink-950 p-6">
		<div class="card max-w-md p-6 text-center">
			<h1 class="mb-2 text-lg font-semibold text-red-400">{$t('boot.failed')}</h1>
			<p class="mb-4 text-sm text-ink-400">{$bootError}</p>
			<button class="btn btn-primary w-full" onclick={() => location.reload()}>{$t('boot.retry')}</button>
		</div>
	</div>
{:else}
	{@render children()}
{/if}
