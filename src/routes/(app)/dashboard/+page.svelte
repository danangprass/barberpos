<script lang="ts">
	import { goto } from '$app/navigation';
	import { appointments, barbers, branches, items, sales, staff } from '#lib/data/cache';
	import StatCard from '#lib/components/StatCard.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import Modal from '#lib/components/Modal.svelte';
	import Receipt from '#lib/components/Receipt.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import { t } from '#lib/i18n';
	import { activeBranchId, canViewAllBranches, session } from '#lib/stores/session.svelte';
	import { branchSettings } from '#lib/data/cache';
	import { filterSales, lowStockItems, summarize } from '#lib/domain/reports';
	import { dayKey, formatIDR, formatTime } from '#lib/utils/format';
	import { businessDayKey } from '#shared/time';
	import type { Sale } from '#lib/types/domain';

	const today = businessDayKey(new Date());

	const visibleBranchIds = $derived(
		$canViewAllBranches
			? $branches.filter((b) => b.active).map((b) => b.id)
			: [$activeBranchId].filter((v): v is string => v !== null)
	);

	const todaySales = $derived(filterSales($sales, { branchIds: visibleBranchIds, day: today }));
	const summary = $derived(summarize(todaySales));

	const todayAppointments = $derived(
		$appointments
			.filter((a) => a.branchId === $activeBranchId && dayKey(a.scheduledAt) === today)
			.filter((a) => !['done', 'cancelled', 'no_show'].includes(a.status))
			.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
	);

	const inService = $derived(todayAppointments.filter((a) => a.status === 'in_service').length);
	const waiting = $derived(todayAppointments.filter((a) => a.status === 'arrived' || a.status === 'queued').length);

	const lowStock = $derived(lowStockItems($items, $branchSettings?.lowStockDefault ?? 5));

	const recent = $derived(
		[...todaySales].sort((a, b) => b.soldAt.localeCompare(a.soldAt)).slice(0, 8)
	);

	let reprinting = $state<Sale | null>(null);
	const activeBranch = $derived($branches.find((b) => b.id === $activeBranchId));
	const barberName = (id?: string) => $barbers.find((b) => b.id === id)?.displayName ?? '—';
</script>

