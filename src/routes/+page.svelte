<script lang="ts">
	import { goto } from '$app/navigation';
	import { session, sessionReady } from '#lib/stores/session.svelte';

	$effect(() => {
		if ($sessionReady) {
			void goto($session.isAuthenticated ? '/dashboard' : '/login');
		}
	});
</script>

<div class="grid h-dvh place-items-center bg-ink-950">
	<div class="size-10 animate-spin rounded-full border-2 border-ink-700 border-t-barber-red-500"></div>
</div>