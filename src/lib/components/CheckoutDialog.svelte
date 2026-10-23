<script lang="ts">
	import Modal from './Modal.svelte';
	import Icon from './Icon.svelte';
	import { t } from '#lib/i18n';
	import { formatIDR } from '#lib/utils/format';
	import type { Payment, PaymentMethod, Rupiah } from '#lib/types/domain';

	let {
		open,
		total,
		customerName,
		loading = false,
		onclose,
		onconfirm
	}: {
		open: boolean;
		total: Rupiah;
		customerName: string;
		loading?: boolean;
		onclose: () => void;
		onconfirm: (payment: Payment) => void;
	} = $props();

	let method = $state<PaymentMethod>('cash');
	let tendered = $state<Rupiah>(0);
	let qrisRef = $state('');
	let refError = $state(false);

	// Sensible default: exact amount, then jump to the next common note.
	const QUICK = [20000, 50000, 100000, 150000, 200000, 500000];

	const change = $derived(Math.max(0, tendered - total));
	const exact = $derived(tendered === total);
	const canConfirm = $derived(
		tendered >= total && (method === 'cash' || qrisRef.trim().length > 0)
	);

	$effect(() => {
		if (!open) return;
		method = 'cash';
		tendered = total;
		qrisRef = '';
		refError = false;
	});

	function chooseCash(amount: Rupiah) {
		tendered = amount;
	}

	function onKeydown(event: KeyboardEvent) {
		if (!open) return;
		if (event.key >= '0' && event.key <= '9') {
			tendered = tendered * 10 + Number(event.key);
		} else if (event.key === 'Backspace') {
			tendered = Math.floor(tendered / 10);
		} else if (event.key === 'Enter' && canConfirm) {
			confirm();
		}
	}

	function confirm() {
		if (!canConfirm) {
			if (method === 'qris' && qrisRef.trim().length === 0) refError = true;
			return;
		}
		onconfirm({
			method,
			amountTendered: method === 'cash' ? tendered : total,
			change: method === 'cash' ? change : 0,
			qrisRef: method === 'qris' ? qrisRef.trim() : null
		});
	}
</script>

<svelte:window onkeydown={onKeydown} />

<Modal {open} title={$t('sell.checkout')} subtitle={customerName} {onclose} width="max-w-lg">
	<div class="mb-6 overflow-hidden rounded-xl border border-barber-red-900/40 bg-ink-800 px-6 py-4 text-center">
		<p class="text-xs tracking-wide text-ink-400 uppercase">{$t('common.total')}</p>
		<p class="mt-1 text-4xl font-bold tabular-nums text-barber-red-400">{formatIDR(total)}</p>
	</div>

	<div class="mb-6 grid grid-cols-2 gap-3">
		<button
			class="card flex h-16 cursor-pointer flex-col items-center justify-center gap-2 p-4 text-center transition-all duration-75 active:scale-95"
			class:bg-barber-red-600={method === 'cash'}
			class:text-ink-950={method === 'cash'}
			class:border-barber-red-500={method === 'cash'}
			class:bg-ink-800={method !== 'cash'}
			class:border-ink-700={method !== 'cash'}
			class:text-ink-300={method !== 'cash'}
			onclick={() => (method = 'cash')}
		>
			<Icon name="money" size={20} />
			<span class="text-sm font-medium">{$t('sell.cash')}</span>
		</button>
		<button
			class="card flex h-16 cursor-pointer flex-col items-center justify-center gap-2 p-4 text-center transition-all duration-75 active:scale-95"
			class:bg-barber-red-600={method === 'qris'}
			class:text-ink-950={method === 'qris'}
			class:border-barber-red-500={method === 'qris'}
			class:bg-ink-800={method !== 'qris'}
			class:border-ink-700={method !== 'qris'}
			class:text-ink-300={method !== 'qris'}
			onclick={() => (method = 'qris')}
		>
			<Icon name="smartphone" size={20} />
			<span class="text-sm font-medium">{$t('sell.qris')}</span>
		</button>
	</div>

	{#if method === 'cash'}
		<p class="mb-2 text-xs font-medium tracking-wide text-ink-400 uppercase">{$t('sell.quickCash')}</p>
		<div class="mb-3 grid grid-cols-3 gap-2">
			{#each QUICK as amount (amount)}
				<button
					class="btn btn-ghost h-11 text-sm"
					class:border-barber-red-500={tendered === amount}
					class:text-barber-red-400={tendered === amount}
					onclick={() => chooseCash(amount)}
				>
					{formatIDR(amount)}
				</button>
			{/each}
		</div>

		<button
			class="btn btn-ghost w-full"
			class:border-barber-red-500={exact}
			class:text-barber-red-400={exact}
			onclick={() => (tendered = total)}
		>
			{$t('common.total')}: {formatIDR(total)}
		</button>

		<div class="mt-4 flex items-center justify-between rounded-xl bg-ink-800 px-4 py-3">
			<span class="text-sm text-ink-400">{$t('sell.change')}</span>
			<span class="text-xl font-semibold tabular-nums" class:text-jade-400={change > 0} class:text-ink-300={change === 0}>
				{formatIDR(change)}
			</span>
		</div>

		{#if tendered < total}
			<p class="mt-2 text-xs text-rust-400">
				{$t('sell.quickCash')}: {formatIDR(tendered)} · {$t('common.total')}: {formatIDR(total)}
			</p>
		{/if}
	{:else}
		<label class="mb-1 block text-xs font-medium tracking-wide text-ink-400 uppercase" for="qris-ref">
			{$t('sell.qrisRef')} <span class="text-ink-600 normal-case">({$t('common.optional')})</span>
		</label>
		<input
			id="qris-ref"
			class="font-mono"
			placeholder="QR123456789"
			bind:value={qrisRef}
			oninput={() => (refError = false)}
		/>
		{#if refError}
			<p class="mt-2 text-xs text-rust-400">{$t('sell.qrisRef')} *</p>
		{/if}
		<p class="mt-4 rounded-lg bg-ink-800 px-3 py-2.5 text-xs leading-relaxed text-ink-400">
			{$t('sell.qrisHelp')}
		</p>
	{/if}

	{#snippet footer()}
		<button class="btn btn-ghost" onclick={onclose} disabled={loading}>{$t('common.cancel')}</button>
		<button class="btn btn-primary min-w-32" onclick={confirm} disabled={!canConfirm || loading}>
			{loading ? '…' : $t('sell.completeSale')}
		</button>
	{/snippet}
</Modal>