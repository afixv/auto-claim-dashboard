const { chromium } = require('playwright');
const fs = require('fs');
const path = './history.json';

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
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 Edg/145.0.0.0'
  });
  
  const page = await context.newPage();

  try {
    console.log('[*] Membuka web untuk bypass Cloudflare...');
    await page.goto('https://kageherostudio.com/event/?event=daily', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

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
        logEntry.claimStatus = 'Batal (Login Gagal)';
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

// Fungsi untuk menyimpan riwayat ke JSON
function saveLog(newEntry) {
  let history = [];
  if (fs.existsSync(path)) {
    const rawData = fs.readFileSync(path);
    history = JSON.parse(rawData);
  }
  
  history.unshift(newEntry); // Masukkan data baru di urutan teratas
  // Simpan maksimal 30 riwayat terakhir agar file tidak bengkak
  if (history.length > 30) history = history.slice(0, 30); 
  
  fs.writeFileSync(path, JSON.stringify(history, null, 2));
  console.log('[*] Log berhasil disimpan ke history.json');
}

runDailyClaim();
