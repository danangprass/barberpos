import { test, expect } from '@playwright/test';

test.describe('GoodFellas Barbershop POS – Full Walkthrough', () => {
	test.setTimeout(60000);

	test('login → all pages → modals', async ({ page }) => {
		// Use a viewport that resembles a counter tablet
		await page.setViewportSize({ width: 1280, height: 800 });

		// --- 1. Login page ---
		console.log('📍 1/14: Login page');
		await page.goto('/login');
		await page.screenshot({ path: 'docs/walkthrough/01-login.png' });

		// Click the first staff member (owner role)
		await page.click('.card.flex.items-center.gap-3.p-3');
		await page.screenshot({ path: 'docs/walkthrough/02-login-pin.png' });

		// Type the demo PIN
		for (const digit of '123456') {
			const btns = page.locator(`button:has-text("${digit}")`);
			if (await btns.count() > 0) await btns.nth(0).click();
		}
		await page.screenshot({ path: 'docs/walkthrough/03-login-pin-entered.png' });

		// Click "Masuk"
		await page.click('button:has-text("Masuk")');
		await page.waitForURL('**/dashboard', { timeout: 15000 });
		await page.screenshot({ path: 'docs/walkthrough/04-dashboard.png' });

		// --- 2. Navigate to Sell ---
		console.log('📍 3/14: Sell — pick barber, add service, checkout');
		await page.click('a[href="/sell"]');
		await page.waitForURL('**/sell');
		await page.screenshot({ path: 'docs/walkthrough/05-sell-services.png' });

		// Enter customer name
		await page.fill('input[placeholder="Nama pelanggan"]', 'Test Customer');

		// Select a barber (required for services)
		await page.click('button:has-text("Bayu Nugroho")');

		// Add first service to cart
		const serviceCards = page.locator('.grid.grid-cols-2 .card.flex.flex-col');
		if (await serviceCards.count() > 0) {
			await serviceCards.first().click();
		}
		await page.screenshot({ path: 'docs/walkthrough/05b-sell-with-cart.png' });

		// Click the now-enabled pay button
		await page.getByRole('button', { name: /Bayar/ }).click();
		await page.waitForSelector('.modal, .fixed.inset-0.z-50', { timeout: 5000 });
		await page.screenshot({ path: 'docs/walkthrough/06-checkout-cash.png' });

		// Switch to QRIS tab
		await page.click('button:has-text("QRIS")');
		await page.screenshot({ path: 'docs/walkthrough/06b-checkout-qris.png' });

		// Close checkout dialog
		await page.keyboard.press('Escape');
		await page.waitForSelector('.fixed.inset-0.z-50', { state: 'hidden', timeout: 5000 });

		// --- 3. Navigate to Queue ---
		console.log('📍 5/14: Queue Board');
		await page.click('a[href="/queue"]');
		await page.waitForURL('**/queue');
		await page.screenshot({ path: 'docs/walkthrough/07-queue-board.png' });

		// Switch to Schedule view
		await page.click('button:has-text("Terjadwal")');
		await page.screenshot({ path: 'docs/walkthrough/07b-queue-schedule.png' });
		await page.click('button:has-text("Papan Antrean")');

		// Open new appointment modal
		console.log('📍 6/14: New Appointment Modal');
		await page.click('button:has-text("Buat Jadwal")');
		await page.waitForSelector('.fixed.inset-0.z-50', { timeout: 5000 });
		await page.screenshot({ path: 'docs/walkthrough/08-queue-new-appt.png' });
		await page.keyboard.press('Escape');
		await page.waitForSelector('.fixed.inset-0.z-50', { state: 'hidden', timeout: 5000 });

		// --- 4. Navigate to Catalog ---
		console.log('📍 7/14: Catalog');
		await page.click('a[href="/catalog"]');
		await page.waitForURL('**/catalog');
		await page.screenshot({ path: 'docs/walkthrough/09-catalog.png' });

		// Open new service modal
		console.log('📍 7a/14: New Service Modal');
		const newServiceBtn = page.getByRole('button', { name: /Layanan Baru/ });
		if (await newServiceBtn.count() > 0) {
			await newServiceBtn.click();
			await page.waitForSelector('.fixed.inset-0.z-50', { timeout: 5000 });
			await page.screenshot({ path: 'docs/walkthrough/09b-catalog-new-service.png' });
			await page.keyboard.press('Escape');
			await page.waitForSelector('.fixed.inset-0.z-50', { state: 'hidden', timeout: 5000 });
		}

		// --- 5. Navigate to Customers ---
		console.log('📍 8/14: Customers');
		await page.click('a[href="/customers"]');
		await page.waitForURL('**/customers');
		await page.screenshot({ path: 'docs/walkthrough/10-customers.png' });

		// Open new customer modal
		console.log('📍 8a/14: New Customer Modal');
		const newCustomerBtn = page.getByRole('button', { name: /Pelanggan Baru/ });
		if (await newCustomerBtn.count() > 0) {
			await newCustomerBtn.click();
			await page.waitForSelector('.fixed.inset-0.z-50', { timeout: 5000 });
			await page.screenshot({ path: 'docs/walkthrough/10b-customers-new-customer.png' });
			await page.keyboard.press('Escape');
			await page.waitForSelector('.fixed.inset-0.z-50', { state: 'hidden', timeout: 5000 });
		}

		// --- 6. Navigate to Branches ---
		console.log('📍 9/14: Branches');
		await page.click('a[href="/branches"]');
		await page.waitForURL('**/branches');
		await page.screenshot({ path: 'docs/walkthrough/11-branches.png' });

		// Open new staff modal
		console.log('📍 10/14: New Staff Modal');
		const newStaffBtn = page.getByRole('button', { name: /Staf Baru/ });
		if (await newStaffBtn.count() > 0) {
			await newStaffBtn.click();
			await page.waitForSelector('.fixed.inset-0.z-50', { timeout: 5000 });
			await page.screenshot({ path: 'docs/walkthrough/11b-branches-new-staff.png' });
			await page.keyboard.press('Escape');
			await page.waitForSelector('.fixed.inset-0.z-50', { state: 'hidden', timeout: 5000 });
		}

		// --- 7. Navigate to Reports ---
		console.log('📍 11/14: Reports');
		await page.click('a[href="/reports"]');
		await page.waitForURL('**/reports');
		await page.screenshot({ path: 'docs/walkthrough/12-reports.png' });

		// --- 8. Navigate to Settings ---
		console.log('📍 12/14: Settings');
		await page.click('a[href="/settings"]');
		await page.waitForURL('**/settings');
		await page.screenshot({ path: 'docs/walkthrough/13-settings.png' });

		// --- 9. Logout ---
		console.log('📍 13/14: Logging out');
		const logoutBtn = page.getByRole('button', { name: /Keluar/ });
		if (await logoutBtn.count() > 0) {
			await logoutBtn.click();
		}
		await page.waitForURL('**/login', { timeout: 15000 });
		await page.screenshot({ path: 'docs/walkthrough/14-logout-back-to-login.png' });

		console.log('✅ Full walkthrough complete — screenshots saved to docs/walkthrough/');
	});
});
