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

// Embedded images (base64)
const IMAGES = {
  'icon.png':    Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAB0AAAAdCAIAAADZ8fBYAAAAJElEQVR4nGPooA1gGDV31NxRc0fNHTV31NxRc0fNHTV3UJkLAFgePKRRH//TAAAAAElFTkSuQmCC', 'base64'),
  'icon@2x.png': Buffer.from('iVBORw0KGgoAAAANSUhEUgAAADoAAAA6CAIAAABu2d1/AAAAVUlEQVR4nO3OwQkAIAwAsY7v2M7QRxDhMkHmfGVeB3bqSnWlulJdqa5UV6or1ZXqSnWlulJdqa5UV6or1ZXqSnWlulJdqa5UV6or1ZXqSnWlulJd6QKO0fKNSOWi6wAAAABJRU5ErkJggg==', 'base64'),
  'logo.png':    Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAKAAAAAyCAIAAABUA0cyAAAAjElEQVR4nO3RAQkAMAzAsMmf7Kk4h5IoKHSWtPkdwFsGxxkcZ3CcwXEGxxkcZ3CcwXEGxxkcZ3CcwXEGxxkcZ3CcwXEGxxkcZ3CcwXEGxxkcZ3CcwXEGxxkcZ3CcwXEGxxkcZ3CcwXEGxxkcZ3CcwXEGxxkcZ3CcwXEGxxkcZ3CcwXEGxxkcZ3CcwXEH19TQ4EI5ueEAAAAASUVORK5CYII=', 'base64'),
  'logo@2x.png': Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAUAAAABkCAIAAAB4uH5pAAABPElEQVR4nO3TMQ0AMAzAsMIv7HLYM0WyEeTJLJA1vwOAdwaGMANDmIEhzMAQZmAIMzCEGRjCDAxhBoYwA0OYgSHMwBBmYAgzMIQZGMIMDGEGhjADQ5iBIczAEGZgCDMwhBkYwgwMYQaGMANDmIEhzMAQZmAIMzCEGRjCDAxhBoYwA0OYgSHMwBBmYAgzMIQZGMIMDGEGhjADQ5iBIczAEGZgCDMwhBkYwgwMYQaGMANDmIEhzMAQZmAIMzCEGRjCDAxhBoYwA0OYgSHMwBBmYAgzMIQZGMIMDGEGhjADQ5iBIczAEGZgCDMwhBkYwgwMYQaGMANDmIEhzMAQZmAIMzCEGRjCDAxhBoYwA0OYgSHMwBBmYAgzMIQZGMIMDGEGhjADQ5iBIczAEGZgCDMwhBkYwgwMYQaGMAND2AHeN0Oq9PquhgAAAABJRU5ErkJggg==', 'base64'),
};

console.log('CERT starts:', APPLE_CERT ? APPLE_CERT.substring(0,27) : 'null');

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

