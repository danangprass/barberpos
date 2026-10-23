<script lang="ts">
	import type { Barber, Branch, BranchSettings, Sale, Staff } from '#lib/types/domain';
	import { formatDateTime, formatIDR } from '#lib/utils/format';
	import { t } from '#lib/i18n';
	import Icon from './Icon.svelte';

	let {
		sale,
		branch,
		settings,
		cashier,
		barbers,
		staff
	}: {
		sale: Sale;
		branch: Branch | undefined;
		settings: BranchSettings | null;
		cashier: Staff | undefined;
		barbers: Barber[];
		staff: Staff[];
	} = $props();

	const barberName = (id?: string) => {
		if (!id) return '—';
		return barbers.find((b) => b.id === id)?.displayName ?? '—';
	};

	const cashierName = $derived(cashier?.displayName ?? staff.find((s) => s.id === sale.cashierId)?.displayName ?? '—');

	const subtotal = $derived(sale.lines.reduce((s, l) => s + l.qty * l.unitPrice, 0));
	const wasResynced = $derived(
		sale.provisionalReceiptNo !== null && sale.provisionalReceiptNo !== sale.receiptNo
	);

	function print() {
		window.print();
	}
</script>

<div class="flex flex-col items-center gap-3">
	<div
		class="receipt-paper w-[58mm] px-3 py-4 text-[11px] leading-[1.45] shadow-xl"
		id="receipt-paper"
	>
		{#if settings?.receiptHeader}
			<pre class="mb-2 text-center text-[10px] leading-tight whitespace-pre-wrap">{settings.receiptHeader}</pre>
		{:else if branch}
			<p class="mb-2 text-center font-bold uppercase">{branch.name}</p>
			<p class="mb-2 text-center text-[10px]">{branch.address}</p>
		{/if}

		<div class="mb-2 border-y border-dashed border-black/30 py-1.5 text-[10px]">
			<div class="flex justify-between"><span>{$t('reports.saleNo')}</span><span>{sale.receiptNo}</span></div>
			<div class="flex justify-between"><span>Waktu</span><span>{formatDateTime(sale.soldAt)}</span></div>
			<div class="flex justify-between"><span>Kasir</span><span>{cashierName}</span></div>
			<div class="flex justify-between"><span>Nasabah</span><span>{sale.customerName}</span></div>
			{#if sale.customerPhone}
				<div class="flex justify-between"><span>Telp</span><span>{sale.customerPhone}</span></div>
			{/if}
		</div>

		<table class="w-full text-[10px]">
			<tbody>
				{#each sale.lines as line (line.itemId + (line.barberId ?? ''))}
					<tr>
						<td class="align-top pb-1">
							<div>{line.name}</div>
							{#if line.type === 'service' && line.barberId}
								<div class="text-black/60">→ {barberName(line.barberId)}</div>
							{/if}
							<div class="text-black/60">{line.qty} × {formatIDR(line.unitPrice)}</div>
						</td>
						<td class="pb-1 text-right align-top whitespace-nowrap">{formatIDR(line.lineTotal)}</td>
					</tr>
				{/each}
			</tbody>
		</table>

		<div class="mt-1 border-t border-dashed border-black/30 pt-1.5 text-[11px]">
			<div class="flex justify-between"><span>Subtotal</span><span>{formatIDR(subtotal)}</span></div>
			{#if sale.discount > 0}
				<div class="flex justify-between"><span>Diskon</span><span>-{formatIDR(sale.discount)}</span></div>
			{/if}
			<div class="mt-1 flex justify-between text-[13px] font-bold">
				<span>TOTAL</span><span>{formatIDR(sale.total)}</span>
			</div>
		</div>

		<div class="mt-2 border-t border-dashed border-black/30 pt-1.5 text-[10px]">
			{#if sale.payment.method === 'cash'}
				<div class="flex justify-between"><span>Tunai</span><span>{formatIDR(sale.payment.amountTendered)}</span></div>
				{#if sale.payment.change > 0}
					<div class="flex justify-between"><span>Kembalian</span><span>{formatIDR(sale.payment.change)}</span></div>
				{/if}
			{:else}
				<div class="flex justify-between"><span>QRIS</span><span>{formatIDR(sale.payment.amountTendered)}</span></div>
				{#if sale.payment.qrisRef}
					<div class="flex justify-between"><span>Ref</span><span>{sale.payment.qrisRef}</span></div>
				{/if}
			{/if}
		</div>

		{#if wasResynced}
			<p class="mt-2 border-t border-dashed border-black/30 pt-1.5 text-center text-[9px] leading-tight">
				{$t('receipt.resyncNotice')}<br />{sale.provisionalReceiptNo}
			</p>
		{:else if sale.syncState === 'pending_sync'}
			<p class="mt-2 border-t border-dashed border-black/30 pt-1.5 text-center text-[9px] leading-tight">
				{$t('receipt.offlineNotice')}
			</p>
		{/if}

		{#if settings?.receiptFooter}
			<pre class="mt-2 text-center text-[10px] leading-tight whitespace-pre-wrap">{settings.receiptFooter}</pre>
		{/if}
	</div>

	<button class="btn btn-primary" onclick={print}><Icon name="printer" size={14} /> {$t('sell.printReceipt')}</button>
</div>

<style>
	@media print {
		:global(body *) {
			visibility: hidden;
		}
		#receipt-paper,
		#receipt-paper * {
			visibility: visible;
		}
		#receipt-paper {
			position: absolute;
			left: 0;
			top: 0;
			width: 58mm;
			box-shadow: none;
		}
		@page {
			size: 58mm auto;
			margin: 4mm;
		}
	}
</style>