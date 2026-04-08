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

const IMAGES = {
  'icon.png':    Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAB0AAAAdCAYAAABWk2cPAAAA4UlEQVR4nO3WPQqDQBQE4DEEA+sR/LmAZ9BWW8vYx1JrPYkBU8baK2jOYC9qo72NgU06o6RRFElgX/WWGfarFpaTRPGFneewN8hQhjKUoetQPwhQ1TWquobreZPM9bwh84NgO3TrYShD90OffT/sJ56fZOPzuLcabdp22CVZnmSyonx6TbMd+sgyUEoBAKZpQtN1EEKg6ToMwwAAUEqRpuks9DinVBQFblGEi+OAEII4jr861zBEWZazUG7Jb9CyLJxtG6qqQhAEdF2HPM8R3+9IkmTuNcvQreZ3nwxD/wp9A+sZRlZ2AldnAAAAAElFTkSuQmCC', 'base64'),
  'icon@2x.png': Buffer.from('iVBORw0KGgoAAAANSUhEUgAAADoAAAA6CAYAAADhu0ooAAABxklEQVR4nO2av07CUBSHfy2EkpB0ASacwYWQMigLC7O+g0p5Dl0g+gSaEHH0z6yL7uCs0bDIE7BA4TLQmzq4mLQYJQclx/ONJz2nvy9nuTe5xkYuF+AfYP51gN9CRLkhotwQUW6IKDdElBsiyg0R5YaIckNEuSGi3BBRbsSpBtm2jZfX11BdKYVCPv9l79tggEQiEapvFgqYTqck+f7NRkWUGyLKDRHlhohyQ0S5IaI/JQjo33xQziQTVUpFBrMs6+sAphl5c9FaYzabUcWjE9VaYzKZhOqxWAzpdHphXzabjayPRqP13CgA9Pv9yLrjOAt7yuXyj2YtC6lor9uNrB/U6zAMI/xz04TrutGzej3KaLSil1dX8H0/VK9Wq2i32yiVSrAsC8lkEo7joHNxga3t7dD38/kcN9fXlNFgUD+ROzw6Wril73J2eopms0mU6ANy0Xg8jvNOB7Vaban+h/t7NBoNaK0pY9EfGHzfx/7eHk6OjzHxvG/3eZ6HVqsF13XJJYEVbPQzqVQKO7u7qFQqKBaLyGQysG0bQRBgPB5jOBzi+ekJvcdH3N3eQim1qiirFV0n5KzLDRHlhohyQ0S5IaLceAfJE4OOvKPlDwAAAABJRU5ErkJggg==', 'base64'),
  'logo.png':    Buffer.from('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', 'base64'),
  'logo@2x.png': Buffer.from('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', 'base64'),
  'strip.png':   Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAUAAAAB7CAYAAAAFWllwAAABrklEQVR4nO3UQQEAEADAQNSgf01ieOwuwV6bZ+87AILW7wCAXwwQyDJAIMsAgSwDBLIMEMgyQCDLAIEsAwSyDBDIMkAgywCBLAMEsgwQyDJAIMsAgSwDBLIMEMgyQCDLAIEsAwSyDBDIMkAgywCBLAMEsgwQyDJAIMsAgSwDBLIMEMgyQCDLAIEsAwSyDBDIMkAgywCBLAMEsgwQyDJAIMsAgSwDBLIMEMgyQCDLAIEsAwSyDBDIMkAgywCBLAMEsgwQyDJAIMsAgSwDBLIMEMgyQCDLAIEsAwSyDBDIMkAgywCBLAMEsgwQyDJAIMsAgSwDBLIMEMgyQCDLAIEsAwSyDBDIMkAgywCBLAMEsgwQyDJAIMsAgSwDBLIMEMgyQCDLAIEsAwSyDBDIMkAgywCBLAMEsgwQyDJAIMsAgSwDBLIMEMgyQCDLAIEsAwSyDBDIMkAgywCBLAMEsgwQyDJAIMsAgSwDBLIMEMgyQCDLAIEsAwSyDBDIMkAgywCBLAMEsgwQyDJAIMsAgSwDBLIMEMgyQCDLAIEsAwSyDBDIMkAgywCBLAMEsgwQyHqUzAJH4jgnvgAAAABJRU5ErkJggg==', 'base64'),
};

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

function stampRow(stamps) {
  let r=''; for(let i=0;i<10;i++) r+= i<stamps?'☕':(i===9?'★':'○'); return r;
}

function buildPass(member) {
  const stamps = member.stamps || 0;
  return {
    formatVersion: 1,
    passTypeIdentifier: APPLE_PASS_TYPE_ID,
    serialNumber: member.id,
    teamIdentifier: APPLE_TEAM_ID,
    organizationName: 'UTOPICO',
    description: 'UTOPICO Loyalty Card',
    logoText: '',
    backgroundColor: 'rgb(00, 00, 00)',
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
        const req = client.request({ ':method': 'POST', ':path': '/3/device/'+reg.push_token, 'apns-topic': APPLE_PASS_TYPE_ID, 'apns-push-type': 'alert', 'content-type': 'application/json' });
        req.write('{}'); req.end();
        req.on('response', (h) => { console.log('Push sent:', h[':status']); client.close(); resolve(); });
        req.on('error', (e) => { console.log('Push error:', e.message); client.close(); resolve(); });
        setTimeout(() => { client.close(); resolve(); }, 5000);
      });
    } catch(e) { console.log('Push exception:', e.message); }
  }
}

app.get('/health', (_, res) => res.json({ status: 'ok', cert: !!APPLE_CERT, push: !!WALLET_PUSH_CERT }));

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

app.post('/apple-wallet/v1/devices/:deviceId/registrations/:passTypeId/:serialNumber', async (req, res) => {
  const { deviceId, serialNumber } = req.params;
  const { pushToken } = req.body;
  await db.from('wallet_registrations').upsert({ device_id: deviceId, push_token: pushToken, pass_type_id: APPLE_PASS_TYPE_ID, serial_number: serialNumber });
  res.status(201).send();
});

app.delete('/apple-wallet/v1/devices/:deviceId/registrations/:passTypeId/:serialNumber', async (req, res) => {
  const { deviceId, serialNumber } = req.params;
  await db.from('wallet_registrations').delete().eq('device_id', deviceId).eq('serial_number', serialNumber);
  res.status(200).send();
});

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

app.get('/apple-wallet/v1/devices/:deviceId/registrations/:passTypeId', async (req, res) => {
  const { deviceId } = req.params;
  const { data: regs } = await db.from('wallet_registrations').select('serial_number').eq('device_id', deviceId);
  if (!regs || !regs.length) return res.status(204).send();
  res.json({ serialNumbers: regs.map(r => r.serial_number), lastUpdated: new Date().toISOString() });
});

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
