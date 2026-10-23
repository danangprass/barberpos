import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir: 'tests',
	use: {
		baseURL: 'http://localhost:5173',
		screenshot: 'only-on-failure',
		trace: 'on-first-retry'
	},
	webServer: {
		command: 'npm run dev',
		url: 'http://localhost:5173',
		timeout: 30_000,
		reuseExistingServer: true
	}
});
