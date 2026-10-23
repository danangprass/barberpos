import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		/**
		 * SvelteKit 3 reads its configuration here rather than from a legacy
		 * `svelte.config.js`.
		 *
		 * Static SPA output targeting Firebase Hosting. With `ssr = false` the
		 * build is one `index.html` plus hashed assets; `fallback: '200.html'`
		 * is the file Firebase rewrites unknown routes to, so `/sell` and
		 * `/queue` survive a hard refresh or a cold start with no connection.
		 */
		sveltekit({
			adapter: adapter({
				pages: 'build',
				assets: 'build',
				fallback: '200.html',
				strict: true
			})
		})
	],
	server: { port: 5173 }
});