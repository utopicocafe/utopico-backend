const express  = require('express');
const cors     = require('cors');
const path     = require('path');
const fs       = require('fs');
const crypto   = require('crypto');
const https    = require('https');
const http2    = require('http2');
const { execSync } = require('child_process');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());

const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const APPLE_TEAM_ID        = process.env.APPLE_TEAM_ID;
const APPLE_PASS_TYPE_ID   = process.env.APPLE_PASS_TYPE_ID;

const APPLE_CERT = process.env.APPLE_CERT_B64 ? Buffer.from(process.env.APPLE_CERT_B64, 'base64').toString('utf8') : null;
const APPLE_KEY  = process.env.APPLE_KEY_B64  ? Buffer.from(process.env.APPLE_KEY_B64,  'base64').toString('utf8') : null;
const APPLE_WWDR = process.env.APPLE_WWDR_B64 ? Buffer.from(process.env.APPLE_WWDR_B64, 'base64').toString('utf8') : null;
const WALLET_PUSH_CERT = process.env.WALLET_PUSH_CERT_B64 ? Buffer.from(process.env.WALLET_PUSH_CERT_B64, 'base64').toString('utf8') : null;
const WALLET_PUSH_KEY  = process.env.WALLET_PUSH_KEY_B64  ? Buffer.from(process.env.WALLET_PUSH_KEY_B64,  'base64').toString('utf8') : null;

