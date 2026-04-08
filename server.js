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

const IMAGES = {
  'icon.png':    Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAB0AAAAdCAYAAABWk2cPAAAA4UlEQVR4nO3WPQqDQBQE4DEEA+sR/LmAZ9BWW8vYx1JrPYkBU8baK2jOYC9qo72NgU06o6RRFElgX/WWGfarFpaTRPGFneewN8hQhjKUoetQPwhQ1TWquobreZPM9bwh84NgO3TrYShD90OffT/sJ56fZOPzuLcabdp22CVZnmSyonx6TbMd+sgyUEoBAKZpQtN1EEKg6ToMwwAAUEqRpuks9DinVBQFblGEi+OAEII4jr861zBEWZazUG7Jb9CyLJxtG6qqQhAEdF2HPM8R3+9IkmTuNcvQreZ3nwxD/wp9A+sZRlZ2AldnAAAAAElFTkSuQmCC', 'base64'),
  'icon@2x.png': Buffer.from('iVBORw0KGgoAAAANSUhEUgAAADoAAAA6CAYAAADhu0ooAAABxklEQVR4nO2av07CUBSHfy2EkpB0ASacwYWQMigLC7O+g0p5Dl0g+gSaEHH0z6yL7uCs0bDIE7BA4TLQmzq4mLQYJQclx/ONJz2nvy9nuTe5xkYuF+AfYP51gN9CRLkhotwQUW6IKDdElBsiyg0R5YaIckNEuSGi3BBRbsSpBtm2jZfX11BdKYVCPv9l79tggEQiEapvFgqYTqck+f7NRkWUGyLKDRHlhohyQ0S5IaI/JQjo33xQziQTVUpFBrMs6+sAphl5c9FaYzabUcWjE9VaYzKZhOqxWAzpdHphXzabjayPRqP13CgA9Pv9yLrjOAt7yuXyj2YtC6lor9uNrB/U6zAMI/xz04TrutGzej3KaLSil1dX8H0/VK9Wq2i32yiVSrAsC8lkEo7joHNxga3t7dD38/kcN9fXlNFgUD+ROzw6Wril73J2eopms0mU6ANy0Xg8jvNOB7Vaban+h/t7NBoNaK0pY9EfGHzfx/7eHk6OjzHxvG/3eZ6HVqsF13XJJYEVbPQzqVQKO7u7qFQqKBaLyGQysG0bQRBgPB5jOBzi+ekJvcdH3N3eQim1qiirFV0n5KzLDRHlhohyQ0S5IaLceAfJE4OOvKPlDwAAAABJRU5ErkJggg==', 'base64'),
  'logo.png':    Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAKAAAAAyCAYAAADbYdBlAAAHVElEQVR4nO2dbUxTVxjH/9XaUqnGtrFppEKjAwQZollxBRw6zTqm4Atug+E2TNymjC+YGJWoyJjBTDO3qMyNBZbtiwLTUZgiMypDqGgiMHnxJRpwGhMvtuiwxartPmxrvL2lttDLadj5JXw4z33Oc57n9n/POfcUgkAdEuIAhUKIcaQToPy/oQKkEIUKkEIUKkAKUagAKUShAqQQhQqQQhQqQApRqAApRKECpBCFCpBCFCpAClGoAClEoQKkEIUKkEIUKkAKUagAKUShAqQQhQqQQhQqQApRhHwEPX78OF6OjXW2GxoasCYri+M3b948VBsMLNv7a9bg7NmzMJ4/D7VaPewc3nn7bRiNRo5dLBZj1apVeC05GbGxsZDL5RCLxTCbzejt7cV5oxFVVVW4efOm1/W58ujRIzAMgz/a21FtMOC3+no4HNy//fL2Pj1PUlIS9Ho9XtFqoVKpMGXKFNhsNjAMgyvd3fi9sRG1NTUwmUxu+/ujfn/CiwADlaVLl6Lo888xdepUzjWlUgmlUgmtVotPc3NRWVGB7du3w2q1+jxOcHAwgoODodFokLZ8OYxGIz5atw4PHjwYdu7R0dHYu3evW+ELhUKEhYUhLCwM+jffREFBAebGxeHhw4csv9Gq3xf+N0vwhpwcHPr2W7c335Vx48bh3YwMHD12DFKpdMRj63Q6lH7//bD7v6HXo9pg8DjrPo9IJIJQyJ5bSNbvcSxeo48A3auvYrpazfqZHR3N8SvcuZPjN12tZi2/CxcuxNatW1n9+hgGG/PyMCc2FuEvvYS01FScPn2a5RMTE4Mv9+17Ya4NDQ3OcSMjIvBeZiZu3brFrkenQ2Jioi+3wJnDgQMHEBQU5LQ5HA5UVlRgeVoaombNQmREBJYsXozdxcW4d+8eJwbf9Y+EgBWgvxAIBNixYwcEAoHTNjAwgPT0dFRWVsJkMmFwcBCtra1Ym52N+pMnWf1TUlIwf/58r8ezWCxobGzEls2bOdd0Op3P+RcWFkIikbBsmzZtwsaNG3Hp0iUMDAzAYrHg6tWrOHjwIBITEvDTjz8695yjXb+vjHkBJiQkIDwigmUr/e47t5tsu92Obdu24dmzZyx79tq1Po/bfeUKxyaXy32KERcXh3iXD7/GYMCRw4eH7DM4OIj8/HyYzWYA5Or3ljEvwMSkJI6turp6SP+7d+/i4sWLLJtOp2PNIN4QNWsWxzbUm+lQLHr9dY6trKzMpxik6veWMS/AiPBwVttqtb7wiKGzs5PVVigUUCgUXo0nkUiQlJSE4t27OdfcHQt5IioqitW22Wxoa2vzKcZo1+8rY/4YRiaTsdpms9ntmdzz3L9/nxtHLkdfX59b/+TkZPx5+7bHmC0tLWhqanpBtmwULku2yWTC06dPfYoxGvWPhDE/Aw5n6XDX50UfmicuXriAj9atG3b/keQQCPV7gpcZcCSp+rtQ132XTCaDQCDwOI67l4X+fzf13mC1WsEwDNrb21FjMKCurm5Ydd13yV2hUEAoFPo0C5Ko3xd4mQFdT88nTJjg1k8kEnFsFovFr7lcu36d1ZZIJJgxY4bHPrNnz2a1TSaT22XpP54/B5yuViMiPByJCQnI2bABJ06cGPZD1d3dzWqLRCLExcX5FGM06h8JvAiQYRhWe9q0aW79QkJCODZ/7zOazp3j2FLT0ob0V6lU0Gq1LFtzczNvS5AnzrgcDANAdna2TzECvX5eBNja2spqazQat0/d4iVLWO3+/n709PT4NZfm5mZcv3aNZfvk44+h0Wg4vgKBAJ8VFWH8+PEs+w/l5X7NyVva2tpwoaWFZVu+YgVWr149ZJ+goCDs2rXL+fIR6PXzIsBfa2s5+5Sy8nLodDpIpVJMDw3F5i1bsGzZMpbPL8eO+f1JczgcKCoqYsWVTpqEn48eRXp6OmQyGcRiMebMmYOy8nKkpKSw+tfV1aHFRQSjSUFBAWdL8+W+fdizZw/mzp2LiRMnQiKRIDIyEjk5OWhqbsYHH37ofJEI9Pp5eQm5c+cODh06hNzcXKdt5syZqKisHLJPH8Ng//79fKSDM2fOoLi4GPn5+U6bUqnEV19/7bFfZ2cn8vLyeMnJWzo6OpCbm4uSkhKIxWIA/8xUGZmZyMjM9CpGINfP2zHMni++QGlpqVe+PT09yMrKcvtFur/4pqQEG9avR5/L/tQddrsdFUeOYOWKFRj46y/ecvKW+pMnkZaaisuXL3vlb7PZOCtQoNbP20G03W7HZ4WFOHL4MDIyMxEfH4/Q0FBIpVLYbDaYTCZ0dHSgvr4ehupqPH78mK9UnNTW1uLUqVNYuXIlFi5ahJdjYiBXKCASidDf34/e3l4YjUb8XFWFGzdu8J6PL3R1deGtlBQsWLAAer0e2vh4qFQqTJ48GU+ePAHDMOju6kLjuXOoMRg4vwsIBGb9AvpvGigkGfPfhFACGypAClGoAClEoQKkEIUKkEIUKkAKUagAKUShAqQQhQqQQhQqQApR/gZ6Ui0+MAlAlgAAAABJRU5ErkJggg==', 'base64'),
  'logo@2x.png': Buffer.from('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', 'base64'),
  'strip.png':   Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAUAAAAB7CAYAAAAFWllwAAABrklEQVR4nO3UQQEAEADAQNSgf01ieOwuwV6bZ+87AILW7wCAXwwQyDJAIMsAgSwDBLIMEMgyQCDLAIEsAwSyDBDIMkAgywCBLAMEsgwQyDJAIMsAgSwDBLIMEMgyQCDLAIEsAwSyDBDIMkAgywCBLAMEsgwQyDJAIMsAgSwDBLIMEMgyQCDLAIEsAwSyDBDIMkAgywCBLAMEsgwQyDJAIMsAgSwDBLIMEMgyQCDLAIEsAwSyDBDIMkAgywCBLAMEsgwQyDJAIMsAgSwDBLIMEMgyQCDLAIEsAwSyDBDIMkAgywCBLAMEsgwQyDJAIMsAgSwDBLIMEMgyQCDLAIEsAwSyDBDIMkAgywCBLAMEsgwQyDJAIMsAgSwDBLIMEMgyQCDLAIEsAwSyDBDIMkAgywCBLAMEsgwQyDJAIMsAgSwDBLIMEMgyQCDLAIEsAwSyDBDIMkAgywCBLAMEsgwQyDJAIMsAgSwDBLIMEMgyQCDLAIEsAwSyDBDIMkAgywCBLAMEsgwQyDJAIMsAgSwDBLIMEMgyQCDLAIEsAwSyDBDIMkAgywCBLAMEsgwQyHqUzAJH4jgnvgAAAABJRU5ErkJggg==', 'base64'),
};

