<script lang="ts">
	import { goto } from '$app/navigation';
	import { appointments, barbers, branches, items, staff } from '#lib/data/cache';
	import { repo } from '#lib/data/index';
	import Icon from '#lib/components/Icon.svelte';
	import Modal from '#lib/components/Modal.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import { t } from '#lib/i18n';
	import { activeBranchId, barbersForBranch, session } from '#lib/stores/session.svelte';
	import { loadFromAppointment, clearCart } from '#lib/stores/cart.svelte';
	import { addMinutes, dayKey, formatDuration, formatIDR, formatTime, uid } from '#lib/utils/format';
	import {
		businessDayKey,
		businessDayOffset,
		businessInstant,
		businessMinutesOfDay,
		fromBusinessInputValue,
		toBusinessInputValue
	} from '#shared/time';
	import type { Appointment, AppointmentStatus, Item } from '#lib/types/domain';
	import type { MessageKey } from '#lib/i18n/messages';

	let view = $state<'board' | 'schedule'>('board');
	let date = $state(businessDayKey(new Date()));

	let dialog = $state<null | 'new' | 'walkin'>(null);
	let saving = $state(false);

	let form = $state({
		customerName: '',
		customerPhone: '' as string | null,
		barberId: '' as string | null,
		serviceIds: [] as string[],
		scheduledAt: '',
		notes: ''
	});

	const branchBarbers = $derived(barbersForBranch($barbers, $activeBranchId, $staff));
	const activeBranch = $derived($branches.find((b) => b.id === $activeBranchId));

	const services = $derived($items.filter((i) => i.type === 'service' && i.active));

	const branchAppointments = $derived(
		$appointments
			.filter((a) => a.branchId === $activeBranchId)
			.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
	);

	const dayAppointments = $derived(branchAppointments.filter((a) => dayKey(a.scheduledAt) === date));
	const liveAppointments = $derived(
		dayAppointments.filter((a) => !['cancelled', 'no_show', 'done'].includes(a.status))
	);

	const COLUMNS: Array<{ status: AppointmentStatus; label: MessageKey; dot: string }> = [
		{ status: 'booked', label: 'queue.status.booked', dot: 'bg-ink-500' },
		{ status: 'arrived', label: 'queue.status.arrived', dot: 'bg-amber-400' },
		{ status: 'queued', label: 'queue.status.queued', dot: 'bg-amber-500' },
		{ status: 'in_service', label: 'queue.status.in_service', dot: 'bg-sage-400' }
	];

	const inColumn = (status: AppointmentStatus) => liveAppointments.filter((a) => a.status === status);
	const doneToday = $derived(dayAppointments.filter((a) => a.status === 'done'));

	const serviceNames = (apt: Appointment) =>
		$items
			.filter((i) => apt.serviceIds.includes(i.id))
			.map((i) => i.name)
			.join(', ');

	const barberName = (id: string) => $barbers.find((b) => b.id === id)?.displayName ?? '—';

	const priceOf = (apt: Appointment) =>
		$items
			.filter((i) => apt.serviceIds.includes(i.id))
			.reduce((sum, i) => sum + i.price, 0);

	function resetForm() {
		form = {
			customerName: '',
			customerPhone: null,
			barberId: branchBarbers[0]?.id ?? null,
			serviceIds: [],
			scheduledAt: defaultSlot(),
			notes: ''
		};
	}

	/** Next half-hour boundary, which is how the shop actually books walk-ins. */
	function defaultSlot(): string {
		const now = new Date();
		const rounded = Math.ceil((businessMinutesOfDay(now) + 5) / 30) * 30;
		// A slot past midnight belongs to the next shop day, not the same one.
		if (rounded < 1440) return toBusinessInputValue(businessInstant(businessDayKey(now), rounded));
		return toBusinessInputValue(businessInstant(businessDayOffset(now, 1), rounded - 1440));
	}

	function openNew() {
		resetForm();
		dialog = 'new';
	}

	function openWalkin() {
		resetForm();
		form.scheduledAt = toBusinessInputValue(new Date());
		dialog = 'walkin';
	}

	function toggleService(id: string) {
		form.serviceIds = form.serviceIds.includes(id)
			? form.serviceIds.filter((s) => s !== id)
			: [...form.serviceIds, id];
	}

	const formDuration = $derived(
		services.filter((s) => form.serviceIds.includes(s.id)).reduce((sum, s) => sum + (s.durationMin ?? 0), 0)
	);

	const formTotal = $derived(
		services.filter((s) => form.serviceIds.includes(s.id)).reduce((sum, s) => sum + s.price, 0)
	);

	async function save() {
		if (!form.customerName.trim() || !form.barberId) return;
		const mode = dialog;
		saving = true;
		try {
			const appointment: Appointment = {
				id: uid('apt_'),
				branchId: $activeBranchId!,
				customerName: form.customerName.trim(),
				customerPhone: form.customerPhone?.trim() || null,
				barberId: form.barberId!,
				serviceIds: form.serviceIds,
				scheduledAt: fromBusinessInputValue(form.scheduledAt).toISOString(),
				durationMin: formDuration,
				status: mode === 'walkin' ? 'queued' : 'booked',
				notes: form.notes.trim(),
				createdBy: $session.staff?.id ?? '',
				createdAt: new Date().toISOString()
			};
			await repo.saveAppointment(appointment);
			await appointments.refresh();
			dialog = null;
			// A walk-in belongs on today's board, not on a future date.
			if (mode === 'walkin') date = dayKey(appointment.scheduledAt);
		} finally {
			saving = false;
		}
	}

	async function setStatus(apt: Appointment, status: AppointmentStatus) {
		await repo.setAppointmentStatus(apt.id, status);
		await appointments.refresh();
	}

	async function remove(apt: Appointment) {
		await repo.deleteAppointment(apt.id);
		await appointments.refresh();
	}

	/** Hand the appointment's services to the sell screen for checkout. */
	function checkoutFrom(apt: Appointment) {
		const lines: Item[] = $items.filter((i) => apt.serviceIds.includes(i.id));
		clearCart();
		loadFromAppointment(lines, apt.barberId, apt.customerName, apt.customerPhone, apt.id);
		void goto('/sell');
	}

	const nextAction = (apt: Appointment): { label: MessageKey; next: AppointmentStatus; icon: string } => {
		switch (apt.status) {
			case 'booked':
				return { label: 'queue.markArrived', next: 'arrived', icon: 'check' };
			case 'arrived':
				return { label: 'queue.start', next: 'in_service', icon: 'scissors' };
			case 'in_service':
				return { label: 'queue.finish', next: 'done', icon: 'check' };
			default:
				return { label: 'queue.start', next: 'in_service', icon: 'scissors' };
		}
	};
