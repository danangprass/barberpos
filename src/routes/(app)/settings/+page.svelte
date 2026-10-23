<script lang="ts">
	import { goto } from '$app/navigation';
	import { branches, branchSettings, outbox, refreshAll, resetDemoData, sales } from '#lib/data/cache';
	import { backendName, repo } from '#lib/data/index';
	import Icon from '#lib/components/Icon.svelte';
	import { t, locale, intlLocale } from '#lib/i18n';
	import { activeBranchId, session, signOut } from '#lib/stores/session.svelte';
	import { drainOutbox, deviceId, forceOffline, lastSyncAt, online, syncing } from '#lib/stores/sync.svelte';
	import { formatAge, formatDateTime } from '#lib/utils/format';
	import type { BranchSettings } from '#lib/types/domain';

	let form = $state({
		receiptHeader: '',
		receiptFooter: '',
		lowStockDefault: 5
	});

	let saved = $state(false);

	// --- backend health ------------------------------------------------------
	/**
	 * Firestore and the Cloud Functions are separate deploys, so "the app
	 * loads" does not mean "the backend works". This probe asks the server
	 * side directly, which is the only way to tell "the functions are missing"
	 * apart from "the data is there".
	 */
	let backendStatus = $state<'unknown' | 'ok' | 'down'>('unknown');
	let backendDetail = $state('');

	async function checkBackend() {
		backendStatus = 'unknown';
		backendDetail = '';
		try {
			const status = await repo.backendStatus();
			if (status === null) {
				backendStatus = 'ok';
				return;
			}
			backendStatus = status.ok ? 'ok' : 'down';
			backendDetail = `${status.staffCount} staf terdaftar`;
		} catch {
			backendStatus = 'down';
		}
	}

	$effect(() => {
		void checkBackend();
	});

	// Hydrate the form from the active branch's stored settings.
	$effect(() => {
		const settings = $branchSettings;
		if (!settings) return;
		form.receiptHeader = settings.receiptHeader;
		form.receiptFooter = settings.receiptFooter;
		form.lowStockDefault = settings.lowStockDefault;
	});

	const activeBranch = $derived($branches.find((b) => b.id === $activeBranchId));

	async function save() {
		if (!$activeBranchId) return;
		const settings: BranchSettings = {
			branchId: $activeBranchId,
			receiptHeader: form.receiptHeader,
			receiptFooter: form.receiptFooter,
			lowStockDefault: form.lowStockDefault
		};
		await repo.saveSettings(settings);
		branchSettings.set(settings);
		saved = true;
		setTimeout(() => (saved = false), 2200);
	}

	async function reset() {
		if (!confirm('Reset semua data demo? Semua transaksi dan katalog akan dihapus.')) return;
		await resetDemoData();
		branchSettings.set(null);
	}

	const pendingSales = $derived($sales.filter((s) => s.syncState === 'pending_sync').length);

	const queuedAges = $derived(
		$outbox.map((entry) => ({
			...entry,
			age: formatAge(Date.now() - new Date(entry.queuedAt).getTime())
		}))
	);
</script>

