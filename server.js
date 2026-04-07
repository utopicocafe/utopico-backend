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

const APPLE_CERT = process.env.APPLE_CERT_B64
  ? Buffer.from(process.env.APPLE_CERT_B64, 'base64').toString('utf8')
  : null;
const APPLE_KEY = process.env.APPLE_KEY_B64
  ? Buffer.from(process.env.APPLE_KEY_B64, 'base64').toString('utf8')
  : null;
const APPLE_WWDR = process.env.APPLE_WWDR_B64
  ? Buffer.from(process.env.APPLE_WWDR_B64, 'base64').toString('utf8')
  : null;

console.log('CERT starts:', APPLE_CERT ? APPLE_CERT.substring(0,27) : 'null');
console.log('CERT length:', APPLE_CERT ? APPLE_CERT.length : 0);

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

app.get('/health', (_, res) => res.json({ status: 'ok', cert: !!APPLE_CERT, key: !!APPLE_KEY, wwdr: !!APPLE_WWDR }));

app.get('/wallet/apple/:memberId', async (req, res) => {
  try {
    console.log('Request for member:', req.params.memberId);

    if (!APPLE_CERT || !APPLE_KEY || !APPLE_WWDR) {
      return res.status(500).json({ error: 'Certificates not configured' });
    }

    const { data: member, error } = await db
      .from('members').select('*').eq('id', req.params.memberId).single();

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

    const pkpassPath = `/tmp/utopico_${ts}.pkpass`;
    execSync(`cd ${passDir} && zip ${pkpassPath} pass.json manifest.json signature $(ls *.png 2>/dev/null || true)`);
    console.log('zipped');

    await db.from('members').update({ apple_pass_token: authToken }).eq('id', member.id);

    res.setHeader('Content-Type', 'application/vnd.apple.pkpass');
    res.setHeader('Content-Disposition', 'attachment; filename="utopico.pkpass"');
    res.sendFile(pkpassPath, () => {
      try { execSync(`rm -rf ${passDir} ${pkpassPath}`); } catch {}
    });
    console.log('done');

  } catch (err) {
    console.error('ERROR:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/webhook/stamp-updated', (req, res) => res.sendStatus(200));
app.get('/barista', (req, res) => res.redirect(`https://utopicocafe.github.io/utopico-backend/barista.html?scan=${req.query.scan}`));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`UTOPICO backend running on port ${PORT}`));
