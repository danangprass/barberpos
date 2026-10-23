<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { repo } from '#lib/data/index';
	import type { AuthFailureKind } from '#lib/data/repository';
	import type { DirectoryEntry } from '#lib/data/repository';
	import Icon from '#lib/components/Icon.svelte';
	import { session, signIn, signOut } from '#lib/stores/session.svelte';
	import { t, locale } from '#lib/i18n';
	import { isValidPin } from '#lib/utils/pin';

	const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'del'];

	let selectedId = $state<string | null>(null);
	let pin = $state('');
	let error = $state('');
	let busy = $state(false);
	let directory = $state<DirectoryEntry[]>([]);
	let directoryLoaded = $state(false);
	let backendNotReady = $state(false);
	let loading = $state(true);

	/**
	 * The dots show exactly the digits that have been typed — no empty
	 * placeholders. Empty slots used to look like a required length (four
	 * slots for a six-digit PIN), and the real length cannot be shown up
	 * front without telling an attacker how long the PIN is.
	 */
	let pinSlots = $derived(pin.length);

	/**
	 * The login picker reads a public directory, not the `staff` collection —
	 * that collection is only readable once a session exists.
	 *
	 * `directoryLoaded` records that the read *succeeded*. It is what tells
	 * "the internet is down" apart from "the server rejected us": if Firestore
	 * answered a moment ago, the network is fine and the problem is the
	 * backend.
	 */
	onMount(async () => {
		try {
			directory = (await repo.listLoginDirectory()).filter((e) => e.active);
			directoryLoaded = true;
		} catch {
			error = $t('login.directoryError');
		} finally {
			loading = false;
		}

		// Say up front whether the data is reachable, rather than letting the
		// sign-in fail with no explanation.
		try {
			await repo.backendStatus();
			backendNotReady = false;
		} catch {
			backendNotReady = true;
		}
	});

	const selectable = $derived(
		[...directory].sort((a, b) => {
			const order = { owner: 0, manager: 1, barber: 2 } as const;
			return order[a.role] - order[b.role] || a.displayName.localeCompare(b.displayName);
		})
	);

	const selected = $derived(directory.find((s) => s.id === selectedId) ?? null);

	/** Turns a sign-in failure into something the barber can act on. */
	function authMessage(reason: AuthFailureKind): string {
		switch (reason) {
			case 'locked':
				return $t('login.tooManyAttempts');
			case 'account':
				return $t('login.notRegistered');
			case 'server':
				// Firestore answered a moment ago, so the network is fine and the
				// backend is the problem.
				return directoryLoaded ? $t('login.serverNotReady') : $t('login.serverError');
			default:
				return $t('login.wrongPin');
		}
	}

	function choose(id: string) {
		selectedId = id;
		pin = '';
		error = '';
	}

	function press(key: string) {
		if (key === 'clear') {
			pin = '';
			error = '';
			return;
		}
		if (key === 'del') {
			pin = pin.slice(0, -1);
			error = '';
			return;
		}
		if (pin.length >= 6) return;
		pin += key;
		error = '';
	}

	async function submit() {
		if (!selectedId || !isValidPin(pin) || busy) return;
		busy = true;
		const result = await signIn(selectedId, pin);
		busy = false;
		if (!result.ok) {
			error = authMessage(result.reason);
			pin = '';
			return;
		}
		await goto('/dashboard');
	}

	function onKeydown(event: KeyboardEvent) {
		if (!selectedId) return;
		if (/^[0-9]$/.test(event.key)) press(event.key);
		else if (event.key === 'Backspace') press('del');
		else if (event.key === 'Escape') choose('');
		else if (event.key === 'Enter') void submit();
	}

	// Bounce a live session back out if it is already signed in.
	$effect(() => {
		if ($session.isAuthenticated && !selectedId) void goto('/dashboard');
	});
</script>

<svelte:window onkeydown={onKeydown} />

