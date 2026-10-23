<script lang="ts">
	import { categories, items, staff } from '#lib/data/cache';
	import { repo } from '#lib/data/index';
	import { canManageCatalog, activeBranchId, session } from '#lib/stores/session.svelte';
	import { recordStockCount } from '#lib/domain/sales';
	import Icon from '#lib/components/Icon.svelte';
	import Modal from '#lib/components/Modal.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import { t } from '#lib/i18n';
	import { formatDuration, formatIDR, uid } from '#lib/utils/format';
	import type { Item, ItemType } from '#lib/types/domain';

	let tab = $state<ItemType>('service');
	let query = $state('');
	let editing = $state<Item | null>(null);
	let creating = $state(false);
	let saving = $state(false);

	// Draft form state
	let form = $state({
		name: '',
		categoryId: '' as string | null,
		price: 0,
		durationMin: 30,
		commissionPct: 40,
		sku: '',
		barcode: '',
		costPrice: 0,
		stock: 0,
		lowStockThreshold: 5,
		active: true
	});

	const visible = $derived(
		$items
			.filter((i) => i.type === tab)
			.filter((i) => (query.trim() === '' ? true : i.name.toLowerCase().includes(query.toLowerCase())))
			.sort((a, b) => a.name.localeCompare(b.name))
	);

	const kindCategories = $derived(
		$categories.filter((c) => c.kind === tab).sort((a, b) => a.sortOrder - b.sortOrder)
	);

	const grossMargin = $derived(
		editing?.type === 'product' && editing.price > 0
			? Math.round(((editing.price - (editing.costPrice ?? 0)) / editing.price) * 100)
			: null
	);

	function openCreate() {
		form = {
			name: '',
			categoryId: kindCategories[0]?.id ?? null,
			price: 0,
			durationMin: 30,
			commissionPct: 40,
			sku: '',
			barcode: '',
			costPrice: 0,
			stock: 0,
			lowStockThreshold: 5,
			active: true
		};
		editing = null;
		creating = true;
	}

	function openEdit(item: Item) {
		form = {
			name: item.name,
			categoryId: item.categoryId,
			price: item.price,
			durationMin: item.durationMin ?? 30,
			commissionPct: item.commissionPct ?? 40,
			sku: item.sku ?? '',
			barcode: item.barcode ?? '',
			costPrice: item.costPrice ?? 0,
			stock: item.stock ?? 0,
			lowStockThreshold: item.lowStockThreshold ?? 5,
			active: item.active
		};
		editing = item;
		creating = false;
	}

	function close() {
		editing = null;
		creating = false;
	}

	async function save() {
		if (!form.name.trim() || form.price <= 0) return;
		saving = true;
		try {
			const base: Item = editing ?? {
				id: uid('i_'),
				type: tab,
				name: '',
				categoryId: null,
				price: 0,
				active: true
			};

			const item: Item =
				base.type === 'service'
					? {
							...base,
							name: form.name.trim(),
							categoryId: form.categoryId,
							price: form.price,
							durationMin: form.durationMin,
							commissionPct: form.commissionPct,
							active: form.active
						}
					: {
							...base,
							name: form.name.trim(),
							categoryId: form.categoryId,
							price: form.price,
							sku: form.sku.trim() || undefined,
							barcode: form.barcode.trim() || undefined,
							costPrice: form.costPrice,
							stock: form.stock,
							lowStockThreshold: form.lowStockThreshold,
							active: form.active
						};

			await repo.saveItem(item);
			close();
		} finally {
			saving = false;
		}
	}

	async function remove(item: Item) {
		await repo.deleteItem(item.id);
		if (editing?.id === item.id) close();
	}

	async function setStock(item: Item, value: number) {
		if (!$activeBranchId || !$session.staff) return;
		await recordStockCount(item.id, $activeBranchId, Math.max(0, value), $session.staff.id);
	}

	async function toggleActive(item: Item) {
		await repo.saveItem({ ...item, active: !item.active });
	}
</script>