<div class="max-w-3xl space-y-4 p-4 sm:p-6">
	<div>
		<h1 class="text-xl font-semibold">{$t('settings.title')}</h1>
		<p class="text-sm text-ink-500">{$session.staff?.displayName} · {$t(`role.${$session.role}` as 'role.owner')}</p>
	</div>

	<!-- Account -->
	<section class="card p-4">
		<h2 class="mb-3 text-sm font-semibold">{$t('login.title')}</h2>
		<div class="flex flex-wrap items-center gap-3">
			<div class="grid size-11 place-items-center rounded-full bg-ink-200 text-sm font-semibold">
				{$session.staff?.displayName.slice(0, 2).toUpperCase()}
			</div>
			<div class="min-w-0 flex-1">
				<p class="truncate font-medium">{$session.staff?.displayName}</p>
				<p class="text-xs text-ink-500">{$t(`role.${$session.role}` as 'role.owner')} · {$session.staff?.phone}</p>
			</div>
			<button class="btn btn-ghost" onclick={() => { signOut(); void goto('/login'); }}>
				<Icon name="logout" size={15} /> {$t('login.signOut')}
			</button>
		</div>
	</section>

	<!-- Language -->
	<section class="card p-4">
		<h2 class="mb-3 text-sm font-semibold">{$t('settings.language')}</h2>
		<div class="flex gap-2">
			{#each [{ code: 'id', label: 'Bahasa Indonesia' }, { code: 'en', label: 'English' }] as option (option.code)}
				<button
					class="btn flex-1"
					class:bg-walnut-500={$locale === option.code}
					class:text-ink-950={$locale === option.code}
					class:bg-ivory-200={$locale !== option.code}
					class:text-ink-600={$locale !== option.code}
					onclick={() => ($locale = option.code as 'id' | 'en')}
				>
					{option.label}
				</button>
			{/each}
		</div>
	</section>

	<!-- Connectivity + outbox -->
	<section class="card overflow-hidden">
		<header class="flex items-center justify-between border-b border-stone-300 px-4 py-3">
			<h2 class="text-sm font-semibold">{$t('settings.connectivity')}</h2>
			<span
				class="badge {$online ? 'bg-sage-600 text-white' : 'bg-amber-600 text-white'}"
			>
				{$online ? $t('settings.online') : $t('settings.offline')}
			</span>
		</header>

		<div class="space-y-3 p-4">
			<label class="flex items-center justify-between gap-3 text-sm">
				<span class="text-ink-600">{$t('settings.simulateOffline')}</span>
				<input type="checkbox" class="!w-5 !h-5" bind:checked={$forceOffline} />
			</label>

			<div class="flex flex-wrap items-center gap-2 text-xs text-ink-500">
				<span>{$t('settings.device')}: <code class="font-mono text-ink-600">{deviceId()}</code></span>
				{#if $lastSyncAt}
					<span>· {$t('settings.syncNow')}: {formatDateTime($lastSyncAt, $intlLocale)}</span>
				{/if}
			</div>

			<div class="flex items-center justify-between gap-2 rounded-lg bg-ivory-200 px-3 py-2">
				<span class="text-sm text-ink-600">
					{$t('settings.pendingSales')}
				</span>
				<span class="flex items-center gap-2">
					<span class="text-sm font-semibold tabular-nums" class:text-walnut-500={$outbox.length > 0} class:text-sage-500={$outbox.length === 0}>
						{$outbox.length}
					</span>
					<button class="btn btn-ghost px-2.5 py-1 text-xs" onclick={() => drainOutbox()} disabled={$syncing || !$online || $outbox.length === 0}>
						<Icon name="refresh" size={13} class={$syncing ? 'animate-spin' : ''} />
						{$syncing ? $t('settings.syncing') : $t('settings.syncNow')}
					</button>
				</span>
			</div>

			{#if queuedAges.length === 0}
				<p class="flex items-center gap-2 text-xs text-sage-500">
					<Icon name="check" size={14} /> {$t('settings.allSynced')}
				</p>
			{:else}
				<ul class="divide-y divide-stone-200 rounded-lg border border-stone-300">
					{#each queuedAges as entry (entry.clientId)}
						<li class="flex items-center gap-3 px-3 py-2 text-xs">
							<Icon name="offline" size={13} class="shrink-0 text-walnut-500" />
							<span class="min-w-0 flex-1 truncate font-mono text-ink-500">{entry.clientId}</span>
							<span class="shrink-0 text-ink-500">{entry.age}</span>
							<span class="shrink-0 text-ink-600">{$t('settings.attempts')} {entry.attempts}</span>
						</li>
					{/each}
				</ul>
			{/if}

			{#if pendingSales > 0}
				<p class="text-xs text-amber-400">
					{pendingSales} {$t('settings.pendingSales')} {$t('settings.waitingReceipt')}
				</p>
			{/if}
		</div>
	</section>

	<!-- Receipt + stock settings -->
	<section class="card p-4">
		<h2 class="mb-1 text-sm font-semibold">{$t('settings.branch')}</h2>
		<p class="mb-3 text-xs text-ink-500">{activeBranch?.name}</p>

		<div class="space-y-3">
			<div>
				<label class="mb-1 block text-xs font-medium text-ink-500" for="set-header">{$t('settings.receiptHeader')}</label>
				<textarea id="set-header" rows="3" bind:value={form.receiptHeader}></textarea>
			</div>
			<div>
				<label class="mb-1 block text-xs font-medium text-ink-500" for="set-footer">{$t('settings.receiptFooter')}</label>
				<textarea id="set-footer" rows="2" bind:value={form.receiptFooter}></textarea>
			</div>
			<div class="max-w-48">
				<label class="mb-1 block text-xs font-medium text-ink-500" for="set-low">{$t('settings.lowStockDefault')}</label>
				<input id="set-low" type="number" min="0" bind:value={form.lowStockDefault} />
			</div>
		</div>

		<div class="mt-4 flex items-center gap-3">
			<button class="btn btn-primary" onclick={save} disabled={!$activeBranchId}>
				{saved ? $t('settings.saved') : $t('settings.saveSettings')}
			</button>
			{#if saved}
				<span class="flex items-center gap-1.5 text-xs text-sage-500">
					<Icon name="check" size={14} /> {$t('settings.saved')}
				</span>
			{/if}
		</div>
	</section>

	<!-- Backend + migration -->
	<section class="card border-dashed p-4">
		<h2 class="mb-1 text-sm font-semibold">{$t('settings.backend')}</h2>
		<p class="mb-3 flex flex-wrap items-center gap-2 text-xs text-ink-500">
			<span class="badge {backendName === 'firebase' ? 'bg-sage-600 text-white' : 'bg-amber-600 text-white'}">
				{backendName === 'firebase' ? 'Firebase' : 'Mock'}
			</span>
			{backendName === 'firebase' ? $t('settings.backendFirebase') : $t('settings.backendMock')}
		</p>

		{#if backendName === 'firebase'}
			<div class="mb-3 rounded-lg border border-stone-200 p-3">
				<div class="mb-1 flex items-center justify-between gap-2">
					<span class="text-xs font-medium text-ink-500">{$t('settings.backendHealth')}</span>
					<button class="text-xs text-walnut-500 underline" onclick={() => checkBackend()}>
						{$t('common.retry')}
					</button>
				</div>
				{#if backendStatus === 'ok'}
					<p class="text-xs text-sage-500">
						{$t('settings.backendReady')}
						{backendDetail ? `· ${backendDetail}` : ''}
					</p>
				{:else if backendStatus === 'down'}
					<p class="text-xs text-red-400">{$t('settings.backendDown')}</p>
				{:else}
					<p class="text-xs text-ink-500">{$t('settings.backendChecking')}</p>
				{/if}
			</div>
		{/if}

		{#if backendName === 'firebase'}
			<h3 class="mb-1 text-sm font-semibold">{$t('settings.migration')}</h3>
			<p class="mb-3 text-xs leading-relaxed text-ink-500">{$t('settings.migrationHint')}</p>
			<div class="rounded-lg border border-stone-200 bg-paper p-3">
				<code class="block text-xs text-walnut-500">node scripts/seed-live.cjs</code>
				<p class="mt-2 text-xs leading-relaxed text-ink-500">{$t('settings.migrationLocal')}</p>
			</div>
		{:else}
			<p class="mb-3 text-xs text-ink-500">
				Semua data tersimpan di IndexedDB browser ini. Set <code class="font-mono">VITE_USE_MOCK=false</code>
				untuk beralih ke Firebase.
			</p>
			<button class="btn btn-danger" onclick={() => resetDemoData()}>Reset data demo</button>
		{/if}
	</section>
</div>