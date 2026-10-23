<script lang="ts">
	import { barbers, branches, staff } from '#lib/data/cache';
	import { repo, DEMO_PIN } from '#lib/data/index';
	import { syncStaffRecord } from '#lib/stores/session.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import Modal from '#lib/components/Modal.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import { t } from '#lib/i18n';
	import { generateSalt, hashPin, isValidPin } from '#lib/utils/pin';
	import { uid } from '#lib/utils/format';
	import type { Barber, Role, Staff } from '#lib/types/domain';

	let creating = $state(false);
	let editing = $state<Staff | null>(null);
	let saving = $state(false);
	let deleting = $state<Staff | null>(null);

	let form = $state({
		displayName: '',
		role: 'barber' as Role,
		phone: '',
		branchIds: [] as string[],
		pin: '',
		pinConfirm: '',
		pinError: ''
	});

	const ROLES: Role[] = ['owner', 'manager', 'barber'];

	const staffList = $derived(
		$staff
			.slice()
			.sort((a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role) || a.displayName.localeCompare(b.displayName))
	);

	const initials = (name: string) => name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();

	function openCreate() {
		form = {
			displayName: '',
			role: 'barber',
			phone: '',
			branchIds: [$branches[0]?.id ?? ''],
			pin: '',
			pinConfirm: '',
			pinError: ''
		};
		editing = null;
		creating = true;
	}

	function openEdit(person: Staff) {
		form = {
			displayName: person.displayName,
			role: person.role,
			phone: person.phone,
			branchIds: [...person.branchIds],
			pin: '',
			pinConfirm: '',
			pinError: ''
		};
		editing = person;
		creating = true;
	}

	function close() {
		creating = false;
		editing = null;
	}

	function toggleBranch(id: string) {
		form.branchIds = form.branchIds.includes(id)
			? form.branchIds.filter((b) => b !== id)
			: [...form.branchIds, id];
	}

	/**
	 * PIN is required on create and optional on edit — leaving both fields blank
	 * keeps the existing hash intact so an owner can rename staff without
	 * resetting everyone's login.
	 */
	async function save() {
		if (!form.displayName.trim() || form.branchIds.length === 0) return;

		if (!editing && !isValidPin(form.pin)) return;
		if (form.pin !== form.pinConfirm) {
			form.pinError = $t('branches.pinMismatch');
			return;
		}

		saving = true;
		try {
			const pinChanged = isValidPin(form.pin);
			const pinSalt = pinChanged ? generateSalt() : (editing?.pinSalt ?? generateSalt());
			const pinHash = pinChanged ? await hashPin(form.pin, pinSalt) : (editing?.pinHash ?? await hashPin(DEMO_PIN, pinSalt));

			const person: Staff = {
				id: editing?.id ?? uid('s_'),
				displayName: form.displayName.trim(),
				role: form.role,
				phone: form.phone.trim(),
				branchIds: form.branchIds,
				pinHash,
				pinSalt,
				active: editing?.active ?? true
			};

			await repo.saveStaff(person);
			syncStaffRecord(person);

			// Keep the barber roster in step with staff whose role just changed.
			const existingBarber = $barbers.find((b) => b.staffId === person.id);
			if (person.role === 'barber' && !existingBarber) {
				const barber: Barber = {
					id: `bar_${person.id.slice(2)}`,
					staffId: person.id,
					displayName: person.displayName,
					active: person.active
				};
				await repo.saveBarber(barber);
				await barbers.refresh();
			} else if (existingBarber) {
				await repo.saveBarber({ ...existingBarber, displayName: person.displayName, active: person.active });
				await barbers.refresh();
			}
			await staff.refresh();
			close();
		} finally {
			saving = false;
		}
	}

	async function remove() {
		if (!deleting) return;
		saving = true;
		try {
			await repo.deleteStaff(deleting.id);
			await staff.refresh();
			deleting = null;
			close();
		} finally {
			saving = false;
		}
	}
</script>

