<script lang="ts">
	/** Lucide-style 24×24 stroke icons, kept inline so there is no icon dependency. */
	const PATHS: Record<string, string[]> = {
		grid: ['M3 3h7v7H3z', 'M14 3h7v7h-7z', 'M14 14h7v7h-7z', 'M3 14h7v7H3z'],
		cart: [
			'M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6',
			'circle:9,21,1',
			'circle:20,21,1'
		],
		users: [
			'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
			'circle:9,7,4',
			'M22 21v-2a4 4 0 0 0-3-3.87',
			'M16 3.13a4 4 0 0 1 0 7.75'
		],
		package: [
			'M21 8v8a2 2 0 0 1-1 1.7l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 16V8a2 2 0 0 1 1-1.7l7-4a2 2 0 0 1 2 0l7 4A2 2 0 0 1 21 8z',
			'M3.3 7L12 12l8.7-5',
			'M12 22V12'
		],
		user: ['M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2', 'circle:12,7,4'],
		chart: ['M12 20V10', 'M18 20V4', 'M6 20v-4'],
		building: [
			'M3 21h18',
			'M5 21V7l8-4v18',
			'M19 21V11l-6-4',
			'M9 9v.01',
			'M9 12v.01',
			'M9 15v.01'
		],
		settings: [
			'circle:12,12,3',
			'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6 1.65 1.65 0 0 0 10 3.09V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z'
		],
		plus: ['M12 5v14', 'M5 12h14'],
		trash: [
			'M3 6h18',
			'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
			'm3 0 1 14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-14',
			'M10 11v6',
			'M14 11v6'
		],
		edit: [
			'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7',
			'M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z'
		],
		printer: [
			'M6 9V2h12v7',
			'M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2',
			'M6 14h12v8H6z'
		],
		search: ['circle:11,11,8', 'M21 21l-4.35-4.35'],
		clock: ['circle:12,12,10', 'M12 6v6l4 2'],
		offline: [
			'M1 1l22 22',
			'M16.72 11.06A10.94 10.94 0 0 1 19 12.55',
			'M5 12.55a10.94 10.94 0 0 1 5.17-2.39',
			'M10.71 5.05A16 16 0 0 1 22.58 9',
			'M1.42 9a15.91 15.91 0 0 1 4.7-2.88',
			'M8.53 16.11a6 6 0 0 1 6.95 0',
			'M12 20h.01'
		],
		refresh: [
			'M23 4v6h-6',
			'M1 20v-6h6',
			'M3.51 9a9 9 0 0 1 14.85-3.36L23 10',
			'M1 14l4.64 4.36A9 9 0 0 0 20.49 15'
		],
		chevron: ['m9 18 6-6-6-6'],
		check: ['M20 6L9 17l-5-5'],
		alert: [
			'M12 9v4',
			'M12 17h.01',
			'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z'
		],
		logout: ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'M16 17l5-5-5-5', 'M21 12H9'],
		globe: [
			'circle:12,12,10',
			'M2 12h20',
			'M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z'
		],
		calendar: ['rect:3,4,18,18,2', 'M16 2v4', 'M8 2v4', 'M3 10h18'],
		scissors: [
			'circle:6,9,3',
			'circle:6,20,3',
			'M20 4L8.1 15.9',
			'M14.5 14.5L20 20',
			'M8.1 8.1L12 12'
		],
		receipt: [
			'M4 2v20l2-1.5L8 22l2-1.5L12 22l2-1.5L16 22l2-1.5L20 22V2l-2 1.5L16 2l-2 1.5L12 2l-2 1.5L8 2 6 3.5z',
			'M8 8h8',
			'M8 12h8',
			'M8 16h5'
		]
	};

	let { name, size = 20, class: klass = '' }: { name: string; size?: number; class?: string } = $props();

	const paths = $derived(PATHS[name] ?? PATHS.grid);
</script>

<svg
	class={klass}
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="1.8"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
>
	{#each paths as d (d)}
		{#if d.startsWith('circle:')}
			{@const [cx, cy, r] = d.slice(7).split(',')}
			<circle cx={cx} cy={cy} r={r} />
		{:else if d.startsWith('rect:')}
			{@const [x, y, w, h, rx] = d.slice(5).split(',')}
			<rect x={x} y={y} width={w} height={h} rx={rx} />
		{:else}
			<path d={d} />
		{/if}
	{/each}
</svg>