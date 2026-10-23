<script lang="ts">
	import { customers, sales } from '#lib/data/cache';
	import { repo } from '#lib/data/index';
	import Icon from '#lib/components/Icon.svelte';
	import Modal from '#lib/components/Modal.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import { t, intlLocale } from '#lib/i18n';
	import { canManageCatalog, session } from '#lib/stores/session.svelte';
	import { filterSales } from '#lib/domain/reports';
	import { formatDate, formatIDR, uid } from '#lib/utils/format';
	import type { Customer } from '#lib/types/domain';

	let query = $state('');
	let creating = $state(false);
	let viewing = $state<Customer | null>(null);
	let saving = $state(false);

	let form = $state({ name: '', phone: '' as string | null, notes: '' });

	const visibleBranchIds = $derived($session.staff?.branchIds ?? []);

	const filtered = $derived(
		$customers
			.filter((c) => {
				const q = query.trim().toLowerCase();
				if (q === '') return true;
				return c.name.toLowerCase().includes(q) || (c.phone ?? '').includes(q);
			})
			.sort((a, b) => (b.lastVisitAt ?? '').localeCompare(a.lastVisitAt ?? ''))
	);

	/** A customer's spend is recomputed from their actual sales, not the cache field. */
	const statsOf = (customer: Customer) => {
		const salesFor = filterSales($sales, { branchIds: visibleBranchIds }).filter((s) => {
			if (s.customerId === customer.id) return true;
			if (customer.phone && s.customerPhone === customer.phone) return true;
			return s.customerName.toLowerCase() === customer.name.toLowerCase();
		});
		return {
			count: salesFor.length,
			spent: salesFor.reduce((sum, s) => sum + s.total, 0),
			last: salesFor.sort((a, b) => b.soldAt.localeCompare(a.soldAt))[0]?.soldAt ?? customer.lastVisitAt
		};
	};

	function openCreate() {
		form = { name: '', phone: null, notes: '' };
		creating = true;
	}

	function close() {
		creating = false;
	}

	async function save() {
		if (!form.name.trim()) return;
		saving = true;
		try {
			const customer: Customer = {
				id: uid('c_'),
				name: form.name.trim(),
				phone: form.phone?.trim() || null,
				notes: form.notes.trim(),
				visitCount: 0,
				totalSpent: 0,
				lastVisitAt: null,
				createdAt: new Date().toISOString()
			};
			await repo.saveCustomer(customer);
			await customers.refresh();
			close();
		} finally {
			saving = false;
		}
	}

	const initials = (name: string) => name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
</script>

