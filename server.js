const express  = require('express');
const cors     = require('cors');
const path     = require('path');
const fs       = require('fs');
const crypto   = require('crypto');
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

console.log('CERT starts:', APPLE_CERT ? APPLE_CERT.substring(0,27) : 'null');

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Pure Node.js ZIP writer (no external tools needed)
function writeZip(files) {
  // files = [{name, data}] where data is Buffer
  const parts = [];
  const centralDir = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = Buffer.from(file.name, 'utf8');
    const data = file.data;
    const crc = crc32(data);
    const localHeader = Buffer.alloc(30 + nameBytes.length);
    localHeader.writeUInt32LE(0x04034b50, 0); // signature
    localHeader.writeUInt16LE(20, 4);          // version
    localHeader.writeUInt16LE(0, 6);           // flags
    localHeader.writeUInt16LE(0, 8);           // no compression
    localHeader.writeUInt16LE(0, 10);          // mod time
    localHeader.writeUInt16LE(0, 12);          // mod date
    localHeader.writeUInt32LE(crc >>> 0, 14);  // crc32
    localHeader.writeUInt32LE(data.length, 18);// compressed size
    localHeader.writeUInt32LE(data.length, 22);// uncompressed size
    localHeader.writeUInt16LE(nameBytes.length, 26); // name length
    localHeader.writeUInt16LE(0, 28);          // extra length
    nameBytes.copy(localHeader, 30);

    const centralEntry = Buffer.alloc(46 + nameBytes.length);
    centralEntry.writeUInt32LE(0x02014b50, 0); // signature
    centralEntry.writeUInt16LE(20, 4);
    centralEntry.writeUInt16LE(20, 6);
    centralEntry.writeUInt16LE(0, 8);
    centralEntry.writeUInt16LE(0, 10);
    centralEntry.writeUInt16LE(0, 12);
    centralEntry.writeUInt16LE(0, 14);
    centralEntry.writeUInt32LE(crc >>> 0, 16);
    centralEntry.writeUInt32LE(data.length, 20);
    centralEntry.writeUInt32LE(data.length, 24);
    centralEntry.writeUInt16LE(nameBytes.length, 28);
    centralEntry.writeUInt16LE(0, 30);
    centralEntry.writeUInt16LE(0, 32);
    centralEntry.writeUInt16LE(0, 34);
    centralEntry.writeUInt16LE(0, 36);
    centralEntry.writeUInt32LE(0, 38);
    centralEntry.writeUInt32LE(offset, 42);
    nameBytes.copy(centralEntry, 46);

    parts.push(localHeader, data);
    centralDir.push(centralEntry);
    offset += localHeader.length + data.length;
  }

  const centralDirBuf = Buffer.concat(centralDir);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralDirBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...parts, centralDirBuf, eocd]);
}

function crc32(buf) {
  const table = makeCrcTable();
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

let crcTable = null;
function makeCrcTable() {
  if (crcTable) return crcTable;
  crcTable = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    crcTable[i] = c;
  }
  return crcTable;
}

app.get('/health', (_, res) => res.json({ status: 'ok', cert: !!APPLE_CERT }));

