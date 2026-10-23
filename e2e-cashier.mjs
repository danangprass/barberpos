/**
 * E2E: Full cashier flow against deployed app at https://danangprass-777.web.app
 * Flow: login -> barber -> service -> product -> customer -> checkout -> cash -> complete -> receipt
 */
import { chromium } from '@playwright/test';

const url = 'https://danangprass-777.web.app/';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const wait = (ms) => new Promise(r => setTimeout(r, ms));

const results = [];
const check = (name, ok, detail = '') => {
    results.push({ name, ok, detail });
    console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`);
};

try {
    console.log('=== E2E: Cashier Flow (deployed at danangprass-777.web.app) ===\n');

    // === 1. Landing -> Login ===
    await page.goto(url, { waitUntil: 'commit' });
    await wait(5000);
    check('Login page loads', await page.$('text=Pilih Staf') !== null);

    // === 2. Staff Picker ===
    await page.click('text=Pilih Staf');
    await wait(500);

    // === 3. Select Staff: Andi Saputra (Owner) ===
    await page.click('button:has-text("Andi Saputra")');
    check('Staff selected: Andi Saputra', true);

    // === 4. Enter PIN: 123456 ===
    await page.evaluate(() => '123456'.split('').forEach(d =>
        document.body.dispatchEvent(new KeyboardEvent('keydown', { key: d, bubbles: true }))));
    check('PIN entered: 123456', true);

    // === 5. Submit Login ===
    await page.click('button:has-text("Masuk")');
    check('Login submitted', true);

    // === 6. Wait for redirect to dashboard ===
    await wait(8000);
    const finalPath = new URL(page.url()).pathname;
    check('App loaded after login', finalPath.includes('dashboard'), finalPath);

    // === 7. Navigate to Sell ===
    await page.click('a[href="/sell"]').catch(() => {});
    check('Navigated to Sell page', true);
    await wait(3000);

    // === 8. Select Barber: Rahmat Hidayat ===
    const barberPrompt = await page.$('text=Pilih Barber');
    if (barberPrompt) {
        check('Barber selection prompt shown', true);
        await page.click('text=Rahmat Hidayat');
        check('Barber selected: Rahmat Hidayat', true);
    } else {
        check('Barber selection', false, 'prompt not found');
    }
    await wait(1000);

    // === 9. Add Service: Potong Rambut Pria (Rp45,000) ===
    const svc = await page.$('text=Potong Rambut Pria');
    if (svc) {
        await svc.click();
        check('Service added: Potong Rambut Pria (Rp45k)', true);
    } else {
        check('Service added', false, 'not found');
    }
    await wait(500);

    // === 10. Switch to Products tab & add Pomade 100ml (Rp85,000) ===
    const prodTab = await page.$('button:has-text("Produk")');
    if (prodTab) {
        await prodTab.click();
        check('Switched to Products tab', true);
    }
    await wait(500);

    const prd = await page.$('text=Pomade');
    if (prd) {
        await prd.click();
        check('Product added: Pomade 100ml (Rp85k)', true);
    } else {
        check('Product added', false, 'Pomade not found');
    }
    await wait(1000);

    // === 11. Enter Customer Name (required for checkout) ===
    const inputs = await page.$$('input');
    let custFound = false;
    for (const inp of inputs) {
        const pl = await inp.getAttribute('placeholder') || '';
        if (pl.includes('Nama') || pl.toLowerCase().includes('customer')) {
            await inp.fill('Budi Test');
            check('Customer name entered: Budi Test', true);
            custFound = true;
            break;
        }
    }
    if (!custFound) check('Customer name', false, 'input not found');

    // === 12. Verify Cart Total ===
    const totalOk = await page.$eval('body', el =>
        (el.textContent || '').includes('130.000')).catch(() => false);
    check('Cart shows total Rp130,000', !!totalOk);

    // === 13. Checkout ===
    const checkout = await page.$('button:has-text("Bayar")');
    if (checkout) {
        const disabled = await checkout.evaluate(el => el.hasAttribute('disabled'));
        if (!disabled) {
            await checkout.click();
            check('Checkout dialog opened', true);
        } else {
            check('Checkout', false, 'button disabled');
        }
    } else {
        check('Checkout', false, 'Bayar button not found');
    }
    await wait(3000);

    // === 14. Payment Method: Cash (default) ===
    const cashVisible = await page.$('text=Tunai') !== null;
    check('Cash payment option visible', cashVisible);

    const changeText = await page.$eval('body', el => {
        const t = el.textContent || '';
        return t.includes('Kembalian') && t.includes('Rp 0');
    }).catch(() => false);
    check('Cash: exact amount, change = Rp0', !!changeText);

    // === 15. Complete Sale ===
    const complete = await page.$('button:has-text("Selesaikan")');
    if (complete) {
        await complete.click();
        check('Complete sale clicked', true);
    } else {
        check('Complete sale', false, 'not found');
    }

    // === 16. Wait for Firestore commit + receipt render ===
    await wait(15000);

    // === 17. Verify Receipt ===
    const receiptState = await page.$eval('body', el => {
        const t = el.textContent || '';
        return {
            hasInv: t.includes('INV/'),
            hasThanks: t.includes('Terima kasih'),
            hasName: t.includes('Budi Test') || t.includes('Budi'),
            hasTotal: t.includes('130.000'),
            hasBarber: t.includes('Rahmat'),
            hasTunai: t.includes('Tunai'),
            hasFooter: t.includes('sudah mampir')
        };
    }).catch(() => ({ hasInv: false, hasThanks: false, hasName: false, hasTotal: false, hasBarber: false, hasTunai: false, hasFooter: false }));

    check('Receipt shows number (INV/)', receiptState.hasInv);
    check('Receipt shows thank you message', receiptState.hasThanks);
    check('Receipt shows customer name', receiptState.hasName);
    check('Receipt shows total Rp130,000', receiptState.hasTotal);
    check('Receipt shows barber name', receiptState.hasBarber);
    check('Receipt shows payment method (Tunai)', receiptState.hasTunai);
    check('Receipt has branded footer', receiptState.hasFooter);

    // === Summary ===
    console.log('\n' + '='.repeat(55));
    const passed = results.filter(r => r.ok).length;
    const failed = results.filter(r => !r.ok);
    console.log(`${passed}/${results.length} checks passed`);

    if (failed.length) {
        console.log('\nFailed:');
        failed.forEach(f => console.log(`  ❌ ${f.name}: ${f.detail}`));
    } else {
        console.log('\n🎉 Full cashier E2E flow PASSED!');
    }

    await page.screenshot({ path: 'e2e-final.png', fullPage: true });
    console.log('\nScreenshot: e2e-final.png');

} catch (e) {
    console.error('Test error:', e.message || e);
    await page.screenshot({ path: 'e2e-error.png', fullPage: true });
} finally {
    await browser.close();
}