<div class="space-y-4 p-4 sm:p-6">
	<div class="flex flex-wrap items-center justify-between gap-3">
		<div>
			<h1 class="text-xl font-semibold">{$t('catalog.title')}</h1>
			<p class="text-sm text-ink-400">{visible.length} {$t('common.items')}</p>
		</div>
		{#if $canManageCatalog}
			<button class="btn btn-primary" onclick={openCreate}>
				<Icon name="plus" size={16} />
				{tab === 'service' ? $t('catalog.newService') : $t('catalog.newProduct')}
			</button>
		{/if}
	</div>

	<div class="flex flex-wrap gap-2">
		<div class="flex overflow-hidden rounded-lg border border-ink-600">
			<button
				class="px-4 py-1.5 text-sm font-medium"
				class:bg-ink-700={tab === 'service'}
				class:text-brass-400={tab === 'service'}
				class:text-ink-400={tab !== 'service'}
				onclick={() => (tab = 'service')}
			>
				{$t('catalog.services')}
			</button>
			<button
				class="px-4 py-1.5 text-sm font-medium"
				class:bg-ink-700={tab === 'product'}
				class:text-brass-400={tab === 'product'}
				class:text-ink-400={tab !== 'product'}
				onclick={() => (tab = 'product')}
			>
				{$t('catalog.products')}
			</button>
		</div>
		<div class="relative min-w-48 flex-1">
			<Icon name="search" size={16} class="absolute top-1/2 left-3 -translate-y-1/2 text-ink-500" />
			<input class="!py-1.5 !pl-9 text-sm" placeholder={$t('common.search')} bind:value={query} />
		</div>
	</div>

	{#if visible.length === 0}
		<EmptyState icon="⌕" title={$t('catalog.noResults')} />
	{:else}
		<div class="card overflow-hidden">
			<table class="w-full text-sm">
				<thead class="border-b border-ink-700 bg-ink-800/50 text-left text-xs tracking-wide text-ink-400 uppercase">
					<tr>
						<th class="px-4 py-2.5 font-medium">{$t('common.name')}</th>
						<th class="hidden px-4 py-2.5 font-medium sm:table-cell">{$t('catalog.category')}</th>
						{#if tab === 'service'}
							<th class="px-4 py-2.5 font-medium">{$t('catalog.duration')}</th>
							<th class="px-4 py-2.5 font-medium">{$t('catalog.commission')}</th>
						{:else}
							<th class="px-4 py-2.5 font-medium">{$t('catalog.stock')}</th>
							<th class="hidden px-4 py-2.5 font-medium md:table-cell">{$t('catalog.costPrice')}</th>
							<th class="hidden px-4 py-2.5 font-medium lg:table-cell">SKU</th>
						{/if}
						<th class="px-4 py-2.5 text-right font-medium">{$t('common.price')}</th>
						{#if $canManageCatalog}
							<th class="w-24 px-4 py-2.5"></th>
						{/if}
					</tr>
				</thead>
				<tbody class="divide-y divide-ink-800">
					{#each visible as item (item.id)}
						<tr class="transition hover:bg-ink-850" class:opacity-50={!item.active}>
							<td class="px-4 py-2.5">
								<p class="font-medium">{item.name}</p>
								{#if !item.active}
									<span class="badge mt-0.5 bg-ink-700 text-ink-400">{$t('common.inactive')}</span>
								{/if}
							</td>
							<td class="hidden px-4 py-2.5 text-ink-400 sm:table-cell">
								{$categories.find((c) => c.id === item.categoryId)?.name ?? '—'}
							</td>
							{#if tab === 'service'}
								<td class="px-4 py-2.5 text-ink-400">{formatDuration(item.durationMin ?? 0)}</td>
								<td class="px-4 py-2.5 text-ink-400">{item.commissionPct ?? 0}%</td>
							{:else}
								<td class="px-4 py-2.5">
									{#if $canManageCatalog}
										<input
											type="number"
											min="0"
											class="!w-20 !py-1 text-sm tabular-nums"
											class:text-rust-400={(item.stock ?? 0) <= 0}
											class:text-brass-400={(item.stock ?? 0) > 0 && (item.stock ?? 0) <= (item.lowStockThreshold ?? 5)}
											value={item.stock ?? 0}
											onchange={(e) => setStock(item, Number(e.currentTarget.value))}
										/>
									{:else}
										<span class="tabular-nums">{item.stock ?? 0}</span>
									{/if}
								</td>
								<td class="hidden px-4 py-2.5 text-ink-400 tabular-nums md:table-cell">{formatIDR(item.costPrice ?? 0)}</td>
								<td class="hidden px-4 py-2.5 font-mono text-xs text-ink-500 lg:table-cell">{item.sku ?? '—'}</td>
							{/if}
							<td class="px-4 py-2.5 text-right font-semibold tabular-nums">{formatIDR(item.price)}</td>
							{#if $canManageCatalog}
								<td class="px-4 py-2.5">
									<div class="flex justify-end gap-1">
										<button class="p-1.5 text-ink-500 hover:text-brass-400" onclick={() => openEdit(item)} title={$t('common.edit')}>
											<Icon name="edit" size={15} />
										</button>
										<button class="p-1.5 text-ink-500 hover:text-ink-200" onclick={() => toggleActive(item)} title={item.active ? $t('common.inactive') : $t('common.active')}>
											<Icon name="check" size={15} />
										</button>
										<button class="p-1.5 text-ink-600 hover:text-rust-400" onclick={() => remove(item)} title={$t('common.delete')}>
											<Icon name="trash" size={15} />
										</button>
									</div>
								</td>
							{/if}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

<Modal
	open={creating || editing !== null}
	title={editing ? $t('common.edit') : tab === 'service' ? $t('catalog.newService') : $t('catalog.newProduct')}
	subtitle={editing?.name ?? ''}
	onclose={close}
>
	<div class="space-y-3">
		<div>
			<label class="mb-1 block text-xs font-medium text-ink-400" for="f-name">{$t('common.name')}</label>
			<input id="f-name" bind:value={form.name} placeholder={tab === 'service' ? 'Potong Rambut Pria' : 'Pomade Rambut 100ml'} />
		</div>

		{#if kindCategories.length > 0}
			<div>
				<label class="mb-1 block text-xs font-medium text-ink-400" for="f-cat">{$t('catalog.category')}</label>
				<select id="f-cat" bind:value={form.categoryId}>
					<option value={null}>—</option>
					{#each kindCategories as category (category.id)}
						<option value={category.id}>{category.name}</option>
					{/each}
				</select>
			</div>
		{/if}

		<div class="grid gap-3 sm:grid-cols-2">
			<div>
				<label class="mb-1 block text-xs font-medium text-ink-400" for="f-price">{$t('common.price')} (Rp)</label>
				<input id="f-price" type="number" min="0" step="500" bind:value={form.price} />
			</div>
			{#if tab === 'service'}
				<div>
					<label class="mb-1 block text-xs font-medium text-ink-400" for="f-dur">{$t('catalog.durationMin')}</label>
					<input id="f-dur" type="number" min="5" step="5" bind:value={form.durationMin} />
				</div>
			{:else}
				<div>
					<label class="mb-1 block text-xs font-medium text-ink-400" for="f-stock">{$t('catalog.stock')}</label>
					<input id="f-stock" type="number" min="0" bind:value={form.stock} />
				</div>
			{/if}
		</div>

		{#if tab === 'service'}
			<div>
				<label class="mb-1 block text-xs font-medium text-ink-400" for="f-comm">
					{$t('catalog.commission')} <span class="text-ink-600">({$t('common.optional')})</span>
				</label>
				<input id="f-comm" type="number" min="0" max="100" bind:value={form.commissionPct} />
				<p class="mt-1 text-xs text-ink-500">
					{formatIDR(Math.floor((form.price * form.commissionPct) / 100))} / {$t('common.items')}
				</p>
			</div>
		{:else}
			<div class="grid gap-3 sm:grid-cols-2">
				<div>
					<label class="mb-1 block text-xs font-medium text-ink-400" for="f-cost">{$t('catalog.costPrice')} (Rp)</label>
					<input id="f-cost" type="number" min="0" step="500" bind:value={form.costPrice} />
				</div>
				<div>
					<label class="mb-1 block text-xs font-medium text-ink-400" for="f-low">{$t('catalog.lowStockThreshold')}</label>
					<input id="f-low" type="number" min="0" bind:value={form.lowStockThreshold} />
				</div>
			</div>
			<div class="grid gap-3 sm:grid-cols-2">
				<div>
					<label class="mb-1 block text-xs font-medium text-ink-400" for="f-sku">{$t('catalog.sku')}</label>
					<input id="f-sku" class="font-mono text-sm" bind:value={form.sku} placeholder="POM-100" />
				</div>
				<div>
					<label class="mb-1 block text-xs font-medium text-ink-400" for="f-bar">{$t('catalog.barcode')}</label>
					<input id="f-bar" class="font-mono text-sm" bind:value={form.barcode} placeholder="8991002101017" />
				</div>
			</div>
			{#if form.price > 0}
				<p class="rounded-lg bg-ink-800 px-3 py-2 text-xs text-ink-400">
					Profit {formatIDR(form.price - form.costPrice)} ({Math.round(((form.price - form.costPrice) / form.price) * 100)}%)
				</p>
			{/if}
		{/if}

		<label class="flex items-center gap-2 text-sm">
			<input type="checkbox" class="!w-4 !h-4" bind:checked={form.active} />
			{$t('common.active')}
		</label>
	</div>

	{#snippet footer()}
		{#if editing}
			<button class="btn btn-danger me-auto" onclick={() => remove(editing!)} disabled={saving}>
				<Icon name="trash" size={15} /> {$t('common.delete')}
			</button>
		{/if}
		<button class="btn btn-ghost" onclick={close} disabled={saving}>{$t('common.cancel')}</button>
		<button class="btn btn-primary" onclick={save} disabled={saving || !form.name.trim() || form.price <= 0}>
			{saving ? '…' : $t('common.save')}
		</button>
	{/snippet}
</Modal>