console.log('CERT starts:', APPLE_CERT ? APPLE_CERT.substring(0,27) : 'null');
console.log('Push cert:', !!WALLET_PUSH_CERT);

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ── IMAGES ──
const IMAGES = {
  'icon.png':    Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAB0AAAAdCAYAAABWk2cPAAAAuUlEQVR4nO3WoQ2EQBCF4Z8NwWMQsLRAC0czWASFHAZzlEAB1EANcI4NAo8AxJ3bnEAgNoRc9qmXySSfGTGOjKIPF0dcDVrUohb9I/RZloxKMSpFkiR67rqunrdtaxY1HYta9Dp033fdPc877Ou2mUXfw6B7JOVh/90xgjZNwzRNAGRZhoxjfN+nKAoAlmXhVdenUefsjxQEAXme80hTwjBECME8z3RdR1VVDH1vHjWZ+16vRS16S/QLlIg3ced5+FYAAAAASUVORK5CYII=', 'base64'),
  'icon@2x.png': Buffer.from('iVBORw0KGgoAAAANSUhEUgAAADoAAAA6CAYAAADhu0ooAAABu0lEQVR4nO2aPWvCYBSFj0X8wKEOVYR0DOjoYNe6iBm0Q90yu4oF9/o3pC510cx1d6+Lm4s2DuooGKWiiGLXliRi0zdtud4HspzkhPuQT0g815J0wBlw8dcD/BYsSg0WpQaLUoNFqcGi1GBRarAoNViUGixKDRb9LrIsYzKdmpanev1or1KpWPZyuZyo0QDwEaUHi1KDRanBotRgUWqwKDWEiR4OYj+ci96fMNHVamWZ+3y+o71AIGCZv9vszynCRA3DsMyj0ejRXsRmvTGf/3SkLwgT3Ww2mIzHpjwejyMYDNr2ksmkKdvv99B1XdRoAATfjF67XVPm9/uhqqrl9rfpNGRZNuX9ft/2UnCKUFGt1bLMH6tVlEolSJIEr9eLq0gEqqqiVqtZbt9qNkWOBQDwiP7P6LnRQCaTcdx/Gw6hKAq2263AqVx4jj6UyxgMBo66s9kMxWJRuCTgguhyucRdPg9N07Db7U7udTodKNksRqOR6JEAuHDqfiYWi+G+UMBNKoVEIoHLcBihUAjr9RoLxQIjXUev18NLu42hw7PgVFwV/U/wuy41WJQaLEoNFqUGi1KDRalxNqIfJLOLGZuQQwoAAAAASUVORK5CYII=', 'base64'),
  'logo.png':    Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAKAAAAAyCAYAAADbYdBlAAADlElEQVR4nO3dO2/TUBTG4dRpSAIJEEgghAQDgwUGA2JDYkFiQ+oNiQ2pF6QuSF2QukDqgtQFqQtSF6QuSF2QukDqAqkLUhekLkg9kLpA6oLUBakLUhekLkhdkLogdUHqgtQFqQtSF6QuSF2QukDqgtQFqQtSF6QuSF2QukDqgtQFqQtSF6QuSF2QukDqgtQFqQtSF6QuSF2QukDqgtQFqQtSF6QuSF2QukDqgtQFqQtSF6QuSF2QukDqgtQFqQtSF6QuSF2QukDqgtQFqQtSF6QuSF2QukDqgtQFqQtSF6QuSF2QukDqgtQFqQtSF6QuSF2QukDqgtQFqQtSF6QuSF2QukDqgtQFqQtSF6QuSF2QukDqgtQFqQtSF6QuSF2QukDqgtQFqQtSF6QuSF2QukDqgtQFqQtSF6QuSF2QukDqgtQFqQtSF6QuSF2QukDqgtQFqQtSF6QuSF2QukDqgtQFqQtSF6QuSF2QukDqgtQFqQtSF6QuSF2QukDqgtQFqQtSF6QuSF2QukDqgtQFqQtSF6QuSF2QukDqgtQFqQtSF6QuSF2QukDqgtQFqQtSF6QuSF2QukDqgtQFqQtSF6QuSF2QukDqgtQFqQtSF6QuSF2QukDqgtQFqQtSF6QuSF2QukDqgtQFqQtSF6QuSF2QukDqgtQFqQtSF6QuSF2QukDqgtQFqQtSF6QuSF2QukDqgtQFqQtSF6QuSF2QukDqgtQFqQtSF6QuSF2QukDqgtQFqQtSF6QuSF2QukDqgtQFqQtSF6QuSF2QukDqgtQFqQtSF6QuSF2QukDqgtQFqQtSF6QuSF2QukDqgtQFqQtSF6QuSF2QukDqgtQFqQtSF6QuSF2QukDqgtQFqQtSF6QuSF2QukDqgtQFqQtSF6QuSF2QukDqgtQFqQtSF6QuSF2QukDqgtQFqQtSF6QuSF2QukDqgtQFqQtSF6QuSF2QukDqgtQFqQtSF6QuSF2QukDqgtQFqQtSF6QuSF2QukDqgtQFqQtSF6QuSF2QukDqgtQFqQtSF6QuSF2QukDqgtQFqQtSF6QuSF2QukDqgtQFqQtSF6QuSF2QukDqgtQFqQtSF6QuSF2QukDqgtQFqQtSF6QuSF2QukDqgtQFqQtSF6QuSF2QukDqgtQFqQtSF6QuSF2QukDqgtQFqQtSF6QuSF2QukDqgtQFqQtSF6QuSF2QukDqgtQFqQtSF6QuSF2QukDqgtQFqQtSF6QuSF2QukDqgtQFqQtSF6QuSF2QukDqgtQFqQtSF6QuSF2QukDqgtQFqQtSF6QuSF2QukDqgtQFqQtSF6QuSF2QukDqgtQFqQtSF6QuSF2QukDqgtQFqQtSF6QuSF2QukDqgtQFqQtSF6QuSF2Qur8BnwHSF1eFqgAAAABJRU5ErkJggg==', 'base64'),
  'logo@2x.png': Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAUAAAABkCAYAAAD32uk+AAADyElEQVR4nO3BMQEAAADCoPVP7WsIoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAeAMBuAABHgAAAABJRU5ErkJggg==', 'base64'),
  'strip.png':   Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAUAAAAB7CAYAAAAFWllwAAAAMklEQVR4nO3BMQEAAADCoPVP7WsIoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAeAMBuAABHgAAAABJRU5ErkJggg==', 'base64'),
};

