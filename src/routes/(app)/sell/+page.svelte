<script lang="ts">
	import { goto } from '$app/navigation';
	import { barbers, branches, customers, items, categories, staff } from '#lib/data/cache';
	import { repo } from '#lib/data/index';
	import Icon from '#lib/components/Icon.svelte';
	import CheckoutDialog from '#lib/components/CheckoutDialog.svelte';
	import Modal from '#lib/components/Modal.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import Receipt from '#lib/components/Receipt.svelte';
	import { t } from '#lib/i18n';
	import { activeBranchId, currentStaff, barbersForBranch } from '#lib/stores/session.svelte';
	import {
		addToCart,
		cartLines,
		cartBarberId,
		cartCustomerName,
		cartCustomerPhone,
		cartCount,
		cartDuration,
		cartTotal,
		clearCart,
		removeLine,
		setLineBarber,
		setLineQty,
		queueDraftAppointment
	} from '#lib/stores/cart.svelte';
	import { checkout, online } from '#lib/stores/sync.svelte';
	import { branchSettings } from '#lib/data/cache';
	import { commissionAmount } from '#lib/utils/receipt';
	import { formatDuration, formatIDR } from '#lib/utils/format';
	import type { Item, Payment, Sale } from '#lib/types/domain';

	let tab = $state<'service' | 'product'>('service');
	let query = $state('');
	let checkoutOpen = $state(false);
	let paying = $state(false);
	let completedSale = $state<Sale | null>(null);

	const branchBarbers = $derived(barbersForBranch($barbers, $activeBranchId, $staff));
	const activeBranch = $derived($branches.find((b) => b.id === $activeBranchId));

	const visibleItems = $derived(
		$items
			.filter((i) => i.active && i.type === tab)
			.filter((i) => (query.trim() === '' ? true : i.name.toLowerCase().includes(query.trim().toLowerCase())))
			.sort((a, b) => a.name.localeCompare(b.name))
	);

	const categoryOf = (item: Item) => $categories.find((c) => c.id === item.categoryId)?.name ?? '';

	const cartSubtotal = $derived($cartLines.reduce((s, l) => s + l.qty * l.unitPrice - l.discount, 0));
	const cartCommission = $derived(
		$cartLines
			.filter((l) => l.type === 'service')
			.reduce((s, l) => s + commissionAmount(l.qty * l.unitPrice - l.discount, l.commissionPct ?? 0), 0)
	);

	const canAdd = $derived(tab === 'product' || $cartBarberId !== null);

	function pick(item: Item) {
		if (item.type === 'service' && !$cartBarberId) return;
		addToCart(item, $cartBarberId);
	}

	/** Matching a phone pulls in the saved name so repeat visits are one tap. */
	function onPhoneInput(value: string) {
		cartCustomerPhone.set(value);
		const digits = value.replace(/\D/g, '');
		if (digits.length < 9) return;
		const match = $customers.find((c) => c.phone?.replace(/\D/g, '') === digits);
		if (match && !$cartCustomerName) cartCustomerName.set(match.name);
	}

	async function confirmPayment(payment: Payment) {
		if (!$activeBranchId || !$currentStaff) return;
		paying = true;
		try {
			const sale = await checkout({
				branchId: $activeBranchId,
				cashierId: $currentStaff.id,
				customerName: $cartCustomerName.trim(),
				customerPhone: $cartCustomerPhone || null,
				lines: $cartLines,
				payment,
				appointmentId: $queueDraftAppointment
			});
			checkoutOpen = false;
			completedSale = sale;
			clearCart();
		} finally {
			paying = false;
		}
	}

	const stockOf = (item: Item) => item.stock ?? 0;
	const shortStock = (item: Item) => item.type === 'product' && stockOf(item) <= 0;
</script>

