// ═══════════════════════════════════════════════════════════════
// UTÓPICO — Backend (Node.js + Express)
// Genera pases de Apple Wallet (.pkpass) y Google Wallet (JWT)
// Deploy en Railway.app — gratis hasta 500h/mes
// ═══════════════════════════════════════════════════════════════

const express  = require('express');
const cors     = require('cors');
const path     = require('path');
const fs       = require('fs');
const crypto   = require('crypto');
const { execSync } = require('child_process');
const { createClient } = require('@supabase/supabase-js');
const jwt      = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());

// ── CONFIG (usa variables de entorno en Railway) ──
const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY; // service_role key (no la anon)
const APPLE_TEAM_ID        = process.env.APPLE_TEAM_ID;        // ej: AB12CD34EF
const APPLE_PASS_TYPE_ID   = process.env.APPLE_PASS_TYPE_ID;   // ej: pass.com.utopico.loyalty
const APPLE_CERT_PATH      = './certs/apple_cert.pem';         // sube a Railway como secret file
const APPLE_KEY_PATH       = './certs/apple_key.pem';
const APPLE_WWDR_PATH      = './certs/wwdr.pem';               // descargar de Apple
const GOOGLE_SERVICE_ACCOUNT = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT || '{}');
const GOOGLE_ISSUER_ID     = process.env.GOOGLE_ISSUER_ID;     // Google Pay & Wallet Console
const GOOGLE_CLASS_ID      = process.env.GOOGLE_CLASS_ID;      // tu clase de pase creada en Google

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ══════════════════════════════════════════
// APPLE WALLET — Generar .pkpass
// ══════════════════════════════════════════

app.get('/wallet/apple/:memberId', async (req, res) => {
  try {
    const { data: member, error } = await db
      .from('members')
      .select('*')
      .eq('id', req.params.memberId)
      .single();

    if (error || !member) return res.status(404).json({ error: 'Member not found' });

    const stamps  = member.stamps || 0;
    const passDir = `/tmp/pass_${member.id}`;
    fs.mkdirSync(passDir, { recursive: true });

    // ── pass.json ──
    const passJson = {
      formatVersion: 1,
      passTypeIdentifier: APPLE_PASS_TYPE_ID,
      serialNumber: member.id,
      teamIdentifier: APPLE_TEAM_ID,
      organizationName: 'UTÓPICO',
      description: 'Tarjeta de fidelización UTÓPICO',
      logoText: 'UTÓPICO',
      foregroundColor: 'rgb(232, 201, 122)',
      backgroundColor: 'rgb(44, 26, 14)',
      labelColor: 'rgb(200, 150, 60)',

      storeCard: {
        headerFields: [
          {
            key: 'sellos',
            label: 'SELLOS',
            value: `${stamps}/10`,
            textAlignment: 'PKTextAlignmentRight'
          }
        ],
        primaryFields: [
          {
            key: 'member',
            label: 'MIEMBRO',
            value: `${member.name} ${member.surname}`
          }
        ],
        secondaryFields: [
          {
            key: 'reward',
            label: stamps >= 10 ? '¡PREMIO LISTO!' : 'PRÓXIMO PREMIO',
            value: stamps >= 10 ? 'Café gratis 🎉' : `${10 - stamps} cafés más`
          }
        ],
        auxiliaryFields: [
          {
            key: 'member_since',
            label: 'MIEMBRO DESDE',
            value: new Date(member.created_at).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
          }
        ],
        backFields: [
          {
            key: 'info',
            label: 'CÓMO FUNCIONA',
            value: 'Cada café cuenta. Acumula 10 sellos y consigue un café gratis. Sin caducidad, sin letra pequeña.'
          },
          {
            key: 'contact',
            label: 'CONTACTO',
            value: 'hola@utopico.es'
          }
        ]
      },

      barcode: {
        message: `https://TU_DOMINIO/barista?scan=${member.id}`,
        format: 'PKBarcodeFormatQR',
        messageEncoding: 'iso-8859-1',
        altText: member.id
      },

      // Push notifications — needed to update card when stamps change
      webServiceURL: `https://TU_BACKEND_URL/apple-wallet`,
      authenticationToken: crypto.randomBytes(16).toString('hex')
    };

    fs.writeFileSync(`${passDir}/pass.json`, JSON.stringify(passJson, null, 2));

    // ── Copy images (must be in your /passes/images folder) ──
    ['icon.png', 'icon@2x.png', 'logo.png', 'logo@2x.png', 'strip.png', 'strip@2x.png'].forEach(img => {
      const src = path.join(__dirname, 'passes', 'images', img);
      if (fs.existsSync(src)) fs.copyFileSync(src, `${passDir}/${img}`);
    });

    // ── manifest.json ──
    const manifest = {};
    fs.readdirSync(passDir).forEach(file => {
      const content = fs.readFileSync(`${passDir}/${file}`);
      manifest[file] = crypto.createHash('sha1').update(content).digest('hex');
    });
    fs.writeFileSync(`${passDir}/manifest.json`, JSON.stringify(manifest));

    // ── signature (requires openssl + Apple certs) ──
    execSync(
      `openssl smime -sign -signer ${APPLE_CERT_PATH} -inkey ${APPLE_KEY_PATH} ` +
      `-certfile ${APPLE_WWDR_PATH} -in ${passDir}/manifest.json ` +
      `-out ${passDir}/signature -outform DER -binary`
    );

    // ── zip into .pkpass ──
    const pkpassPath = `/tmp/utopico_${member.id}.pkpass`;
    execSync(`cd ${passDir} && zip -r ${pkpassPath} .`);

    // ── Save auth token to DB for push updates ──
    await db.from('members').update({
      apple_pass_token: passJson.authenticationToken
    }).eq('id', member.id);

    res.setHeader('Content-Type', 'application/vnd.apple.pkpass');
    res.setHeader('Content-Disposition', `attachment; filename="utopico.pkpass"`);
    res.sendFile(pkpassPath);

    // cleanup
    setTimeout(() => {
      try { execSync(`rm -rf ${passDir} ${pkpassPath}`); } catch {}
    }, 10000);

  } catch (err) {
    console.error('Apple Wallet error:', err);
    res.status(500).json({ error: 'Error generando el pase de Apple Wallet' });
  }
});