// ── ZIP WRITER ──
function crc32(buf) {
  if (!crc32.t) { crc32.t = new Uint32Array(256); for (let i=0;i<256;i++){let c=i;for(let j=0;j<8;j++)c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1);crc32.t[i]=c;} }
  let c=0xFFFFFFFF; for(let i=0;i<buf.length;i++)c=(c>>>8)^crc32.t[(c^buf[i])&0xFF]; return(c^0xFFFFFFFF)>>>0;
}
function writeZip(files) {
  const parts=[],cd=[]; let off=0;
  for(const f of files){
    const nb=Buffer.from(f.name,'utf8'),d=f.data,crc=crc32(d);
    const lh=Buffer.alloc(30+nb.length);
    lh.writeUInt32LE(0x04034b50,0);lh.writeUInt16LE(20,4);lh.writeUInt16LE(0,6);lh.writeUInt16LE(0,8);lh.writeUInt16LE(0,10);lh.writeUInt16LE(0,12);
    lh.writeUInt32LE(crc,14);lh.writeUInt32LE(d.length,18);lh.writeUInt32LE(d.length,22);lh.writeUInt16LE(nb.length,26);lh.writeUInt16LE(0,28);nb.copy(lh,30);
    const ce=Buffer.alloc(46+nb.length);
    ce.writeUInt32LE(0x02014b50,0);ce.writeUInt16LE(20,4);ce.writeUInt16LE(20,6);ce.writeUInt16LE(0,8);ce.writeUInt16LE(0,10);ce.writeUInt16LE(0,12);ce.writeUInt16LE(0,14);
    ce.writeUInt32LE(crc,16);ce.writeUInt32LE(d.length,20);ce.writeUInt32LE(d.length,24);ce.writeUInt16LE(nb.length,28);ce.writeUInt16LE(0,30);ce.writeUInt16LE(0,32);ce.writeUInt16LE(0,34);ce.writeUInt16LE(0,36);ce.writeUInt32LE(0,38);ce.writeUInt32LE(off,42);nb.copy(ce,46);
    parts.push(lh,d);cd.push(ce);off+=lh.length+d.length;
  }
  const cdb=Buffer.concat(cd),eocd=Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50,0);eocd.writeUInt16LE(0,4);eocd.writeUInt16LE(0,6);eocd.writeUInt16LE(files.length,8);eocd.writeUInt16LE(files.length,10);eocd.writeUInt32LE(cdb.length,12);eocd.writeUInt32LE(off,16);eocd.writeUInt16LE(0,20);
  return Buffer.concat([...parts,cdb,eocd]);
}

// ── STAMP ROW ──
function stampRow(stamps) {
  let r=''; for(let i=0;i<10;i++) r+= i<stamps?'☕':(i===9?'★':'○'); return r;
}

// ── BUILD PASS ──
function buildPass(member) {
  const stamps = member.stamps || 0;
  return {
    formatVersion: 1,
    passTypeIdentifier: APPLE_PASS_TYPE_ID,
    serialNumber: member.id,
    teamIdentifier: APPLE_TEAM_ID,
    organizationName: 'UTOPICO',
    description: 'UTOPICO Loyalty Card',
    logoText: 'UTOPICO',
    backgroundColor: 'rgb(28, 27, 27)',
    foregroundColor: 'rgb(255, 255, 255)',
    labelColor: 'rgb(160, 160, 160)',
    storeCard: {
      headerFields: [{ key: 'stamps', label: 'STAMPS', value: Math.min(stamps,10)+'/10', textAlignment: 'PKTextAlignmentRight' }],
      primaryFields: [{ key: 'stamps_row', label: stamps>=10?'★ FREE COFFEE':'YOUR STAMPS', value: stampRow(stamps) }],
      secondaryFields: [{ key: 'member', label: 'MEMBER', value: (member.name+' '+member.surname).toUpperCase() }],
      auxiliaryFields: [{ key: 'since', label: 'SINCE', value: new Date(member.created_at).toLocaleDateString('en-GB',{month:'long',year:'numeric'}) }],
      backFields: [
        { key: 'howto', label: 'HOW IT WORKS', value: 'Every coffee counts. Collect 10 stamps and your next one is on us.' },
        { key: 'website', label: 'WEBSITE', value: 'utopico.coffee' },
        { key: 'slogan', label: '', value: 'Utopia is a state of mind.' }
      ]
    },
    barcode: { message: 'https://energetic-motivation-production.up.railway.app/barista?scan='+member.id, format: 'PKBarcodeFormatQR', messageEncoding: 'iso-8859-1', altText: 'UTOPICO Loyalty' },
    locations: [{ longitude: -3.7038, latitude: 40.4168, relevantText: "You're near UTOPICO! Show your loyalty card." }],
    maxDistance: 500,
    authenticationToken: member.apple_pass_token || crypto.randomBytes(16).toString('hex'),
    webServiceURL: 'https://energetic-motivation-production.up.railway.app/apple-wallet'
  };
}