<div class="space-y-4 p-4 sm:p-6">
	<div class="flex flex-wrap items-center justify-between gap-3">
		<div>
			<h1 class="text-xl font-semibold">{$t('branches.title')}</h1>
			<p class="text-sm text-ink-400">{$branches.length} {$t('branches.activeBranches').toLowerCase()} · {$staff.length} {$t('branches.staff').toLowerCase()}</p>
		</div>
		<button class="btn btn-primary" onclick={openCreate}>
			<Icon name="plus" size={16} /> {$t('branches.newStaff')}
		</button>
	</div>

	<!-- Branches -->
	<div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
		{#each $branches as branch (branch.id)}
			{@const branchStaff = $staff.filter((s) => s.branchIds.includes(branch.id) && s.active)}
			<div class="card p-4">
				<div class="flex items-start justify-between gap-2">
					<div class="min-w-0">
						<h2 class="truncate text-sm font-semibold">{branch.name}</h2>
						<p class="mt-0.5 truncate text-xs text-ink-500">{branch.address}</p>
					</div>
					<span class="badge shrink-0" class:bg-jade-600={branch.active} class:text-white={branch.active} class:bg-ink-700={!branch.active} class:text-ink-400={!branch.active}>
						{branch.active ? $t('common.active') : $t('common.inactive')}
					</span>
				</div>
				<p class="mt-2 text-xs text-ink-500">{branch.phone}</p>
				<div class="mt-3 flex items-center gap-1.5">
					{#each branchStaff as person (person.id)}
						<span class="grid size-7 place-items-center rounded-full bg-ink-700 text-[10px] font-semibold text-ink-300" title={person.displayName}>
							{initials(person.displayName)}
						</span>
					{/each}
					<span class="ms-1 text-xs text-ink-500">{branchStaff.length}</span>
				</div>
			</div>
		{/each}
	</div>

	<!-- Staff -->
	<section class="card overflow-hidden">
		<header class="border-b border-ink-700 px-4 py-3">
			<h2 class="text-sm font-semibold">{$t('branches.staff')}</h2>
		</header>
		{#if staffList.length === 0}
			<EmptyState icon="alert" title={$t('login.noStaff')} />
		{:else}
			<table class="w-full text-sm">
				<thead class="border-b border-ink-700 bg-ink-800/50 text-left text-xs tracking-wide text-ink-400 uppercase">
					<tr>
						<th class="px-4 py-2.5 font-medium">{$t('common.name')}</th>
						<th class="px-4 py-2.5 font-medium">{$t('branches.role')}</th>
						<th class="hidden px-4 py-2.5 font-medium sm:table-cell">{$t('branches.phone')}</th>
						<th class="hidden px-4 py-2.5 font-medium md:table-cell">{$t('settings.branch')}</th>
						<th class="w-24 px-4 py-2.5"></th>
					</tr>
				</thead>
				<tbody class="divide-y divide-ink-800">
					{#each staffList as person (person.id)}
						<tr class="hover:bg-ink-850">
							<td class="px-4 py-2.5">
								<div class="flex items-center gap-2.5">
									<div class="grid size-8 shrink-0 place-items-center rounded-full bg-ink-700 text-[11px] font-semibold text-ink-300">
										{initials(person.displayName)}
									</div>
									<div class="min-w-0">
										<p class="truncate font-medium">{person.displayName}</p>
										{#if !person.active}
											<span class="badge bg-ink-700 text-ink-400">{$t('common.inactive')}</span>
										{/if}
									</div>
								</div>
							</td>
							<td class="px-4 py-2.5">
								<span
									class="badge"
									class:bg-barber-red-500={person.role === 'owner'}
									class:text-ink-950={person.role === 'owner'}
									class:bg-azure-600={person.role === 'manager'}
									class:text-white={person.role === 'manager'}
									class:bg-ink-700={person.role === 'barber'}
									class:text-ink-300={person.role === 'barber'}
								>
									{$t(`role.${person.role}` as 'role.owner')}
								</span>
							</td>
							<td class="hidden px-4 py-2.5 text-ink-400 sm:table-cell">{person.phone || '—'}</td>
							<td class="hidden px-4 py-2.5 text-ink-400 md:table-cell">
								{person.branchIds.map((id) => $branches.find((b) => b.id === id)?.name ?? id).join(', ')}
							</td>
							<td class="px-4 py-2.5">
								<div class="flex justify-end gap-1">
									<button class="p-1.5 text-ink-500 hover:text-barber-red-400" onclick={() => openEdit(person)} title={$t('common.edit')}>
										<Icon name="edit" size={15} />
									</button>
									<button class="p-1.5 text-ink-600 hover:text-rust-400" onclick={() => (deleting = person)} title={$t('common.delete')}>
										<Icon name="trash" size={15} />
									</button>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</section>
</div>

<Modal
	open={creating}
	title={editing ? $t('common.edit') : $t('branches.newStaff')}
	subtitle={editing?.displayName ?? ''}
	onclose={close}
>
	<div class="space-y-3">
		<div class="grid gap-3 sm:grid-cols-2">
			<div>
				<label class="mb-1 block text-xs font-medium text-ink-400" for="s-name">{$t('branches.displayName')}</label>
				<input id="s-name" bind:value={form.displayName} placeholder="Rahmat Hidayat" />
			</div>
			<div>
				<label class="mb-1 block text-xs font-medium text-ink-400" for="s-phone">{$t('branches.phone')}</label>
				<input id="s-phone" bind:value={form.phone} inputmode="tel" placeholder="0812-3456-7890" />
			</div>
		</div>

		<div>
			<label class="mb-1 block text-xs font-medium text-ink-400" for="s-role">{$t('branches.role')}</label>
			<select id="s-role" bind:value={form.role}>
				{#each ROLES as role (role)}
					<option value={role}>{$t(`role.${role}` as 'role.owner')}</option>
				{/each}
			</select>
		</div>

		<div>
			<p class="mb-1.5 text-xs font-medium text-ink-400">{$t('settings.branch')}</p>
			<div class="flex flex-wrap gap-2">
				{#each $branches as branch (branch.id)}
					<label
						class="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition {form.branchIds.includes(branch.id)
							? 'border-barber-red-500 bg-barber-red-500/10'
							: 'border-ink-700'}"
					>
						<input
							type="checkbox"
							class="!w-3.5 !h-3.5"
							checked={form.branchIds.includes(branch.id)}
							onchange={() => toggleBranch(branch.id)}
						/>
						{branch.name}
					</label>
				{/each}
			</div>
		</div>

		<div class="rounded-lg border border-ink-700 p-3">
			<p class="mb-2 text-xs font-medium text-ink-400">
				{$t('branches.setPin')}
				{#if editing}<span class="text-ink-600">({$t('common.optional')})</span>{/if}
			</p>
			<div class="grid gap-3 sm:grid-cols-2">
				<input type="password" inputmode="numeric" maxlength="6" bind:value={form.pin} placeholder="••••" />
				<input type="password" inputmode="numeric" maxlength="6" bind:value={form.pinConfirm} placeholder="••••" />
			</div>
			{#if form.pinError}
				<p class="mt-1.5 text-xs text-rust-400">{form.pinError}</p>
			{:else}
				<p class="mt-1.5 text-[11px] text-ink-600">
					4–6 digit · {$t('login.securedBy')}
				</p>
			{/if}
		</div>
	</div>

	{#snippet footer()}
		{#if editing}
			<button class="btn btn-danger me-auto" onclick={() => (deleting = editing)} disabled={saving}>
				<Icon name="trash" size={15} /> {$t('common.delete')}
			</button>
		{/if}
		<button class="btn btn-ghost" onclick={close} disabled={saving}>{$t('common.cancel')}</button>
		<button
			class="btn btn-primary"
			onclick={save}
			disabled={saving || !form.displayName.trim() || form.branchIds.length === 0 || (!editing && !isValidPin(form.pin))}
		>
			{saving ? '…' : $t('common.save')}
		</button>
	{/snippet}
</Modal>

<Modal
	open={deleting !== null}
	title={$t('common.delete')}
	subtitle={deleting?.displayName ?? ''}
	onclose={() => (deleting = null)}
	width="max-w-sm"
>
	<p class="text-sm text-ink-300">
		Staf <strong>{deleting?.displayName}</strong> akan dihapus permanen. Riwayat penjualan tidak berubah.
	</p>
	{#snippet footer()}
		<button class="btn btn-ghost" onclick={() => (deleting = null)} disabled={saving}>{$t('common.cancel')}</button>
		<button class="btn btn-danger" onclick={remove} disabled={saving}>{saving ? '…' : $t('common.delete')}</button>
	{/snippet}
</Modal>