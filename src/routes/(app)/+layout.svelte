<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { branches, loadSettings } from '#lib/data/cache';
	import Icon from '#lib/components/Icon.svelte';
	import { t, locale } from '#lib/i18n';
	import {
		activeBranchId,
		currentStaff,
		session,
		sessionReady,
		setActiveBranch,
		barbersForBranch
	} from '#lib/stores/session.svelte';
	import { drainOutbox, forceOffline, online, pendingCount, syncing } from '#lib/stores/sync.svelte';
	import { barbers, staff } from '#lib/data/cache';
	import type { MessageKey } from '#lib/i18n/messages';

	let { children } = $props();

	const NAV: Array<{ href: string; icon: string; label: MessageKey; ownerOnly?: boolean }> = [
		{ href: '/dashboard', icon: 'grid', label: 'nav.dashboard' },
		{ href: '/sell', icon: 'cart', label: 'nav.sell' },
		{ href: '/queue', icon: 'users', label: 'nav.queue' },
		{ href: '/catalog', icon: 'package', label: 'nav.catalog' },
		{ href: '/customers', icon: 'user', label: 'nav.customers' },
		{ href: '/reports', icon: 'chart', label: 'nav.reports' },
		{ href: '/branches', icon: 'building', label: 'nav.branches', ownerOnly: true },
		{ href: '/settings', icon: 'settings', label: 'nav.settings' }
	];

	const visibleNav = $derived(NAV.filter((n) => !n.ownerOnly || $session.roleRank >= 3));

	const myBranches = $derived(
		$currentStaff
			? $branches.filter((b) => b.active && $currentStaff!.branchIds.includes(b.id))
			: []
	);

	const activeBranch = $derived($branches.find((b) => b.id === $activeBranchId));
	const branchBarbers = $derived(barbersForBranch($barbers, $activeBranchId, $staff));

	// Auth guard: bounce to login once the persisted session has been restored.
	$effect(() => {
		if ($sessionReady && !$session.isAuthenticated) void goto('/login');
	});

	// A barber cannot serve a branch they are not assigned to.
	$effect(() => {
		if ($sessionReady && $currentStaff && $activeBranchId && !$currentStaff.branchIds.includes($activeBranchId)) {
			setActiveBranch($currentStaff.branchIds[0] ?? '');
		}
	});

	$effect(() => {
		if ($activeBranchId) void loadSettings($activeBranchId);
	});

	// Drain the outbox on startup in case the tab was closed while offline.
	onMount(() => {
		void drainOutbox();
	});

</script>

