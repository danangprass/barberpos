/**
 * E2E: Comprehensive Owner Management Against Deployed App
 * Tests all owner abilities: staff CRUD, catalog, reports, settings, sign-out
 * Runs Chrome in VISIBLE mode (headless: false)
 */
import { chromium } from '@playwright/test';

const url = 'https://danangprass-777.web.app/';
const browser = await chromium.launch({ headless: false });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const wait = (ms) => new Promise(r => setTimeout(r, ms));

const results = [];
const check = (name, ok, detail = '') => {
    results.push({ name, ok, detail });
    const mark = ok ? 'PASS' : 'FAIL';
    console.log(`${mark} ${name}${detail ? ' - ' + detail : ''}`);
};

page.on('pageerror', err => console.log(`PAGEERROR: ${err.message.substring(0, 200)}`));

try {
    console.log('=== E2E: Full Owner Management (Chrome visible) ===\n');

    // ===== 1. LOGIN as Owner =====
    await page.goto(url, { waitUntil: 'commit' });
    await wait(5000);
    check('Login page loads', await page.$('text=Pilih Staf') !== null);

    await page.click('text=Pilih Staf');
    await page.click('button:has-text("Andi Saputra")');
    check('Owner selected: Andi Saputra', true);

    await page.evaluate(() => '123456'.split('').forEach(d =>
        document.body.dispatchEvent(new KeyboardEvent('keydown', { key: d, bubbles: true }))));
    await page.click('button:has-text("Masuk")');
    await wait(8000);
    const path = new URL(page.url()).pathname;
    check('Logged in as owner, path: ' + path, path.includes('dashboard'));

    // ===== 2. NAVIGATION - verify owner-only nav =====
    check('Owner sees Branches nav (owner-only)', await page.$('a[href="/branches"]') !== null);
    check('Owner sees Catalog nav', await page.$('a[href="/catalog"]') !== null);
    check('Owner sees Reports nav', await page.$('a[href="/reports"]') !== null);
    check('Owner sees Settings nav', await page.$('a[href="/settings"]') !== null);

    // ===== 3. BRANCHES PAGE - Staff Management =====
    await page.click('a[href="/branches"]').catch(() => {});
    await wait(3000);
    check('On branches (staff mgmt) page', new URL(page.url()).pathname.includes('branches'));

    // Verify existing staff
    const staffListOk = await page.$eval('body', el => {
        const t = el.textContent || '';
        return t.includes('Andi Saputra') && t.includes('Sari Wijaya') && t.includes('Rahmat Hidayat');
    }).catch(() => false);
    check('Existing staff list visible', !!staffListOk);

    // Verify roles displayed (Indonesian: Pemilik, Manajer, Tukang Cukur)
    const rolesOk = await page.$eval('body', el => {
        const t = el.textContent || '';
        return t.includes('Pemilik') && t.includes('Manajer') && t.includes('Tukang Cukur');
    }).catch(() => false);
    check('Staff roles displayed correctly', !!rolesOk);

    // Create new staff member
    const createBtn = await page.$('button:has-text("Staf Baru")');
    if (createBtn) {
        await createBtn.click();
        check('Clicked Staf Baru button', true);
    } else {
        check('Staf Baru button', false, 'not found');
    }
    await wait(1000);

    // Fill create form
    const nameInput = await page.$('input#s-name');
    if (nameInput) { await nameInput.fill('Test Owner E2E'); check('Staff name entered', true); }
    else { check('Staff name input', false); }

    const roleSelect = await page.$('select#s-role');
    if (roleSelect) { await roleSelect.selectOption('manager'); check('Role=manager selected', true); }
    else { check('Role select', false); }

    const phoneInput = await page.$('input#s-phone');
    if (phoneInput) { await phoneInput.fill('0812-9999-8888'); check('Phone entered', true); }
    else { check('Phone input', false); }

    const pinInputs = await page.$$('input[type="password"]');
    if (pinInputs.length >= 2) {
        await pinInputs[0].fill('999999');
        await pinInputs[1].fill('999999');
        check('PIN entered and confirmed', true);
    }

    // Select branch (find checkbox for b_sudirman or b_kemang)
    const checkboxes = await page.$$('input[type="checkbox"]');
    let branchSelected = false;
    for (const cb of checkboxes) {
        const parent = await cb.evaluate(el => el.closest('label,div')?.textContent || '');
        if (parent && (parent.includes('Sudirman') || parent.includes('Kemang'))) {
            const checked = await cb.evaluate(el => el.checked);
            if (!checked) await cb.click();
            branchSelected = true;
            break;
        }
    }
    check('Branch selected for new staff', branchSelected);

    // Save
    const saveBtn = await page.$('button:has-text("Simpan")');
    if (saveBtn) {
        await saveBtn.click();
        check('Save new staff clicked', true);
    } else { check('Save button', false); }
    await wait(6000);

    // Verify new staff in list
    const newStaffVisible = await page.$eval('body', el =>
        (el.textContent || '').includes('Test Owner E2E')).catch(() => false);
    check('New staff appears in list', !!newStaffVisible);

    // ===== 4. CATALOG PAGE =====
    await page.click('a[href="/catalog"]').catch(() => {});
    await wait(3000);
    check('On catalog page', new URL(page.url()).pathname.includes('catalog'));

    // Verify existing items
    const itemVisible = await page.$eval('body', el =>
        (el.textContent || '').includes('Potong Rambut Pria')).catch(() => false);
    check('Existing service visible', !!itemVisible);

    // Switch to products tab
    const prodTab = await page.$('button:has-text("Produk")');
    if (prodTab) { await prodTab.click(); check('Products tab switched', true); }
    else { check('Products tab', false); }
    await wait(500);

    const productVisible = await page.$eval('body', el =>
        (el.textContent || '').includes('Pomade')).catch(() => false);
    check('Existing product visible', !!productVisible);

    // ===== 5. REPORTS PAGE =====
    await page.click('a[href="/reports"]').catch(() => {});
    await wait(3000);
    check('On reports page', new URL(page.url()).pathname.includes('reports'));

    // Verify reports show data
    const reportData = await page.$eval('body', el => {
        const t = el.textContent || '';
        return t.toLowerCase().includes('rp') && t.toLowerCase().includes('total');
    }).catch(() => false);
    check('Report data visible', !!reportData);

    // Verify owner sees all branches in report filter
    const allBranches = await page.$eval('body', el => {
        const t = el.textContent || '';
        return t.includes('Sudirman') && t.includes('Kemang');
    }).catch(() => false);
    check('Owner sees both branches in reports', !!allBranches);

    // ===== 6. SETTINGS PAGE =====
    await page.click('a[href="/settings"]').catch(() => {});
    await wait(3000);
    check('On settings page', new URL(page.url()).pathname.includes('settings'));

    // Verify backend status shows Firestore + Auth
    const backendOk = await page.$eval('body', el => {
        const t = el.textContent || '';
        return t.includes('Firestore') && t.includes('Auth');
    }).catch(() => false);
    check('Settings shows Firestore + Auth', !!backendOk);

    // Edit receipt footer
    const textareas = await page.$$('textarea');
    if (textareas.length >= 2) {
        const testFooter = 'E2E test footer ' + Date.now();
        await textareas[1].fill(testFooter);
        check('Edited receipt footer', true);
        await wait(500);

        const saveSettings = await page.$('button:has-text("Simpan")');
        if (saveSettings) {
            await saveSettings.click();
            check('Save settings clicked', true);
        }
        await wait(2000);

        // Verify saved confirmation appears (visible for ~2.2s after save completes)
        const savedOk = await page.$eval('body', el => {
            const t = el.textContent || '';
            return t.toLowerCase().includes('tersimpan') || t.toLowerCase().includes('saved');
        }).catch(() => false);
        check('Settings saved confirmed', !!savedOk);
    } else {
        check('Settings edit', false, 'not enough textareas');
    }

    // ===== 7. SIGN OUT =====
    const signOutBtn = await page.$('button:has-text("Keluar")');
    if (signOutBtn) {
        await signOutBtn.click();
        check('Sign out clicked', true);
        await wait(3000);
        check('Back at login screen', new URL(page.url()).pathname.includes('login'));
    } else {
        check('Sign out', false, 'button not found');
    }

    // ===== Summary =====
    console.log('\n' + '='.repeat(60));
    const passed = results.filter(r => r.ok).length;
    const failed = results.filter(r => !r.ok);
    console.log(`${passed}/${results.length} checks passed`);

    if (failed.length) {
        console.log('\nFailed:');
        failed.forEach(f => console.log(`  FAIL: ${f.name} - ${f.detail}`));
    } else {
        console.log('\nALL Owner Management E2E checks PASSED!');
    }

    await page.screenshot({ path: 'e2e-owner-full.png', fullPage: true });
    console.log('\nScreenshot: e2e-owner-full.png');

} catch (e) {
    console.error('Test error:', e.message || e);
    await page.screenshot({ path: 'e2e-owner-full-err.png', fullPage: true });
} finally {
    await browser.close();
}