// ── GENERATE PKPASS ──
function generatePkpass(member) {
  const passDir = '/tmp/pass_'+Date.now();
  fs.mkdirSync(passDir, { recursive: true });
  fs.writeFileSync(passDir+'/cert.pem', APPLE_CERT);
  fs.writeFileSync(passDir+'/key.pem', APPLE_KEY);
  fs.writeFileSync(passDir+'/wwdr.pem', APPLE_WWDR);
  fs.writeFileSync(passDir+'/pass.json', JSON.stringify(buildPass(member)));
  for(const [name,data] of Object.entries(IMAGES)) fs.writeFileSync(passDir+'/'+name, data);
  const skip=new Set(['cert.pem','key.pem','wwdr.pem']);
  const manifest={};
  fs.readdirSync(passDir).forEach(f=>{ if(!skip.has(f)) manifest[f]=crypto.createHash('sha1').update(fs.readFileSync(passDir+'/'+f)).digest('hex'); });
  fs.writeFileSync(passDir+'/manifest.json', JSON.stringify(manifest));
  execSync('openssl smime -sign -signer '+passDir+'/cert.pem -inkey '+passDir+'/key.pem -certfile '+passDir+'/wwdr.pem -in '+passDir+'/manifest.json -out '+passDir+'/signature -outform DER -binary');
  const zipFiles=fs.readdirSync(passDir).filter(f=>!skip.has(f)).map(f=>({name:f,data:fs.readFileSync(passDir+'/'+f)}));
  const buf=writeZip(zipFiles);
  try { execSync('rm -rf '+passDir); } catch {}
  return buf;
}

// ── SEND PUSH ──
async function sendPushNotifications(memberId) {
  if (!WALLET_PUSH_CERT || !WALLET_PUSH_KEY) return;
  const { data: regs } = await db.from('wallet_registrations').select('push_token').eq('serial_number', memberId);
  if (!regs || !regs.length) return;
  const certPath='/tmp/wpc.pem', keyPath='/tmp/wpk.pem';
  fs.writeFileSync(certPath, WALLET_PUSH_CERT);
  fs.writeFileSync(keyPath, WALLET_PUSH_KEY);
  for (const reg of regs) {
    try {
      await new Promise((resolve) => {
        const client = http2.connect('https://api.push.apple.com', { cert: fs.readFileSync(certPath), key: fs.readFileSync(keyPath) });
        const req = client.request({
          ':method': 'POST',
          ':path': '/3/device/'+reg.push_token,
          'apns-topic': APPLE_PASS_TYPE_ID,
          'apns-push-type': 'alert',
          'content-type': 'application/json',
        });
        req.write('{}');
        req.end();
        req.on('response', (h) => { console.log('Push sent:', h[':status']); client.close(); resolve(); });
        req.on('error', (e) => { console.log('Push error:', e.message); client.close(); resolve(); });
        setTimeout(() => { client.close(); resolve(); }, 5000);
      });
    } catch(e) { console.log('Push exception:', e.message); }
  }
}