</script>

<div class="space-y-4 p-4 sm:p-6">
	<div class="flex flex-wrap items-center justify-between gap-3">
		<div>
			<h1 class="text-xl font-semibold">{$t('queue.title')}</h1>
			<p class="text-sm text-ink-500">{activeBranch?.name ?? '—'}</p>
		</div>
		<div class="flex flex-wrap gap-2">
			<button class="btn btn-ghost" onclick={openWalkin}>
				<Icon name="users" size={16} /> {$t('queue.walkIn')}
			</button>
			<button class="btn btn-primary" onclick={openNew}>
				<Icon name="plus" size={16} /> {$t('queue.newAppointment')}
			</button>
		</div>
	</div>

	<div class="flex flex-wrap items-center gap-2">
		<div class="flex overflow-hidden rounded-lg border border-ink-600">
			<button
				class="px-4 py-1.5 text-sm font-medium"
				class:bg-ink-200={view === 'board'}
				class:text-walnut-500={view === 'board'}
				class:text-ink-500={view !== 'board'}
				onclick={() => (view = 'board')}
			>
				{$t('queue.board')}
			</button>
			<button
				class="px-4 py-1.5 text-sm font-medium"
				class:bg-ink-200={view === 'schedule'}
				class:text-walnut-500={view === 'schedule'}
				class:text-ink-500={view !== 'schedule'}
				onclick={() => (view = 'schedule')}
			>
				{$t('queue.scheduled')}
			</button>
		</div>
		<input type="date" class="!w-auto !py-1.5 text-sm" bind:value={date} />
		<span class="text-xs text-ink-500">
			{liveAppointments.length} {$t('queue.title').toLowerCase()} · {doneToday.length} {$t('queue.status.done').toLowerCase()}
		</span>
	</div>

	{#if view === 'board'}
		{#if liveAppointments.length === 0 && doneToday.length === 0}
			<EmptyState icon="calendar" title={$t('queue.noAppointments')} hint={$t('queue.walkIn')}>
				<button class="btn btn-primary mt-2" onclick={openWalkin}>{$t('queue.walkIn')}</button>
			</EmptyState>
		{:else}
			<div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
				{#each COLUMNS as column (column.status)}
					<section class="card overflow-hidden">
						<header class="flex items-center gap-2 border-b border-stone-300 px-3 py-2.5">
							<span class="size-2 rounded-full {column.dot}"></span>
							<h2 class="text-xs font-semibold tracking-wide uppercase">{$t(column.label)}</h2>
							<span class="ms-auto text-xs text-ink-500">{inColumn(column.status).length}</span>
						</header>
						<div class="min-h-24 space-y-2 p-2">
							{#each inColumn(column.status) as apt (apt.id)}
								{@const action = nextAction(apt)}
								<article class="rounded-lg border border-stone-300 bg-ivory-200 p-2.5">
									<div class="mb-1 flex items-start justify-between gap-2">
										<div class="min-w-0">
											<p class="truncate text-sm font-medium">{apt.customerName}</p>
											<p class="truncate text-xs text-ink-500">{serviceNames(apt) || '—'}</p>
										</div>
										<span class="shrink-0 text-xs tabular-nums text-ink-500">{formatTime(apt.scheduledAt)}</span>
									</div>
									<div class="mb-2 flex items-center gap-2 text-[11px] text-ink-500">
										<Icon name="scissors" size={12} />
										<span class="truncate">{barberName(apt.barberId)}</span>
										<span>·</span>
										<span>{formatDuration(apt.durationMin)}</span>
										<span class="ms-auto font-semibold text-ink-600">{formatIDR(priceOf(apt))}</span>
									</div>
									{#if apt.notes}
										<p class="mb-2 truncate text-[11px] text-walnut-500">“{apt.notes}”</p>
									{/if}
									<div class="flex flex-wrap gap-1">
										<button class="btn btn-ghost flex-1 px-2 py-1 text-[11px]" onclick={() => setStatus(apt, action.next)}>
											<Icon name={action.icon} size={12} /> {$t(action.label)}
										</button>
										{#if apt.status === 'in_service'}
											<button class="btn btn-primary flex-1 px-2 py-1 text-[11px]" onclick={() => checkoutFrom(apt)}>
												{$t('queue.toSell')}
											</button>
										{/if}
										<button class="p-1 text-ink-600 hover:text-red-400" onclick={() => remove(apt)} title={$t('common.delete')}>
											<Icon name="trash" size={13} />
										</button>
									</div>
								</article>
							{/each}
							{#if inColumn(column.status).length === 0}
								<p class="py-6 text-center text-xs text-ink-600">—</p>
							{/if}
						</div>
					</section>
				{/each}
			</div>

			{#if doneToday.length > 0}
				<section class="card mt-4 overflow-hidden">
					<header class="border-b border-stone-300 px-4 py-2.5">
						<h2 class="text-xs font-semibold tracking-wide text-ink-500 uppercase">{$t('queue.status.done')}</h2>
					</header>
					<ul class="divide-y divide-stone-200">
						{#each doneToday as apt (apt.id)}
							<li class="flex items-center gap-3 px-4 py-2 text-sm">
								<span class="w-14 shrink-0 text-xs tabular-nums text-ink-500">{formatTime(apt.scheduledAt)}</span>
								<span class="min-w-0 flex-1 truncate">{apt.customerName}</span>
								<span class="hidden truncate text-xs text-ink-500 sm:block">{barberName(apt.barberId)}</span>
								<span class="shrink-0 text-sm tabular-nums">{formatIDR(priceOf(apt))}</span>
							</li>
						{/each}
					</ul>
				</section>
			{/if}
		{/if}
	{:else}
		{#if dayAppointments.length === 0}
			<EmptyState icon="calendar" title={$t('queue.noAppointments')} />
		{:else}
			<div class="card overflow-hidden">
				<ul class="divide-y divide-stone-200">
					{#each dayAppointments as apt (apt.id)}
						<li class="flex items-center gap-3 p-3">
							<div class="w-16 shrink-0 text-center">
								<p class="text-sm font-semibold tabular-nums">{formatTime(apt.scheduledAt)}</p>
								<p class="text-[10px] text-ink-500">{formatDuration(apt.durationMin)}</p>
							</div>
							<div class="min-w-0 flex-1">
								<p class="truncate text-sm font-medium">{apt.customerName}</p>
								<p class="truncate text-xs text-ink-500">{serviceNames(apt)} · {barberName(apt.barberId)}</p>
							</div>
							<span
								class="badge shrink-0"
								class:bg-sage-600={apt.status === 'done' || apt.status === 'in_service'}
								class:text-white={apt.status === 'done' || apt.status === 'in_service'}
								class:bg-ink-200={apt.status !== 'done' && apt.status !== 'in_service'}
								class:text-ink-600={apt.status !== 'done' && apt.status !== 'in_service'}
							>
								{$t(`queue.status.${apt.status}` as 'queue.status.booked')}
							</span>
							<span class="w-24 shrink-0 text-right text-sm font-semibold tabular-nums">{formatIDR(priceOf(apt))}</span>
							<button class="shrink-0 p-1 text-ink-600 hover:text-red-400" onclick={() => remove(apt)} title={$t('common.delete')}>
								<Icon name="trash" size={14} />
							</button>
						</li>
					{/each}
				</ul>
			</div>
		{/if}
	{/if}
</div>

<Modal
	open={dialog !== null}
	title={dialog === 'walkin' ? $t('queue.walkIn') : $t('queue.newAppointment')}
	subtitle={activeBranch?.name ?? ''}
	onclose={() => (dialog = null)}
>
	<div class="space-y-3">
		<div class="grid gap-3 sm:grid-cols-2">
			<div>
				<label class="mb-1 block text-xs font-medium text-ink-500" for="a-name">{$t('queue.customer')}</label>
				<input id="a-name" bind:value={form.customerName} placeholder="Budi Santoso" />
			</div>
			<div>
				<label class="mb-1 block text-xs font-medium text-ink-500" for="a-phone">{$t('customers.phone')}</label>
				<input id="a-phone" bind:value={form.customerPhone} inputmode="tel" placeholder="0812-3456-7890" />
			</div>
		</div>

		<div class="grid gap-3 sm:grid-cols-2">
			<div>
				<label class="mb-1 block text-xs font-medium text-ink-500" for="a-barber">{$t('queue.pickBarber')}</label>
				<select id="a-barber" bind:value={form.barberId}>
					{#each branchBarbers as barber (barber.id)}
						<option value={barber.id}>{barber.displayName}</option>
					{/each}
				</select>
			</div>
			<div>
				<label class="mb-1 block text-xs font-medium text-ink-500" for="a-when">{$t('queue.chooseDate')}</label>
				<input id="a-when" type="datetime-local" bind:value={form.scheduledAt} />
			</div>
		</div>

		<div>
			<p class="mb-1.5 text-xs font-medium text-ink-500">{$t('queue.pickService')}</p>
			<div class="grid max-h-52 gap-1.5 overflow-y-auto sm:grid-cols-2">
				{#each services as service (service.id)}
					<label
						class="flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm transition {form.serviceIds.includes(service.id)
							? 'border-walnut-500 bg-walnut-500/10'
							: 'border-stone-300'}"
					>
						<input
							type="checkbox"
							class="!w-3.5 !h-3.5"
							checked={form.serviceIds.includes(service.id)}
							onchange={() => toggleService(service.id)}
						/>
						<span class="min-w-0 flex-1 truncate">{service.name}</span>
						<span class="shrink-0 text-xs tabular-nums text-ink-500">{formatIDR(service.price)}</span>
					</label>
				{/each}
			</div>
		</div>

		<div>
			<label class="mb-1 block text-xs font-medium text-ink-500" for="a-notes">{$t('queue.notes')}</label>
			<textarea id="a-notes" rows="2" bind:value={form.notes}></textarea>
		</div>

		{#if form.serviceIds.length > 0}
			<div class="flex items-center justify-between rounded-lg bg-ivory-200 px-3 py-2 text-sm">
				<span class="text-ink-500">{formatDuration(formDuration)}</span>
				<span class="font-semibold tabular-nums text-walnut-500">{formatIDR(formTotal)}</span>
			</div>
		{/if}
	</div>

	{#snippet footer()}
		<button class="btn btn-ghost" onclick={() => (dialog = null)} disabled={saving}>{$t('common.cancel')}</button>
		<button
			class="btn btn-primary"
			onclick={save}
			disabled={saving || !form.customerName.trim() || !form.barberId}
		>
			{saving ? '…' : $t('common.save')}
		</button>
	{/snippet}
</Modal>