// ══════════════════════════════════════════
// GOOGLE WALLET — Generar JWT link
// ══════════════════════════════════════════

app.get('/wallet/google/:memberId', async (req, res) => {
  try {
    const { data: member, error } = await db
      .from('members')
      .select('*')
      .eq('id', req.params.memberId)
      .single();

    if (error || !member) return res.status(404).json({ error: 'Member not found' });

    const stamps = member.stamps || 0;
    const objectId = `${GOOGLE_ISSUER_ID}.utopico_${member.id}`;

    // Google Wallet loyalty object
    const loyaltyObject = {
      id: objectId,
      classId: `${GOOGLE_ISSUER_ID}.${GOOGLE_CLASS_ID}`,
      state: 'ACTIVE',
      accountId: member.id,
      accountName: `${member.name} ${member.surname}`,
      loyaltyPoints: {
        label: 'Sellos',
        balance: { int: stamps }
      },
      secondaryLoyaltyPoints: {
        label: 'Para tu próximo café gratis',
        balance: { int: 10 - Math.min(stamps, 10) }
      },
      barcode: {
        type: 'QR_CODE',
        value: `https://TU_DOMINIO/barista?scan=${member.id}`,
        alternateText: member.id
      },
      heroImage: {
        sourceUri: { uri: 'https://TU_DOMINIO/assets/hero.png' }
      },
      textModulesData: [
        {
          header: 'CÓMO FUNCIONA',
          body: '10 cafés = 1 café gratis. Sin caducidad, sin complicaciones.'
        }
      ],
      infoModuleData: {
        showLastUpdateTime: true
      }
    };

    // Sign JWT with Google service account
    const payload = {
      iss: GOOGLE_SERVICE_ACCOUNT.client_email,
      aud: 'google',
      origins: ['https://TU_DOMINIO'],
      typ: 'savetowallet',
      payload: {
        loyaltyObjects: [loyaltyObject]
      }
    };

    const token = jwt.sign(payload, GOOGLE_SERVICE_ACCOUNT.private_key, { algorithm: 'RS256' });
    const saveUrl = `https://pay.google.com/gp/v/save/${token}`;

    res.json({ url: saveUrl });

  } catch (err) {
    console.error('Google Wallet error:', err);
    res.status(500).json({ error: 'Error generando el enlace de Google Wallet' });
  }
});

// ══════════════════════════════════════════
// APPLE WALLET — Push update (cuando se añade sello)
// ══════════════════════════════════════════

// Supabase webhook llama a este endpoint cuando cambia stamps
app.post('/webhook/stamp-updated', async (req, res) => {
  const { record } = req.body;
  if (!record) return res.sendStatus(400);

  // Notify Apple Wallet to refresh the pass
  // (requires Apple Push Notification certificate)
  // This is automatically called by Supabase Database Webhooks
  console.log(`Stamp updated for member ${record.id}: ${record.stamps} stamps`);

  // TODO: Send Apple Push Notification here using apn library
  // The pass will update next time the user opens Wallet

  res.sendStatus(200);
});

// ── Google Wallet update ──
app.post('/webhook/google-update', async (req, res) => {
  // Called when stamps change — Google Wallet updates via the Wallet API
  // Requires server-to-server call with service account credentials
  res.sendStatus(200);
});

// ── Health check ──
app.get('/health', (_, res) => res.json({ status: 'ok', service: 'UTÓPICO Loyalty Backend' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`UTÓPICO backend running on port ${PORT}`));
