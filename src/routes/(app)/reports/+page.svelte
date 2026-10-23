<script lang="ts">
	import { appointments, barbers, branches, sales, staff } from '#lib/data/cache';
	import StatCard from '#lib/components/StatCard.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import { t, intlLocale } from '#lib/i18n';
	import { activeBranchId, canViewAllBranches, session } from '#lib/stores/session.svelte';
	import {
		barberPerformance,
		byBranch,
		downloadCsv,
		filterSales,
		salesCsv,
		summarize,
		topItems
	} from '#lib/domain/reports';
	import { dayKey, formatDate, formatIDR, formatTime } from '#lib/utils/format';
	import { businessDayKey } from '#shared/time';
	import type { MessageKey } from '#lib/i18n/messages';

	let date = $state(businessDayKey(new Date()));

	const branchNames = $derived(new Map($branches.map((b) => [b.id, b.name])));

	/** Owners see every branch; everyone else is locked to their own. */
	const visibleBranchIds = $derived(
		$canViewAllBranches
			? $branches.filter((b) => b.active).map((b) => b.id)
			: [$activeBranchId].filter((v): v is string => v !== null)
	);

	const daySales = $derived(filterSales($sales, { branchIds: visibleBranchIds, day: date }).sort((a, b) => b.soldAt.localeCompare(a.soldAt)));
	const summary = $derived(summarize(daySales));
	const perf = $derived(barberPerformance(daySales, $barbers));
	const topServices = $derived(topItems(daySales, 'service', 8));
	const topProducts = $derived(topItems(daySales, 'product', 8));
	const branchStats = $derived(byBranch(daySales, branchNames));
	const commissions = $derived(perf.reduce((sum, p) => sum + p.commission, 0));

	const cashierName = (id: string) => $staff.find((s) => s.id === id)?.displayName ?? '—';

	/** Z-Report: the close-of-day sheet the owner signs off on. */
	const zLines = $derived([
		{ label: $t('reports.gross'), value: formatIDR(summary.gross) },
		{ label: $t('common.discount'), value: formatIDR(summary.discount) },
		{ label: $t('reports.saleCount'), value: String(summary.count) },
		{ label: `${$t('sell.cash')} (${summary.byMethod.cash.count})`, value: formatIDR(summary.byMethod.cash.total) },
		{ label: `${$t('sell.qris')} (${summary.byMethod.qris.count})`, value: formatIDR(summary.byMethod.qris.total) },
		{ label: $t('reports.avgTicket'), value: formatIDR(summary.avgTicket) },
		{ label: `${$t('sell.services')} × ${summary.serviceCount}`, value: '—' },
		{ label: `${$t('sell.products')} × ${summary.productCount}`, value: '—' },
		{ label: $t('reports.commissionAccrued'), value: formatIDR(commissions) }
	]);

	const SECTIONS: Array<{ title: MessageKey; icon: string }> = [
		{ title: 'reports.byBarber', icon: 'scissors' },
		{ title: 'reports.topServices', icon: 'chart' },
		{ title: 'reports.topProducts', icon: 'package' }
	];

	function exportCsv() {
		downloadCsv(`penjualan-${date}.csv`, salesCsv(daySales, branchNames));
	}
</script>