<div class="space-y-4 p-4 sm:p-6">
	<div class="flex flex-wrap items-center justify-between gap-2">
		<div>
			<h1 class="text-xl font-semibold">{$t('nav.dashboard')}</h1>
			<p class="text-sm text-ink-400">{$t('common.today')} · {$t(`role.${$session.role}` as 'role.owner')}</p>
		</div>
		<button class="btn btn-primary" onclick={() => goto('/sell')}>
			<Icon name="cart" size={16} /> {$t('nav.sell')}
		</button>
	</div>

	<div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
		<StatCard label={$t('dashboard.todaySales')} value={formatIDR(summary.gross)} tone="brass" icon="◈" />
		<StatCard label={$t('dashboard.transactions')} value={String(summary.count)} hint={`${summary.serviceCount} svc · ${summary.productCount} prd`} />
		<StatCard label={$t('dashboard.averageTicket')} value={formatIDR(summary.avgTicket)} />
		<StatCard
			label={$t('dashboard.inQueue')}
			value={`${inService} / ${waiting}`}
			hint={`${$t('dashboard.waiting')}: ${waiting}`}
			tone={inService > 0 ? 'jade' : 'default'}
			icon="◷"
		/>
	</div>

	<div class="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
		<!-- Recent sales -->
		<section class="card overflow-hidden">
			<header class="flex items-center justify-between border-b border-ink-700 px-4 py-3">
				<h2 class="text-sm font-semibold">{$t('dashboard.recentSales')}</h2>
				<button class="text-xs text-brass-400 hover:underline" onclick={() => goto('/reports')}>
					{$t('dashboard.viewAll')} →
				</button>
			</header>
			{#if recent.length === 0}
				<EmptyState icon="◔" title={$t('dashboard.noSales')} />
			{:else}
				<ul class="divide-y divide-ink-800">
					{#each recent as sale (sale.id)}
						<li>
							<button
								class="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-ink-800"
								onclick={() => (reprinting = sale)}
							>
								<div class="min-w-0 flex-1">
									<p class="truncate text-sm font-medium">{sale.customerName}</p>
									<p class="truncate text-xs text-ink-500">
										{sale.receiptNo} · {sale.lines.map((l) => l.name).join(', ')}
									</p>
								</div>
								{#if sale.lines.some((l) => l.barberId)}
									<span class="hidden max-w-[9rem] truncate text-xs text-ink-500 sm:block">
										{barberName(sale.lines.find((l) => l.barberId)?.barberId)}
									</span>
								{/if}
								<span class="shrink-0 text-xs text-ink-500">{formatTime(sale.soldAt)}</span>
								<span class="w-24 shrink-0 text-right text-sm font-semibold tabular-nums">{formatIDR(sale.total)}</span>
								{#if sale.syncState === 'pending_sync'}
									<span class="badge bg-brass-600/20 text-brass-400" title={$t('settings.pendingSales')}>⏳</span>
								{/if}
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<div class="space-y-4">
			<!-- Today's bookings -->
			<section class="card overflow-hidden">
				<header class="flex items-center justify-between border-b border-ink-700 px-4 py-3">
					<h2 class="text-sm font-semibold">{$t('dashboard.bookedToday')}</h2>
					<button class="text-xs text-brass-400 hover:underline" onclick={() => goto('/queue')}>
						{$t('nav.queue')} →
					</button>
				</header>
				{#if todayAppointments.length === 0}
					<EmptyState icon="🗓" title={$t('queue.noAppointments')} />
				{:else}
					<ul class="divide-y divide-ink-800">
						{#each todayAppointments.slice(0, 5) as apt (apt.id)}
							<li class="flex items-center gap-3 px-4 py-2.5">
								<span class="w-12 shrink-0 text-xs tabular-nums text-ink-500">{formatTime(apt.scheduledAt)}</span>
								<div class="min-w-0 flex-1">
									<p class="truncate text-sm">{apt.customerName}</p>
									<p class="truncate text-xs text-ink-500">{barberName(apt.barberId)}</p>
								</div>
								<span
									class="badge {apt.status === 'in_service'
										? 'bg-jade-600 text-white'
										: apt.status === 'arrived' || apt.status === 'queued'
											? 'bg-azure-600 text-white'
											: 'bg-ink-700 text-ink-300'}"
								>
									{$t(`queue.status.${apt.status}` as 'queue.status.booked')}
								</span>
							</li>
						{/each}
					</ul>
				{/if}
			</section>

			<!-- Low stock -->
			<section class="card overflow-hidden">
				<header class="flex items-center justify-between border-b border-ink-700 px-4 py-3">
					<h2 class="text-sm font-semibold">{$t('dashboard.lowStock')}</h2>
					<button class="text-xs text-brass-400 hover:underline" onclick={() => goto('/catalog')}>
						{$t('nav.catalog')} →
					</button>
				</header>
				{#if lowStock.length === 0}
					<EmptyState icon="✓" title="Stok aman" />
				{:else}
					<ul class="divide-y divide-ink-800">
						{#each lowStock as item (item.id)}
							<li class="flex items-center gap-3 px-4 py-2.5">
								<Icon name="alert" size={15} class="text-brass-500" />
								<span class="min-w-0 flex-1 truncate text-sm">{item.name}</span>
								<span class="text-sm font-semibold tabular-nums" class:text-rust-400={(item.stock ?? 0) <= 0}>
									{item.stock ?? 0}
								</span>
							</li>
						{/each}
					</ul>
				{/if}
			</section>
		</div>
	</div>
</div>

<Modal
	open={reprinting !== null}
	title={$t('sell.printReceipt')}
	subtitle={reprinting?.receiptNo}
	onclose={() => (reprinting = null)}
	width="max-w-md"
>
	{#if reprinting}
		{@const sale = reprinting}
		<Receipt
			{sale}
			branch={activeBranch}
			settings={$branchSettings}
			cashier={$staff.find((s) => s.id === sale.cashierId)}
			barbers={$barbers}
			staff={$staff}
		/>
	{/if}
	{#snippet footer()}
		<button class="btn btn-ghost" onclick={() => (reprinting = null)}>{$t('common.close')}</button>
	{/snippet}
</Modal>