<div class="flex h-full flex-col lg:flex-row">
	<!-- ── Picker ─────────────────────────────────────────────── -->
	<div class="flex min-h-0 flex-1 flex-col border-b border-stone-200 lg:border-e lg:border-b-0">
		<div class="space-y-3 border-b border-stone-200 p-3 sm:p-4">
			<!-- Barber required before any service can be sold -->
			<div class="flex items-center gap-2 overflow-x-auto pb-1">
				<span class="shrink-0 text-xs font-medium tracking-wide text-ink-500 uppercase">
					{$t('sell.selectBarber')}
				</span>
				{#each branchBarbers as barber (barber.id)}
					<button
						class="btn shrink-0 px-3 py-1.5 text-xs"
						class:bg-walnut-500={$cartBarberId === barber.id}
						class:text-ink-950={$cartBarberId === barber.id}
						class:bg-ivory-200={$cartBarberId !== barber.id}
						class:text-ink-600={$cartBarberId !== barber.id}
						onclick={() => (cartBarberId.set(barber.id))}
					>
						{barber.displayName}
					</button>
				{/each}
			</div>

			<div class="flex gap-2">
				<div class="relative flex-1">
					<Icon name="search" size={16} class="absolute top-1/2 left-3 -translate-y-1/2 text-ink-500" />
					<input class="!pl-9" placeholder={$t('common.search')} bind:value={query} />
				</div>
				<div class="flex shrink-0 overflow-hidden rounded-lg border border-ink-600">
					<button
						class="px-3 text-xs font-medium"
						class:bg-ink-200={tab === 'service'}
						class:text-walnut-500={tab === 'service'}
						class:text-ink-500={tab !== 'service'}
						onclick={() => (tab = 'service')}
					>
						{$t('sell.services')}
					</button>
					<button
						class="px-3 text-xs font-medium"
						class:bg-ink-200={tab === 'product'}
						class:text-walnut-500={tab === 'product'}
						class:text-ink-500={tab !== 'product'}
						onclick={() => (tab = 'product')}
					>
						{$t('sell.products')}
					</button>
				</div>
			</div>
		</div>

		<div class="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
			{#if tab === 'service' && !$cartBarberId}
				<div class="card flex items-center gap-3 p-4 text-sm text-walnut-500">
					<Icon name="scissors" size={18} />
					{$t('sell.noBarber')}
				</div>
			{:else if visibleItems.length === 0}
				<EmptyState icon="search" title={$t('catalog.noResults')} />
			{:else}
				<div class="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
					{#each visibleItems as item (item.id)}
						<button
							class="card flex flex-col items-start gap-1.5 p-4 text-left transition-all duration-75 hover:border-walnut-500/60 active:scale-[0.97] disabled:opacity-40"
							disabled={!canAdd || shortStock(item)}
							onclick={() => pick(item)}
						>
							<span class="w-full truncate text-base font-medium">{item.name}</span>
							<span class="text-xs text-ink-500">{categoryOf(item)}</span>
							<span class="mt-1 flex w-full items-center justify-between">
								<span class="text-lg font-semibold tabular-nums text-walnut-500">{formatIDR(item.price)}</span>
								{#if item.type === 'service'}
									<span class="text-[11px] text-ink-500">{formatDuration(item.durationMin ?? 0)}</span>
								{:else if shortStock(item)}
									<span class="badge bg-red-600/20 text-red-400">{$t('catalog.outOfStock')}</span>
								{:else if stockOf(item) <= (item.lowStockThreshold ?? 5)}
									<span class="badge bg-amber-600/20 text-amber-400">{$t('catalog.lowStock')} {stockOf(item)}</span>
								{/if}
							</span>
						</button>
					{/each}
				</div>
			{/if}
		</div>
	</div>

	<!-- ── Cart ──────────────────────────────────────────────── -->
	<aside class="flex max-h-[45dvh] shrink-0 flex-col bg-paper lg:max-h-none lg:w-[26rem]">
		<div class="flex items-center justify-between border-b border-stone-200 px-4 py-3">
			<div class="flex items-center gap-2">
				<h2 class="text-sm font-semibold">{$t('nav.sell')}</h2>
				{#if $cartCount > 0}
					<span class="badge bg-ink-200 text-ink-600">{$cartCount}</span>
				{/if}
			</div>
			{#if $cartCount > 0}
				<button class="text-xs text-ink-500 hover:text-red-400" onclick={clearCart}>{$t('sell.clearCart')}</button>
			{/if}
		</div>

		<!-- Customer -->
		<div class="space-y-2 border-b border-stone-200 p-3">
			<input
				placeholder={$t('sell.customerName')}
				bind:value={$cartCustomerName}
				autocomplete="name"
			/>
			<input
				placeholder={$t('sell.customerPhone')}
				value={$cartCustomerPhone ?? ''}
				oninput={(e) => onPhoneInput(e.currentTarget.value)}
				inputmode="tel"
				autocomplete="tel"
			/>
		</div>

		<!-- Lines -->
		<div class="min-h-24 flex-1 overflow-y-auto">
			{#if $cartLines.length === 0}
				<EmptyState icon="cart" title={$t('sell.cartEmpty')} hint={$t('sell.cartEmptyHint')} />
			{:else}
				<ul class="divide-y divide-stone-200">
					{#each $cartLines as line (line.key)}
						<li class="p-3">
							<div class="flex items-start justify-between gap-2">
								<div class="min-w-0">
									<p class="truncate text-sm font-medium">{line.name}</p>
									<p class="text-xs text-ink-500">
										{formatIDR(line.unitPrice)} × {line.qty}
										{#if line.type === 'service' && line.durationMin}
											· {formatDuration(line.durationMin * line.qty)}
										{/if}
									</p>
									{#if line.type === 'service'}
										<div class="mt-1.5 flex items-center gap-1.5">
											<select
												class="!w-auto !py-0.5 text-[11px]"
												value={line.barberId ?? ''}
												onchange={(e) => setLineBarber(line.key, e.currentTarget.value)}
											>
												{#each branchBarbers as barber (barber.id)}
													<option value={barber.id}>{barber.displayName}</option>
												{/each}
											</select>
											<span class="text-[11px] text-ink-500">
												{formatIDR(commissionAmount(line.qty * line.unitPrice - line.discount, line.commissionPct ?? 0))}
											</span>
										</div>
									{/if}
								</div>
								<div class="flex shrink-0 items-center gap-1">
									<button class="btn btn-ghost size-7 p-0 text-sm" onclick={() => setLineQty(line.key, line.qty - 1)}>−</button>
									<span class="w-6 text-center text-sm tabular-nums">{line.qty}</span>
									<button class="btn btn-ghost size-7 p-0 text-sm" onclick={() => setLineQty(line.key, line.qty + 1)}>+</button>
									<span class="w-24 text-right text-sm font-semibold tabular-nums">
										{formatIDR(line.qty * line.unitPrice - line.discount)}
									</span>
									<button class="p-1 text-ink-600 hover:text-red-400" onclick={() => removeLine(line.key)} aria-label={$t('common.delete')}>
										<Icon name="trash" size={14} />
									</button>
								</div>
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</div>

		<!-- Totals + pay -->
		<div class="border-t border-stone-200 p-3">
			{#if $cartDuration > 0}
				<div class="mb-2 flex justify-between text-xs text-ink-500">
					<span>{$t('catalog.duration')}</span><span>{formatDuration($cartDuration)}</span>
				</div>
			{/if}
			{#if cartCommission > 0}
				<div class="mb-2 flex justify-between text-xs text-ink-500">
					<span>{$t('sell.commission')}</span><span>{formatIDR(cartCommission)}</span>
				</div>
			{/if}

			<div class="mb-3 flex items-end justify-between">
				<span class="text-xs tracking-wide text-ink-500 uppercase">{$t('common.total')}</span>
				<span class="text-2xl font-semibold tabular-nums text-walnut-500">{formatIDR($cartTotal)}</span>
			</div>

			{#if !$online}
				<p class="mb-2 flex items-center gap-1.5 text-[11px] text-walnut-500">
					<Icon name="offline" size={13} /> {$t('settings.offline')} · {$t('settings.pendingSales')}
				</p>
			{/if}

			<button
				class="btn btn-primary h-12 w-full text-base"
				disabled={$cartLines.length === 0 || $cartCustomerName.trim() === ''}
				onclick={() => (checkoutOpen = true)}
			>
				{$t('sell.checkout')} → {$t('common.total')} {formatIDR($cartTotal)}
			</button>
			{#if $cartCustomerName.trim() === '' && $cartLines.length > 0}
				<p class="mt-1.5 text-center text-[11px] text-ink-500">{$t('customers.nameRequired')}</p>
			{/if}
		</div>
	</aside>
</div>

<CheckoutDialog
	open={checkoutOpen}
	total={$cartTotal}
	customerName={$cartCustomerName}
	loading={paying}
	onclose={() => (checkoutOpen = false)}
	onconfirm={confirmPayment}
/>

<Modal
	open={completedSale !== null}
	title={$t('sell.completeSale')}
	subtitle={completedSale?.receiptNo}
	onclose={() => (completedSale = null)}
	width="max-w-md"
>
	{#if completedSale}
		{@const sale = completedSale}
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
		<button class="btn btn-ghost" onclick={() => (completedSale = null)}>{$t('common.close')}</button>
		<button class="btn btn-primary" onclick={() => { completedSale = null; }}>
			{$t('sell.newSale')}
		</button>
	{/snippet}
</Modal>