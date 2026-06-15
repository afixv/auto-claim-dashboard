const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
const fs = require('fs');
const path = './history.json';

// Terapkan Stealth Plugin untuk membypass Cloudflare
chromium.use(stealth);

async function runDailyClaim() {
  const today = new Date().getDate();
  const itemId = 1234 + today;
  const timestamp = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
  
  let logEntry = {
    date: timestamp,
    day: `Day-${today}`,
    itemId: itemId,
    loginStatus: 'Pending',
    claimStatus: 'Pending'
  };

  console.log(`\n[*] Memulai otomasi untuk Day-${today} | ItemID: ${itemId}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 Edg/145.0.0.0',
    viewport: { width: 1920, height: 1080 }
  });
  
  const page = await context.newPage();

  try {
    console.log('[*] Membuka web untuk bypass Cloudflare...');
    await page.goto('https://kageherostudio.com/event/?event=daily', { waitUntil: 'domcontentloaded' });
    
    // Tunggu dengan cerdas sampai judul halaman bukan "Just a moment..." (Bypass Cloudflare)
    console.log('[*] Menunggu Cloudflare Challenge selesai...');
    await page.waitForFunction(() => document.title !== 'Just a moment...', { timeout: 15000 }).catch(() => console.log('[!] Timeout menunggu Cloudflare, lanjut eksekusi...'));
    
    // Beri tambahan waktu ekstra agar token cf_clearance tersimpan sempurna di cookie browser
    await page.waitForTimeout(5000);

    console.log('[*] Mengeksekusi Login API...');
    const loginResponse = await page.evaluate(async (creds) => {
      const params = new URLSearchParams();
      params.append('txtuserid', creds.user);
      params.append('txtpassword', creds.pass);

      const res = await fetch('https://kageherostudio.com/event/index_.php?act=login', {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'x-requested-with': 'XMLHttpRequest'
        },
        body: params.toString()
      });
      return await res.text();
    }, { user: process.env.GAME_USER, pass: process.env.GAME_PASSWORD });

    logEntry.loginStatus = loginResponse.trim();
    console.log(`[+] Status Login: ${logEntry.loginStatus}`);

    // Cek apakah response mengandung indikator sukses (biasanya kata "success" atau "1")
    if (loginResponse.includes('success') || loginResponse.trim() === '1') {
        console.log('[*] Mengeksekusi Claim API...');
        const claimResponse = await page.evaluate(async (data) => {
          const params = new URLSearchParams();
          params.append('itemId', data.itemId);
          params.append('periodId', '42');
          params.append('selserver', '47');

          const res = await fetch('https://kageherostudio.com/event/index_.php?act=daily', {
            method: 'POST',
            headers: {
              'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
              'x-requested-with': 'XMLHttpRequest'
            },
            body: params.toString()
          });
          return await res.text();
        }, { itemId: itemId.toString() });

        logEntry.claimStatus = claimResponse.trim();
        console.log(`[+] Status Claim: ${logEntry.claimStatus}`);
    } else {
        logEntry.claimStatus = 'Batal (Login Gagal/Terblokir)';
        console.log('[-] Claim dibatalkan karena login gagal.');
    }

  } catch (error) {
    logEntry.claimStatus = `Error: ${error.message}`;
    console.error('[-] Terjadi kesalahan:', error.message);
  } finally {
    await browser.close();
    saveLog(logEntry);
  }
}

function saveLog(newEntry) {
  let history = [];
  if (fs.existsSync(path)) {
    const rawData = fs.readFileSync(path);
    history = JSON.parse(rawData);
  }
  
  history.unshift(newEntry);
  if (history.length > 30) history = history.slice(0, 30); 
  
  fs.writeFileSync(path, JSON.stringify(history, null, 2));
  console.log('[*] Log berhasil disimpan ke history.json');
}

runDailyClaim();
