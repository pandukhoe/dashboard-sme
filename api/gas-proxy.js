// api/gas-proxy.js
//
// Proxy kecil supaya browser tidak perlu manggil script.google.com langsung
// (yang kena aturan CORS). Browser cukup manggil endpoint SATU DOMAIN ini
// (/api/gas-proxy), lalu server Vercel yang meneruskan request ke Google Apps
// Script. Request server-ke-server TIDAK kena aturan CORS sama sekali --
// CORS itu murni pembatasan browser, bukan server.
//
// Cara pakai dari front-end:
//   fetch('/api/gas-proxy?url=' + encodeURIComponent(APPS_SCRIPT_URL), {
//     method: 'POST',
//     headers: { 'Content-Type': 'text/plain;charset=utf-8' },
//     body: JSON.stringify(payload),
//   })
//
// Demi keamanan, proxy ini HANYA mau meneruskan ke URL yang diawali
// "https://script.google.com/macros/" -- supaya endpoint ini tidak bisa
// disalahgunakan orang lain sebagai proxy umum ke sembarang alamat.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed, pakai POST.' });
    return;
  }

  const targetUrl = req.query.url;
  if (!targetUrl || typeof targetUrl !== 'string' || !targetUrl.startsWith('https://script.google.com/macros/')) {
    res.status(400).json({ ok: false, error: 'Parameter url tidak ada / tidak valid (harus URL script.google.com/macros/...)' });
    return;
  }

  // Ambil body mentah. Vercel otomatis parse body kalau Content-Type
  // application/json, tapi front-end kita kirim text/plain (sengaja, biar
  // browser tidak kirim preflight OPTIONS ke Google) jadi req.body berupa
  // string mentah -- kita teruskan apa adanya ke Apps Script.
  let bodyText;
  if (typeof req.body === 'string') {
    bodyText = req.body;
  } else if (req.body && typeof req.body === 'object') {
    bodyText = JSON.stringify(req.body);
  } else {
    bodyText = await new Promise((resolve) => {
      let data = '';
      req.on('data', (chunk) => { data += chunk; });
      req.on('end', () => resolve(data));
    });
  }

  try {
    const gasRes = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: bodyText,
    });
    const text = await gasRes.text();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(200).send(text);
  } catch (err) {
    res.status(502).json({ ok: false, error: 'Proxy gagal menghubungi Apps Script: ' + err.message });
  }
}