<div class="flex h-dvh overflow-hidden bg-ink-950">
	{#if $currentStaff}
		<!-- Desktop sidebar -->
		<aside class="hidden w-60 shrink-0 flex-col border-e border-ink-800 bg-ink-900 lg:flex">
			<div class="flex items-center gap-2.5 border-b border-ink-800 px-5 py-4">
				<div class="grid size-9 place-items-center rounded-lg bg-barber-red-600">
					<Icon name="scissors" size={16} class="text-ink-50" />
				</div>
				<div class="min-w-0">
					<p class="truncate text-sm font-semibold">{$t('app.name')}</p>
					<p class="truncate text-[11px] text-ink-500">{activeBranch?.name ?? '—'}</p>
				</div>
			</div>

			<nav class="flex-1 space-y-0.5 overflow-y-auto p-3">
				{#each visibleNav as item (item.href)}
					<a
						href={item.href}
						class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition"
						class:bg-ink-800={page.url.pathname.startsWith(item.href)}
						class:text-barber-red-400={page.url.pathname.startsWith(item.href)}
						class:text-ink-400={!page.url.pathname.startsWith(item.href)}
						class:hover:bg-ink-850={!page.url.pathname.startsWith(item.href)}
						class:hover:text-ink-200={!page.url.pathname.startsWith(item.href)}
					>
						<Icon name={item.icon} size={18} />
						{$t(item.label)}
						{#if item.href === '/settings' && $pendingCount > 0}
							<span class="ms-auto rounded-full bg-barber-red-500 px-1.5 text-[10px] font-bold text-ink-950">
								{$pendingCount}
							</span>
						{/if}
					</a>
				{/each}
			</nav>

			<div class="border-t border-ink-800 p-3">
				<button
					class="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-ink-850"
					onclick={() => goto('/login')}
					title={$t('login.signOut')}
				>
					<div class="grid size-9 shrink-0 place-items-center rounded-full bg-ink-700 text-xs font-semibold">
						{$currentStaff.displayName.slice(0, 2).toUpperCase()}
					</div>
					<div class="min-w-0 flex-1">
						<p class="truncate text-sm font-medium">{$currentStaff.displayName}</p>
						<p class="text-[11px] text-ink-500">{$t(`role.${$currentStaff.role}` as 'role.owner')}</p>
					</div>
					<Icon name="logout" size={16} class="text-ink-500" />
				</button>
			</div>
		</aside>
	{/if}

	<!-- Main column -->
	<div class="flex min-w-0 flex-1 flex-col">
		<header class="flex h-14 shrink-0 items-center gap-2 border-b border-ink-800 bg-ink-900 px-3 sm:px-4">
			<!-- Branch switcher -->
			{#if myBranches.length > 0}
				<select
					class="!w-auto max-w-[11rem] !py-1.5 text-xs"
					value={$activeBranchId ?? ''}
					onchange={(e) => setActiveBranch(e.currentTarget.value)}
				>
					{#each myBranches as branch (branch.id)}
						<option value={branch.id}>{branch.name}</option>
					{/each}
				</select>
			{/if}

			<div class="ms-auto flex items-center gap-2">
				{#if branchBarbers.length > 0}
					<span class="hidden text-xs text-ink-500 sm:inline">
						{branchBarbers.length} barber
					</span>
				{/if}

				<button
					class="btn btn-ghost px-2.5 py-1 text-xs"
					onclick={() => ($locale = $locale === 'id' ? 'en' : 'id')}
					title={$t('settings.language')}
				>
					<Icon name="globe" size={14} />
					{$locale === 'id' ? 'ID' : 'EN'}
				</button>

				<!-- Connectivity + outbox -->
				{#if $syncing}
					<button class="btn btn-ghost gap-1.5 px-2.5 py-1 text-xs" onclick={() => drainOutbox()} disabled>
						<Icon name="refresh" size={14} class="animate-spin" />
						{$t('settings.syncing')}
					</button>
				{:else if $online}
					<button
						class="btn btn-ghost gap-1.5 px-2.5 py-1 text-xs text-jade-400"
						onclick={() => drainOutbox()}
						title={$t('settings.syncNow')}
					>
						<Icon name="check" size={14} />
						{$pendingCount > 0 ? $pendingCount : $t('settings.online')}
					</button>
				{:else}
					<button
						class="btn btn-ghost gap-1.5 border-barber-red-600/40 px-2.5 py-1 text-xs text-barber-red-400"
						onclick={() => ($forceOffline = false)}
						title={$t('settings.offline')}
					>
						<Icon name="offline" size={14} />
						{$t('settings.offline')}{$pendingCount > 0 ? ` · ${$pendingCount}` : ''}
					</button>
				{/if}

				<button class="btn btn-ghost px-2.5 py-1 text-xs" onclick={() => goto('/settings')}>
					<Icon name="settings" size={14} />
					<span class="hidden sm:inline">{$t('nav.settings')}</span>
				</button>
			</div>
		</header>

		<main class="min-h-0 flex-1 overflow-y-auto">
			{@render children()}
		</main>
	</div>
</div>

<!--
	Mobile bottom bar.

	Every destination is rendered, not a truncated slice: Reports and Customers
	are as important as Sell on the shop floor, so the bar scrolls horizontally
	on narrow screens instead of dropping items off the end.
-->
<nav class="fixed inset-x-0 bottom-0 z-30 flex overflow-x-auto border-t border-ink-800 bg-ink-900 lg:hidden">
	{#each visibleNav as item (item.href)}
		<a
			href={item.href}
			class="relative flex min-w-16 flex-1 flex-col items-center gap-0.5 px-1 py-2 text-[10px] font-medium"
			class:text-barber-red-400={page.url.pathname.startsWith(item.href)}
			class:text-ink-500={!page.url.pathname.startsWith(item.href)}
		>
			<Icon name={item.icon} size={20} />
			<span class="truncate">{item.href === '/settings' ? $t('app.short') : $t(item.label)}</span>
			{#if item.href === '/settings' && $pendingCount > 0}
				<span class="absolute top-1 end-2 rounded-full bg-barber-red-500 px-1 text-[9px] font-bold text-ink-950">
					{$pendingCount}
				</span>
			{/if}
		</a>
	{/each}
</nav>
<div class="h-16 lg:hidden"></div>