app.get('/health', (_, res) => res.json({ status: 'ok', cert: !!APPLE_CERT, push: !!WALLET_PUSH_CERT }));

// ── GENERATE PASS ──
app.get('/wallet/apple/:memberId', async (req, res) => {
  try {
    if (!APPLE_CERT || !APPLE_KEY || !APPLE_WWDR) return res.status(500).json({ error: 'Certs missing' });
    const { data: member, error } = await db.from('members').select('*').eq('id', req.params.memberId).single();
    if (error || !member) return res.status(404).json({ error: 'Member not found' });
    let token = member.apple_pass_token;
    if (!token) {
      token = crypto.randomBytes(16).toString('hex');
      await db.from('members').update({ apple_pass_token: token }).eq('id', member.id);
      member.apple_pass_token = token;
    }
    const buf = generatePkpass(member);
    const pkpassPath = '/tmp/utopico_'+member.id+'.pkpass';
    fs.writeFileSync(pkpassPath, buf);
    res.setHeader('Content-Type', 'application/vnd.apple.pkpass');
    res.setHeader('Content-Disposition', 'attachment; filename="utopico.pkpass"');
    res.sendFile(pkpassPath, () => { try { fs.unlinkSync(pkpassPath); } catch {} });
    console.log('Pass sent for', member.name);
  } catch (err) { console.error('ERROR:', err.message); res.status(500).json({ error: err.message }); }
});

// ── APPLE WALLET WEB SERVICE ──
// Register device
app.post('/apple-wallet/v1/devices/:deviceId/registrations/:passTypeId/:serialNumber', async (req, res) => {
  const { deviceId, serialNumber } = req.params;
  const { pushToken } = req.body;
  await db.from('wallet_registrations').upsert({ device_id: deviceId, push_token: pushToken, pass_type_id: APPLE_PASS_TYPE_ID, serial_number: serialNumber });
  res.status(201).send();
});

// Unregister device
app.delete('/apple-wallet/v1/devices/:deviceId/registrations/:passTypeId/:serialNumber', async (req, res) => {
  const { deviceId, serialNumber } = req.params;
  await db.from('wallet_registrations').delete().eq('device_id', deviceId).eq('serial_number', serialNumber);
  res.status(200).send();
});

// Get updated pass
app.get('/apple-wallet/v1/passes/:passTypeId/:serialNumber', async (req, res) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).send();
  const token = authHeader.replace('ApplePass ', '');
  const { data: member } = await db.from('members').select('*').eq('id', req.params.serialNumber).eq('apple_pass_token', token).single();
  if (!member) return res.status(401).send();
  const buf = generatePkpass(member);
  res.setHeader('Content-Type', 'application/vnd.apple.pkpass');
  res.setHeader('Last-Modified', new Date().toUTCString());
  res.send(buf);
});

// List passes for device
app.get('/apple-wallet/v1/devices/:deviceId/registrations/:passTypeId', async (req, res) => {
  const { deviceId } = req.params;
  const { data: regs } = await db.from('wallet_registrations').select('serial_number').eq('device_id', deviceId);
  if (!regs || !regs.length) return res.status(204).send();
  res.json({ serialNumbers: regs.map(r => r.serial_number), lastUpdated: new Date().toISOString() });
});

// ── STAMP WEBHOOK (called after adding stamp) ──
app.post('/webhook/stamp-updated', async (req, res) => {
  const { record } = req.body;
  if (!record) return res.sendStatus(400);
  console.log('Stamp updated for', record.id, '- sending push');
  sendPushNotifications(record.id).catch(e => console.log('Push error:', e.message));
  res.sendStatus(200);
});

app.get('/barista', (req, res) => res.redirect('https://utopicocafe.github.io/utopico-backend/barista.html?scan='+req.query.scan));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('UTOPICO backend running on port '+PORT));