function crc32(buf) {
  if (!crc32.table) {
    crc32.table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      crc32.table[i] = c;
    }
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ crc32.table[(crc ^ buf[i]) & 0xFF];
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function writeZip(files) {
  const parts = [], centralDir = [];
  let offset = 0;
  for (const file of files) {
    const nameBytes = Buffer.from(file.name, 'utf8');
    const data = file.data;
    const crc = crc32(data);
    const lh = Buffer.alloc(30 + nameBytes.length);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0, 6);
    lh.writeUInt16LE(0, 8); lh.writeUInt16LE(0, 10); lh.writeUInt16LE(0, 12);
    lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(data.length, 22);
    lh.writeUInt16LE(nameBytes.length, 26); lh.writeUInt16LE(0, 28); nameBytes.copy(lh, 30);
    const ce = Buffer.alloc(46 + nameBytes.length);
    ce.writeUInt32LE(0x02014b50, 0); ce.writeUInt16LE(20, 4); ce.writeUInt16LE(20, 6);
    ce.writeUInt16LE(0, 8); ce.writeUInt16LE(0, 10); ce.writeUInt16LE(0, 12); ce.writeUInt16LE(0, 14);
    ce.writeUInt32LE(crc, 16); ce.writeUInt32LE(data.length, 20); ce.writeUInt32LE(data.length, 24);
    ce.writeUInt16LE(nameBytes.length, 28); ce.writeUInt16LE(0, 30); ce.writeUInt16LE(0, 32);
    ce.writeUInt16LE(0, 34); ce.writeUInt16LE(0, 36); ce.writeUInt32LE(0, 38); ce.writeUInt32LE(offset, 42);
    nameBytes.copy(ce, 46);
    parts.push(lh, data); centralDir.push(ce); offset += lh.length + data.length;
  }
  const cd = Buffer.concat(centralDir);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(0, 4); eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8); eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(cd.length, 12); eocd.writeUInt32LE(offset, 16); eocd.writeUInt16LE(0, 20);
  return Buffer.concat([...parts, cd, eocd]);
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
    const passDir = '/tmp/pass_' + ts;
    fs.mkdirSync(passDir, { recursive: true });

    fs.writeFileSync(passDir + '/cert.pem', APPLE_CERT);
    fs.writeFileSync(passDir + '/key.pem', APPLE_KEY);
    fs.writeFileSync(passDir + '/wwdr.pem', APPLE_WWDR);

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
        headerFields: [{ key: 'stamps', label: 'STAMPS', value: Math.min(stamps,10) + '/10', textAlignment: 'PKTextAlignmentRight' }],
        primaryFields: [{ key: 'member', label: 'MEMBER', value: member.name + ' ' + member.surname }],
        secondaryFields: [{ key: 'progress', label: stamps >= 10 ? 'REWARD READY' : 'NEXT REWARD', value: stamps >= 10 ? 'Free coffee!' : (10 - stamps) + ' more coffees' }],
        auxiliaryFields: [{ key: 'since', label: 'MEMBER SINCE', value: new Date(member.created_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) }],
        backFields: [
          { key: 'howto', label: 'HOW IT WORKS', value: 'Every coffee counts. Collect 10 stamps and your next one is on us.' },
          { key: 'website', label: 'WEBSITE', value: 'utopico.coffee' },
          { key: 'slogan', label: '', value: 'Utopia is a state of mind.' }
        ]
      },
      barcode: {
        message: 'https://energetic-motivation-production.up.railway.app/barista?scan=' + member.id,
        format: 'PKBarcodeFormatQR',
        messageEncoding: 'iso-8859-1',
        altText: 'UTOPICO Loyalty'
      },
      locations: [{ longitude: -3.7038, latitude: 40.4168, relevantText: "You're near UTOPICO! Show your loyalty card." }],
      maxDistance: 500,
      authenticationToken: authToken,
      webServiceURL: 'https://energetic-motivation-production.up.railway.app/apple-wallet'
    };

    fs.writeFileSync(passDir + '/pass.json', JSON.stringify(passJson));

    // Write embedded images
    for (const [name, data] of Object.entries(IMAGES)) {
      fs.writeFileSync(passDir + '/' + name, data);
    }

    const skip = new Set(['cert.pem','key.pem','wwdr.pem']);
    const manifest = {};
    fs.readdirSync(passDir).forEach(file => {
      if (!skip.has(file)) manifest[file] = crypto.createHash('sha1').update(fs.readFileSync(passDir + '/' + file)).digest('hex');
    });
    fs.writeFileSync(passDir + '/manifest.json', JSON.stringify(manifest));
    console.log('manifest:', Object.keys(manifest));

    execSync('openssl smime -sign -signer ' + passDir + '/cert.pem -inkey ' + passDir + '/key.pem -certfile ' + passDir + '/wwdr.pem -in ' + passDir + '/manifest.json -out ' + passDir + '/signature -outform DER -binary');
    console.log('signed');

    const zipFiles = fs.readdirSync(passDir)
      .filter(f => !skip.has(f))
      .map(f => ({ name: f, data: fs.readFileSync(passDir + '/' + f) }));

    const pkpassBuf = writeZip(zipFiles);
    const pkpassPath = '/tmp/utopico_' + ts + '.pkpass';
    fs.writeFileSync(pkpassPath, pkpassBuf);
    console.log('pkpass size:', pkpassBuf.length);

    await db.from('members').update({ apple_pass_token: authToken }).eq('id', member.id);

    res.setHeader('Content-Type', 'application/vnd.apple.pkpass');
    res.setHeader('Content-Disposition', 'attachment; filename="utopico.pkpass"');
    res.sendFile(pkpassPath, () => { try { execSync('rm -rf ' + passDir + ' ' + pkpassPath); } catch {} });
    console.log('done!');

  } catch (err) {
    console.error('ERROR:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/webhook/stamp-updated', (req, res) => res.sendStatus(200));
app.get('/barista', (req, res) => res.redirect('https://utopicocafe.github.io/utopico-backend/barista.html?scan=' + req.query.scan));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('UTOPICO backend running on port ' + PORT));