app.get('/wallet/apple/:memberId', async (req, res) => {
  try {
    console.log('Request for:', req.params.memberId);
    if (!APPLE_CERT || !APPLE_KEY || !APPLE_WWDR) return res.status(500).json({ error: 'Certs missing' });

    const { data: member, error } = await db.from('members').select('*').eq('id', req.params.memberId).single();
    if (error || !member) return res.status(404).json({ error: 'Member not found' });

    const stamps = member.stamps || 0;
    const ts = Date.now();
    const passDir = `/tmp/pass_${ts}`;
    fs.mkdirSync(passDir, { recursive: true });

    fs.writeFileSync(`${passDir}/cert.pem`, APPLE_CERT);
    fs.writeFileSync(`${passDir}/key.pem`, APPLE_KEY);
    fs.writeFileSync(`${passDir}/wwdr.pem`, APPLE_WWDR);

    const authToken = crypto.randomBytes(16).toString('hex');
    const passJson = {
      formatVersion: 1,
      passTypeIdentifier: APPLE_PASS_TYPE_ID,
      serialNumber: member.id,
      teamIdentifier: APPLE_TEAM_ID,
      organizationName: 'UTOPICO',
      description: 'UTOPICO Loyalty Card',
      logoText: 'UTOPICO',
      backgroundColor: 'rgb(136, 136, 136)',
      foregroundColor: 'rgb(255, 255, 255)',
      labelColor: 'rgb(220, 220, 220)',
      storeCard: {
        headerFields: [{ key: 'stamps', label: 'STAMPS', value: `${Math.min(stamps,10)}/10`, textAlignment: 'PKTextAlignmentRight' }],
        primaryFields: [{ key: 'member', label: 'MEMBER', value: `${member.name} ${member.surname}` }],
        secondaryFields: [{ key: 'progress', label: stamps >= 10 ? 'REWARD READY' : 'NEXT REWARD', value: stamps >= 10 ? 'Free coffee!' : `${10 - stamps} more coffees` }],
        auxiliaryFields: [{ key: 'since', label: 'MEMBER SINCE', value: new Date(member.created_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) }],
        backFields: [
          { key: 'howto', label: 'HOW IT WORKS', value: 'Every coffee counts. Collect 10 stamps and your next one is on us.' },
          { key: 'website', label: 'WEBSITE', value: 'utopico.coffee' },
          { key: 'slogan', label: '', value: 'Utopia is a state of mind.' }
        ]
      },
      barcode: {
        message: `https://energetic-motivation-production.up.railway.app/barista?scan=${member.id}`,
        format: 'PKBarcodeFormatQR',
        messageEncoding: 'iso-8859-1',
        altText: 'UTOPICO Loyalty'
      },
      locations: [{ longitude: -3.7038, latitude: 40.4168, relevantText: "You're near UTOPICO! Show your loyalty card." }],
      maxDistance: 500,
      authenticationToken: authToken,
      webServiceURL: 'https://energetic-motivation-production.up.railway.app/apple-wallet'
    };

    fs.writeFileSync(`${passDir}/pass.json`, JSON.stringify(passJson));

    const manifest = {};
    fs.readdirSync(passDir).forEach(file => {
      if (!['cert.pem','key.pem','wwdr.pem'].includes(file)) {
        manifest[file] = crypto.createHash('sha1').update(fs.readFileSync(`${passDir}/${file}`)).digest('hex');
      }
    });
    fs.writeFileSync(`${passDir}/manifest.json`, JSON.stringify(manifest));
    console.log('manifest:', Object.keys(manifest));

    execSync(`openssl smime -sign -signer ${passDir}/cert.pem -inkey ${passDir}/key.pem -certfile ${passDir}/wwdr.pem -in ${passDir}/manifest.json -out ${passDir}/signature -outform DER -binary`);
    console.log('signed');

    // Build pkpass using pure Node.js ZIP
    const skipFiles = new Set(['cert.pem','key.pem','wwdr.pem']);
    const zipFiles = fs.readdirSync(passDir)
      .filter(f => !skipFiles.has(f))
      .map(f => ({ name: f, data: fs.readFileSync(`${passDir}/${f}`) }));

    const pkpassBuf = writeZip(zipFiles);
    const pkpassPath = `/tmp/utopico_${ts}.pkpass`;
    fs.writeFileSync(pkpassPath, pkpassBuf);
    console.log('pkpass written, size:', pkpassBuf.length);

    await db.from('members').update({ apple_pass_token: authToken }).eq('id', member.id);

    res.setHeader('Content-Type', 'application/vnd.apple.pkpass');
    res.setHeader('Content-Disposition', 'attachment; filename="utopico.pkpass"');
    res.sendFile(pkpassPath, () => {
      try { execSync(`rm -rf ${passDir} ${pkpassPath}`); } catch {}
    });
    console.log('done!');

  } catch (err) {
    console.error('ERROR:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/webhook/stamp-updated', (req, res) => res.sendStatus(200));
app.get('/barista', (req, res) => res.redirect(`https://utopicocafe.github.io/utopico-backend/barista.html?scan=${req.query.scan}`));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`UTOPICO backend running on port ${PORT}`));
