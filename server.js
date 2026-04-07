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

// Decode base64 certs
const APPLE_CERT = process.env.APPLE_CERT_B64
  ? Buffer.from(process.env.APPLE_CERT_B64, 'base64').toString('utf8')
  : process.env.APPLE_CERT;
const APPLE_KEY = process.env.APPLE_KEY_B64
  ? Buffer.from(process.env.APPLE_KEY_B64, 'base64').toString('utf8')
  : process.env.APPLE_KEY;
const APPLE_WWDR = process.env.APPLE_WWDR_B64
  ? Buffer.from(process.env.APPLE_WWDR_B64, 'base64').toString('utf8')
  : process.env.APPLE_WWDR;

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

app.get('/health', (_, res) => res.json({ status: 'ok', service: 'UTOPICO Loyalty Backend' }));

app.get('/wallet/apple/:memberId', async (req, res) => {
  try {
    if (!APPLE_CERT || !APPLE_KEY || !APPLE_WWDR) {
      return res.status(500).json({ error: 'Apple certificates not configured' });console.log('CERT length:', APPLE_CERT ? APPLE_CERT.length : 0);
console.log('KEY length:', APPLE_KEY ? APPLE_KEY.length : 0);
console.log('WWDR length:', APPLE_WWDR ? APPLE_WWDR.length : 0);
    }

    const { data: member, error } = await db
      .from('members').select('*').eq('id', req.params.memberId).single();

    if (error || !member) return res.status(404).json({ error: 'Member not found' });

    const stamps = member.stamps || 0;
    const passDir = `/tmp/pass_${member.id}_${Date.now()}`;
    fs.mkdirSync(passDir, { recursive: true });

    const certPath = `${passDir}/cert.pem`;
    const keyPath  = `${passDir}/key.pem`;
    const wwdrPath = `${passDir}/wwdr.pem`;
    fs.writeFileSync(certPath, APPLE_CERT);
    fs.writeFileSync(keyPath, APPLE_KEY);
    fs.writeFileSync(wwdrPath, APPLE_WWDR);

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
          { key: 'howto', label: 'HOW IT WORKS', value: 'Every coffee counts. Collect 10 stamps and your next one is on us. No expiry, no small print.' },
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

    // Copy images if they exist
    const imagesDir = path.join(__dirname, 'images');
    if (fs.existsSync(imagesDir)) {
      fs.readdirSync(imagesDir).forEach(img => {
        fs.copyFileSync(path.join(imagesDir, img), `${passDir}/${img}`);
      });
    }

    // manifest
    const manifest = {};
    fs.readdirSync(passDir).forEach(file => {
      if (!['cert.pem','key.pem','wwdr.pem'].includes(file)) {
        manifest[file] = crypto.createHash('sha1').update(fs.readFileSync(`${passDir}/${file}`)).digest('hex');
      }
    });
    fs.writeFileSync(`${passDir}/manifest.json`, JSON.stringify(manifest));

    // signature
    execSync(
      `openssl smime -sign -signer ${certPath} -inkey ${keyPath} ` +
      `-certfile ${wwdrPath} -in ${passDir}/manifest.json ` +
      `-out ${passDir}/signature -outform DER -binary`
    );

    // zip
    const pkpassPath = `/tmp/utopico_${member.id}.pkpass`;
    execSync(`cd ${passDir} && zip -r ${pkpassPath} . --exclude cert.pem --exclude key.pem --exclude wwdr.pem`);

    await db.from('members').update({ apple_pass_token: authToken }).eq('id', member.id);

    res.setHeader('Content-Type', 'application/vnd.apple.pkpass');
    res.setHeader('Content-Disposition', 'attachment; filename="utopico.pkpass"');
    res.sendFile(pkpassPath);

    setTimeout(() => { try { execSync(`rm -rf ${passDir} ${pkpassPath}`); } catch {} }, 10000);

  } catch (err) {
    console.error('Apple Wallet error:', err.message);
    res.status(500).json({ error: 'Error generating pass', details: err.message });
  }
});

app.post('/webhook/stamp-updated', async (req, res) => {
  const { record } = req.body;
  if (!record) return res.sendStatus(400);
  console.log(`Stamps updated for ${record.id}: ${record.stamps}`);
  res.sendStatus(200);
});

app.get('/barista', (req, res) => {
  const memberId = req.query.scan;
  res.redirect(`https://utopicocafe.github.io/utopico-backend/barista.html?scan=${memberId}`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`UTOPICO backend running on port ${PORT}`));