<div class="grid min-h-dvh lg:grid-cols-[1fr_minmax(420px,520px)]">
	<!-- Brand panel -->
	<div class="relative hidden overflow-hidden bg-ink-900 lg:block">
		<div class="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(220,38,38,0.22),transparent_55%)]"></div>
		<div class="absolute -right-24 -bottom-24 size-96 rounded-full bg-barber-red-800/15 blur-3xl"></div>
		<div class="absolute -left-20 -top-20 size-72 rounded-full bg-bronze-700/10 blur-3xl"></div>
		<div class="relative flex h-full flex-col justify-between p-12">
			<div class="flex items-center gap-3">
				<div class="grid size-11 place-items-center rounded-xl bg-barber-red-600">
					<Icon name="scissors" size={20} class="text-ink-50" />
				</div>
				<span class="text-lg font-semibold tracking-tight">{$t('app.name')}</span>
			</div>

			<div class="max-w-md">
				<h1 class="text-4xl leading-tight font-semibold tracking-tight text-balance">
					GoodFellas Barbershop
				</h1>
				<p class="mt-4 text-ink-400">
					Precise cuts, honest prices. Cashier, services, and barber commissions in one place.
				</p>
			</div>

			<div class="flex items-center gap-6 text-xs text-ink-500">
				<span>PIN terenkripsi</span>
				<span class="size-1 rounded-full bg-ink-600"></span>
				<span>Bisa dipasang ke layar utama</span>
				<span class="size-1 rounded-full bg-ink-600"></span>
				<span>Multi cabang</span>
			</div>
		</div>
	</div>

	<!-- Auth panel -->
	<div class="flex flex-col justify-center bg-ink-950 px-6 py-10 sm:px-10">
		<div class="mx-auto w-full max-w-sm">
			<div class="mb-8 flex items-center justify-between">
				<div class="flex items-center gap-3 lg:hidden">
					<div class="grid size-10 place-items-center rounded-xl bg-barber-red-600">
						<Icon name="scissors" size={16} class="text-ink-50" />
					</div>
					<span class="font-semibold">{$t('app.name')}</span>
				</div>
				<div class="ms-auto">
					<button
						class="btn btn-ghost px-2.5 py-1 text-xs"
						onclick={() => ($locale = $locale === 'id' ? 'en' : 'id')}
					>
						{$locale === 'id' ? 'EN' : 'ID'}
					</button>
				</div>
			</div>

			{#if !selected}
				<h2 class="text-xl font-semibold">{$t('login.chooseStaff')}</h2>
				<p class="mt-1 mb-5 text-sm text-ink-400">{$t('login.subtitle')}</p>

				{#if backendNotReady}
					<p class="card mb-4 border-rust-500/40 p-3 text-sm text-rust-300">
						{$t('login.serverNotReady')}
					</p>
				{/if}

				{#if loading}
					<div class="grid place-items-center py-10">
						<div class="size-8 animate-spin rounded-full border-2 border-ink-700 border-t-barber-red-500"></div>
					</div>
				{:else if selectable.length === 0}
					<p class="card p-4 text-sm text-ink-400">{$t('login.noStaff')}</p>
				{:else}
					<div class="grid gap-2">
						{#each selectable as person (person.id)}
							<button
								class="card flex items-center gap-3 p-3 text-left transition hover:border-barber-red-500/60 hover:bg-ink-800"
								onclick={() => choose(person.id)}
							>
								<div
									class="grid size-10 shrink-0 place-items-center rounded-full text-sm font-semibold"
									class:bg-barber-red-500={person.role === 'owner'}
									class:bg-azure-600={person.role === 'manager'}
									class:bg-ink-700={person.role === 'barber'}
									class:text-ink-950={person.role !== 'barber'}
									class:text-ink-200={person.role === 'barber'}
								>
									{person.displayName.slice(0, 2).toUpperCase()}
								</div>
								<div class="min-w-0">
									<p class="truncate text-sm font-medium">{person.displayName}</p>
									<p class="text-xs text-ink-500">{$t(`role.${person.role}` as 'role.owner')}</p>
								</div>
							</button>
						{/each}
					</div>
				{/if}
			{:else}
				<button class="mb-4 text-xs text-ink-400 hover:text-barber-red-400" onclick={() => choose('')}>
					← {$t('login.back')}
				</button>

				<h2 class="text-xl font-semibold">{selected.displayName}</h2>
				<p class="mt-1 text-sm text-ink-400">{$t('login.enterPin')}</p>

				<div class="my-6 flex min-h-4 flex-wrap items-center justify-center gap-2.5">
					{#each Array(pinSlots) as _, i (i)}
						<span
							class="size-3.5 rounded-full transition"
							class:bg-barber-red-500={i < pin.length}
							class:bg-ink-700={i >= pin.length}
						></span>
					{/each}
				</div>

				<p class="mb-1 text-center text-xs text-ink-500">{$t('login.pinPlaceholder')}</p>

				{#if error}
					<p class="mb-3 text-center text-sm text-rust-400">{error}</p>
				{/if}

				<div class="grid grid-cols-3 gap-2">
					{#each KEYS as key (key)}
						<button
							class="btn btn-ghost h-14 text-lg"
							class:text-ink-500={key === 'clear' || key === 'del'}
							onclick={() => press(key)}
						>
							{#if key === 'clear'}{$t('common.cancel')}{:else if key === 'del'}⌫{:else}{key}{/if}
						</button>
					{/each}
				</div>

				<button class="btn btn-primary mt-3 h-12 w-full text-base" disabled={!isValidPin(pin) || busy} onclick={submit}>
					{$t('login.confirm')}
				</button>

				{#if $session.isAuthenticated}
					<button class="mt-3 w-full text-center text-xs text-ink-500 hover:text-ink-300" onclick={signOut}>
						{$t('login.signOut')}
					</button>
				{/if}

				<p class="mt-6 text-center text-[11px] text-ink-600">{$t('login.securedBy')}</p>
			{/if}
		</div>
	</div>
</div>