<div class="space-y-4 p-4 sm:p-6">
	<div class="flex flex-wrap items-center justify-between gap-3">
		<div>
			<h1 class="text-xl font-semibold">{$t('reports.title')}</h1>
			<p class="text-sm text-ink-400">{formatDate(date + 'T00:00:00', $intlLocale)}</p>
		</div>
		<div class="flex items-center gap-2">
			<input type="date" class="!w-auto !py-1.5 text-sm" bind:value={date} />
			<button class="btn btn-ghost" onclick={exportCsv} disabled={daySales.length === 0}>
				<Icon name="printer" size={15} /> {$t('reports.exportCsv')}
			</button>
		</div>
	</div>

	{#if $canViewAllBranches && $branches.length > 1}
		<div class="flex items-center gap-2 rounded-lg border border-barber-red-600/30 bg-barber-red-500/10 px-3 py-2 text-xs text-barber-red-400">
			<Icon name="globe" size={14} />
			{$t('reports.byBranch')} — {$t('nav.branches')}
		</div>
	{/if}

	<div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
		<StatCard label={$t('reports.gross')} value={formatIDR(summary.gross)} tone="barber-red" />
		<StatCard label={$t('reports.saleCount')} value={String(summary.count)} />
		<StatCard label={$t('reports.avgTicket')} value={formatIDR(summary.avgTicket)} />
		<StatCard label={$t('reports.commissionAccrued')} value={formatIDR(commissions)} tone="jade" />
	</div>

	{#if daySales.length === 0}
		<EmptyState icon="chart" title={$t('reports.noData')} />
	{:else}
		<div class="grid gap-4 xl:grid-cols-3">
			<!-- Z-report -->
			<section class="card overflow-hidden xl:col-span-1">
				<header class="flex items-center gap-2 border-b border-ink-700 px-4 py-3">
					<Icon name="receipt" size={16} class="text-barber-red-500" />
					<h2 class="text-sm font-semibold">{$t('reports.zReport')}</h2>
				</header>
				<div class="p-4">
					<p class="mb-3 text-xs text-ink-500">
						{$branches.filter((b) => visibleBranchIds.includes(b.id)).map((b) => b.name).join(', ')}
					</p>
					<dl class="space-y-1.5 text-sm">
						{#each zLines as line (line.label)}
							<div class="flex items-baseline justify-between gap-3 border-b border-ink-800 pb-1.5">
								<dt class="text-ink-400">{line.label}</dt>
								<dd class="font-semibold tabular-nums">{line.value}</dd>
							</div>
						{/each}
					</dl>
					<div class="mt-4 grid grid-cols-2 gap-2 text-center">
						<div class="rounded-lg bg-ink-800 py-2">
							<p class="text-xs text-ink-500">{$t('sell.cash')}</p>
							<p class="text-sm font-semibold tabular-nums">{formatIDR(summary.byMethod.cash.total)}</p>
						</div>
						<div class="rounded-lg bg-ink-800 py-2">
							<p class="text-xs text-ink-500">{$t('sell.qris')}</p>
							<p class="text-sm font-semibold tabular-nums">{formatIDR(summary.byMethod.qris.total)}</p>
						</div>
					</div>
					<p class="mt-3 text-[11px] text-ink-600">
						{$t('reports.closedBy')}: {$session.staff?.displayName ?? '—'} · {formatTime(new Date().toISOString())}
					</p>
				</div>
			</section>

			<!-- Rankings -->
			<div class="space-y-4 xl:col-span-2">
				{#each SECTIONS as section (section.title)}
					<section class="card overflow-hidden">
						<header class="flex items-center gap-2 border-b border-ink-700 px-4 py-3">
							<Icon name={section.icon} size={16} class="text-barber-red-500" />
							<h2 class="text-sm font-semibold">{$t(section.title)}</h2>
						</header>
						{#if section.title === 'reports.byBarber'}
							{#if perf.length === 0}
								<EmptyState icon="alert" title={$t('reports.noData')} />
							{:else}
								<table class="w-full text-sm">
									<thead class="border-b border-ink-800 text-left text-xs tracking-wide text-ink-400 uppercase">
										<tr>
											<th class="px-4 py-2 font-medium">{$t('common.name')}</th>
											<th class="px-4 py-2 font-medium">{$t('reports.jobs')}</th>
											<th class="hidden px-4 py-2 font-medium sm:table-cell">{$t('common.total')}</th>
											<th class="px-4 py-2 text-right font-medium">{$t('reports.commission')}</th>
										</tr>
									</thead>
									<tbody class="divide-y divide-ink-800">
										{#each perf as row (row.barberId)}
											<tr>
												<td class="px-4 py-2 font-medium">{row.name}</td>
												<td class="px-4 py-2 tabular-nums text-ink-400">{row.jobs}</td>
												<td class="hidden px-4 py-2 tabular-nums text-ink-400 sm:table-cell">{formatIDR(row.revenue)}</td>
												<td class="px-4 py-2 text-right font-semibold tabular-nums text-jade-400">{formatIDR(row.commission)}</td>
											</tr>
										{/each}
									</tbody>
								</table>
							{/if}
						{:else}
							{@const rows = section.title === 'reports.topServices' ? topServices : topProducts}
							{#if rows.length === 0}
								<EmptyState icon="alert" title={$t('reports.noData')} />
							{:else}
								<table class="w-full text-sm">
									<thead class="border-b border-ink-800 text-left text-xs tracking-wide text-ink-400 uppercase">
										<tr>
											<th class="w-8 px-4 py-2 font-medium">#</th>
											<th class="px-4 py-2 font-medium">{$t('common.name')}</th>
											<th class="px-4 py-2 text-right font-medium">{$t('common.qty')}</th>
											<th class="px-4 py-2 text-right font-medium">{$t('common.total')}</th>
										</tr>
									</thead>
									<tbody class="divide-y divide-ink-800">
										{#each rows as row, i (row.itemId)}
											<tr>
												<td class="px-4 py-2 tabular-nums text-ink-600">{i + 1}</td>
												<td class="px-4 py-2">{row.name}</td>
												<td class="px-4 py-2 text-right tabular-nums text-ink-400">{row.qty}</td>
												<td class="px-4 py-2 text-right font-semibold tabular-nums">{formatIDR(row.revenue)}</td>
											</tr>
										{/each}
									</tbody>
								</table>
							{/if}
						{/if}
					</section>
				{/each}

				{#if $canViewAllBranches && $branches.length > 1}
					<section class="card overflow-hidden">
						<header class="flex items-center gap-2 border-b border-ink-700 px-4 py-3">
							<Icon name="building" size={16} class="text-barber-red-500" />
							<h2 class="text-sm font-semibold">{$t('reports.byBranch')}</h2>
						</header>
						<table class="w-full text-sm">
							<tbody class="divide-y divide-ink-800">
								{#each branchStats as row (row.branchId)}
									<tr>
										<td class="px-4 py-2 font-medium">{row.name}</td>
										<td class="px-4 py-2 tabular-nums text-ink-400">{row.count} ×</td>
										<td class="px-4 py-2 text-right tabular-nums text-ink-400">{formatIDR(row.avgTicket)}</td>
										<td class="px-4 py-2 text-right font-semibold tabular-nums text-barber-red-400">{formatIDR(row.gross)}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</section>
				{/if}
			</div>
		</div>

		<!-- Transaction log -->
		<section class="card overflow-hidden">
			<header class="border-b border-ink-700 px-4 py-3">
				<h2 class="text-sm font-semibold">{$t('reports.daily')}</h2>
			</header>
			<div class="overflow-x-auto">
				<table class="w-full min-w-[46rem] text-sm">
					<thead class="border-b border-ink-800 bg-ink-800/50 text-left text-xs tracking-wide text-ink-400 uppercase">
						<tr>
							<th class="px-4 py-2.5 font-medium">{$t('reports.saleNo')}</th>
							<th class="px-4 py-2.5 font-medium">Waktu</th>
							<th class="px-4 py-2.5 font-medium">{$t('common.name')}</th>
							<th class="hidden px-4 py-2.5 font-medium md:table-cell">{$t('reports.cashier')}</th>
							<th class="hidden px-4 py-2.5 font-medium lg:table-cell">{$t('sell.paymentMethod')}</th>
							<th class="px-4 py-2.5 text-right font-medium">{$t('common.total')}</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-ink-800">
						{#each daySales as sale (sale.id)}
							<tr class="hover:bg-ink-850">
								<td class="px-4 py-2 font-mono text-xs text-ink-400">{sale.receiptNo}</td>
								<td class="px-4 py-2 tabular-nums text-ink-400">{formatTime(sale.soldAt)}</td>
								<td class="px-4 py-2">
									<p class="truncate">{sale.customerName}</p>
									<p class="truncate text-xs text-ink-500">{sale.lines.map((l) => l.name).join(', ')}</p>
								</td>
								<td class="hidden px-4 py-2 text-ink-400 md:table-cell">{cashierName(sale.cashierId)}</td>
								<td class="hidden px-4 py-2 lg:table-cell">
									<span class="badge bg-ink-700 text-ink-300">
										{sale.payment.method === 'cash' ? $t('sell.cash') : $t('sell.qris')}
									</span>
								</td>
								<td class="px-4 py-2 text-right font-semibold tabular-nums">{formatIDR(sale.total)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</section>
	{/if}
</div>