<div class="space-y-4 p-4 sm:p-6">
	<div class="flex flex-wrap items-center justify-between gap-3">
		<div>
			<h1 class="text-xl font-semibold">{$t('customers.title')}</h1>
			<p class="text-sm text-ink-400">{$customers.length} {$t('common.items')}</p>
		</div>
		<button class="btn btn-primary" onclick={openCreate}>
			<Icon name="plus" size={16} /> {$t('customers.newCustomer')}
		</button>
	</div>

	<div class="relative">
		<Icon name="search" size={16} class="absolute top-1/2 left-3 -translate-y-1/2 text-ink-500" />
		<input class="!pl-9" placeholder={$t('customers.findPhone')} bind:value={query} />
	</div>

	{#if filtered.length === 0}
		<EmptyState icon="◌" title={$t('customers.noResults')}>
			<button class="btn btn-primary mt-2" onclick={openCreate}>{$t('customers.newCustomer')}</button>
		</EmptyState>
	{:else}
		<div class="card overflow-hidden">
			<table class="w-full text-sm">
				<thead class="border-b border-ink-700 bg-ink-800/50 text-left text-xs tracking-wide text-ink-400 uppercase">
					<tr>
						<th class="px-4 py-2.5 font-medium">{$t('common.name')}</th>
						<th class="hidden px-4 py-2.5 font-medium sm:table-cell">{$t('customers.phone')}</th>
						<th class="px-4 py-2.5 font-medium">{$t('customers.visits')}</th>
						<th class="hidden px-4 py-2.5 font-medium md:table-cell">{$t('customers.lastVisit')}</th>
						<th class="px-4 py-2.5 text-right font-medium">{$t('customers.totalSpent')}</th>
						<th class="w-12 px-4 py-2.5"></th>
					</tr>
				</thead>
				<tbody class="divide-y divide-ink-800">
					{#each filtered as customer (customer.id)}
						{@const stats = statsOf(customer)}
						<tr class="transition hover:bg-ink-850">
							<td class="px-4 py-2.5">
								<div class="flex items-center gap-2.5">
									<div class="grid size-8 shrink-0 place-items-center rounded-full bg-ink-700 text-[11px] font-semibold text-ink-300">
										{initials(customer.name)}
									</div>
									<div class="min-w-0">
										<p class="truncate font-medium">{customer.name}</p>
										<p class="truncate text-xs text-ink-500 sm:hidden">{customer.phone ?? '—'}</p>
									</div>
								</div>
							</td>
							<td class="hidden px-4 py-2.5 text-ink-400 sm:table-cell">{customer.phone ?? '—'}</td>
							<td class="px-4 py-2.5 tabular-nums">{stats.count}</td>
							<td class="hidden px-4 py-2.5 text-ink-400 md:table-cell">
								{stats.last ? formatDate(stats.last, $intlLocale) : '—'}
							</td>
							<td class="px-4 py-2.5 text-right font-semibold tabular-nums">{formatIDR(stats.spent)}</td>
							<td class="px-4 py-2.5 text-right">
								<button class="p-1.5 text-ink-500 hover:text-brass-400" onclick={() => (viewing = customer)}>
									<Icon name="chevron" size={16} />
								</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

<Modal
	open={creating}
	title={$t('customers.newCustomer')}
	onclose={close}
>
	<div class="space-y-3">
		<div>
			<label class="mb-1 block text-xs font-medium text-ink-400" for="c-name">{$t('common.name')}</label>
			<input id="c-name" bind:value={form.name} placeholder="Budi Santoso" />
		</div>
		<div>
			<label class="mb-1 block text-xs font-medium text-ink-400" for="c-phone">
				{$t('customers.phone')} <span class="text-ink-600">({$t('common.optional')})</span>
			</label>
			<input id="c-phone" bind:value={form.phone} inputmode="tel" placeholder="0812-3456-7890" />
		</div>
		<div>
			<label class="mb-1 block text-xs font-medium text-ink-400" for="c-notes">{$t('customers.notes')}</label>
			<textarea id="c-notes" rows="2" bind:value={form.notes}></textarea>
		</div>
	</div>

	{#snippet footer()}
		<button class="btn btn-ghost" onclick={close} disabled={saving}>{$t('common.cancel')}</button>
		<button class="btn btn-primary" onclick={save} disabled={saving || !form.name.trim()}>
			{saving ? '…' : $t('common.save')}
		</button>
	{/snippet}
</Modal>

<Modal
	open={viewing !== null}
	title={viewing?.name ?? ''}
	subtitle={viewing?.phone ?? ''}
	onclose={() => (viewing = null)}
	width="max-w-lg"
>
	{#if viewing}
		{@const stats = statsOf(viewing)}
		<div class="grid grid-cols-3 gap-2">
			<div class="card p-3 text-center">
				<p class="text-lg font-semibold tabular-nums">{stats.count}</p>
				<p class="text-[11px] text-ink-500">{$t('customers.visits')}</p>
			</div>
			<div class="card p-3 text-center">
				<p class="text-lg font-semibold tabular-nums text-brass-400">{formatIDR(stats.spent)}</p>
				<p class="text-[11px] text-ink-500">{$t('customers.totalSpent')}</p>
			</div>
			<div class="card p-3 text-center">
				<p class="text-lg font-semibold tabular-nums">{stats.count > 0 ? formatIDR(Math.round(stats.spent / stats.count)) : '—'}</p>
				<p class="text-[11px] text-ink-500">{$t('dashboard.averageTicket')}</p>
			</div>
		</div>

		{#if viewing.notes}
			<p class="mt-3 rounded-lg bg-ink-800 px-3 py-2 text-sm text-ink-300">{viewing.notes}</p>
		{/if}

		<h3 class="mt-4 mb-2 text-xs font-semibold tracking-wide text-ink-400 uppercase">
			{$t('dashboard.recentSales')}
		</h3>
		{@const history = filterSales($sales, { branchIds: visibleBranchIds })
			.filter((s) =>
				s.customerId === viewing!.id ||
				(viewing!.phone && s.customerPhone === viewing!.phone) ||
				s.customerName.toLowerCase() === viewing!.name.toLowerCase()
			)
			.sort((a, b) => b.soldAt.localeCompare(a.soldAt))
			.slice(0, 8)}
		{#if history.length === 0}
			<EmptyState icon="◔" title={$t('reports.noData')} />
		{:else}
			<ul class="divide-y divide-ink-800 rounded-lg border border-ink-700">
				{#each history as sale (sale.id)}
					<li class="flex items-center gap-3 px-3 py-2 text-sm">
						<div class="min-w-0 flex-1">
							<p class="truncate text-xs text-ink-400">{sale.lines.map((l) => l.name).join(', ')}</p>
							<p class="text-[11px] text-ink-500">{sale.receiptNo}</p>
						</div>
						<span class="shrink-0 text-xs tabular-nums text-ink-500">{formatDate(sale.soldAt, $intlLocale)}</span>
						<span class="w-24 shrink-0 text-right text-sm font-semibold tabular-nums">{formatIDR(sale.total)}</span>
					</li>
				{/each}
			</ul>
		{/if}
	{/if}

	{#snippet footer()}
		<button class="btn btn-ghost" onclick={() => (viewing = null)}>{$t('common.close')}</button>
	{/snippet}
</Modal>