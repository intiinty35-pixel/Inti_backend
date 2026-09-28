/**
 * Captura la CA raiz de Supabase desde el handshake TLS del pooler y la guarda
 * en certs/prod-ca-2021.crt.
 *
 * El nodo raiz de la cadena es autocertificado, por lo que el PEM resultante es
 * equivalente al prod-ca-2021.crt que se descarga desde
 * Dashboard -> Database Settings -> SSL Configuration.
 *
 * Uso: node scripts/capture-supabase-ca.js
 * Requiere DATABASE_URL en el entorno / .env
 *
 * La conexion se abre con sslmode=no-verify SOLO aqui, porque el objetivo es
 * leer el certificado crudo antes de tener con que verificarlo.
 */
require('dotenv/config');
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const OUT_PATH = path.join(__dirname, '..', 'certs', 'prod-ca-2021.crt');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('Falta DATABASE_URL en el entorno.');
  process.exit(1);
}

const probeUrl = connectionString
  .replace(/sslmode=[^&]*/, 'sslmode=no-verify')
  .replace(/[?&]sslrootcert=[^&]*/, '');

const client = new Client({ connectionString: probeUrl, connectionTimeoutMillis: 15000 });

function findSelfSignedRoot(cert) {
  const seen = new Set();
  let node = cert;
  while (node && node.raw && !seen.has(node.fingerprint)) {
    seen.add(node.fingerprint);
    const sameCn = node.issuer?.CN === node.subject?.CN;
    const sameOrg = node.issuer?.O === node.subject?.O;
    if (sameCn && sameOrg) return node;
    node = node.issuerCertificate;
  }
  return null;
}

function toPem(cert) {
  const body = cert.raw.toString('base64').replace(/(.{64})/g, '$1\n').trim();
  return `-----BEGIN CERTIFICATE-----\n${body}\n-----END CERTIFICATE-----\n`;
}

client
  .connect()
  .then(() => {
    const root = findSelfSignedRoot(client.connection.stream.getPeerCertificate(true));
    if (!root) throw new Error('No se encontro un nodo raiz autocertificado en la cadena');

    fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
    fs.writeFileSync(OUT_PATH, toPem(root), 'utf8');

    console.log(`CA raiz escrita en ${OUT_PATH}`);
    console.log(`  subject  : ${root.subject.CN} (${root.subject.O})`);
    console.log(`  valido   : ${root.valid_from.trim()} -> ${root.valid_to.trim()}`);
    return client.end();
  })
  .catch((err) => {
    console.error('Error capturando la CA:', err.message);
    process.exit(1);
  });