console.log('CERT starts:', APPLE_CERT ? APPLE_CERT.substring(0,27) : 'null');

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

function stampRow(stamps) {
  let row = '';
  for (let i = 0; i < 10; i++) {
    if (i < stamps) row += '☕';
    else if (i === 9) row += '★';
    else row += '○';
  }
  return row;
}

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
    const memberName = (member.name + ' ' + member.surname).toUpperCase();

    const passJson = {
      formatVersion: 1,
      passTypeIdentifier: APPLE_PASS_TYPE_ID,
      serialNumber: member.id,
      teamIdentifier: APPLE_TEAM_ID,
      organizationName: 'UTOPICO',
      description: 'UTOPICO Loyalty Card',
      logoText: '',
      backgroundColor: 'rgb(28, 27, 27)',
      foregroundColor: 'rgb(255, 255, 255)',
      labelColor: 'rgb(160, 160, 160)',
      storeCard: {
        headerFields: [{ key: 'stamps', label: 'STAMPS', value: Math.min(stamps,10) + '/10', textAlignment: 'PKTextAlignmentRight' }],
        primaryFields: [{ key: 'stamps_row', label: stamps >= 10 ? '★ FREE COFFEE' : 'YOUR STAMPS', value: stampRow(stamps) }],
        secondaryFields: [{ key: 'member', label: 'MEMBER', value: memberName }],
        auxiliaryFields: [{ key: 'since', label: 'SINCE', value: new Date(member.created_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) }],
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
    for (const [name, data] of Object.entries(IMAGES)) fs.writeFileSync(passDir + '/' + name, data);

    const skip = new Set(['cert.pem','key.pem','wwdr.pem']);
    const manifest = {};
    fs.readdirSync(passDir).forEach(file => {
      if (!skip.has(file)) manifest[file] = crypto.createHash('sha1').update(fs.readFileSync(passDir + '/' + file)).digest('hex');
    });
    fs.writeFileSync(passDir + '/manifest.json', JSON.stringify(manifest));

    execSync('openssl smime -sign -signer ' + passDir + '/cert.pem -inkey ' + passDir + '/key.pem -certfile ' + passDir + '/wwdr.pem -in ' + passDir + '/manifest.json -out ' + passDir + '/signature -outform DER -binary');

    const zipFiles = fs.readdirSync(passDir).filter(f => !skip.has(f)).map(f => ({ name: f, data: fs.readFileSync(passDir + '/' + f) }));
    const pkpassBuf = writeZip(zipFiles);
    const pkpassPath = '/tmp/utopico_' + ts + '.pkpass';
    fs.writeFileSync(pkpassPath, pkpassBuf);

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
