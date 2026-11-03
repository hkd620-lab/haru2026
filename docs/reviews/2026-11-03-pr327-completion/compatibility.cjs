const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { test } = require('node:test');
const forge = require('node-forge');
const admin = require('firebase-admin');

test('locked node-forge version loads', () => {
  assert.equal(require('node-forge/package.json').version, '1.4.2');
});

test('PEM decoding accepts string and Buffer inputs identically', () => {
  const pem = forge.pem.encode({ type: 'TEST DATA', body: 'synthetic fixture' });
  assert.deepEqual(forge.pem.decode(Buffer.from(pem)), forge.pem.decode(pem));
});

test('ASN.1 certificate round trip and signature verification', () => {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date('2026-01-01T00:00:00Z');
  cert.validity.notAfter = new Date('2027-01-01T00:00:00Z');
  const attributes = [{ name: 'commonName', value: 'synthetic.invalid' }];
  cert.setSubject(attributes);
  cert.setIssuer(attributes);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  const decoded = forge.pki.certificateFromPem(forge.pki.certificateToPem(cert));
  assert.equal(decoded.verify(decoded), true);
});

test('Firebase Admin local custom-token signing works with a synthetic RSA key', async () => {
  const keys = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  const app = admin.initializeApp({ credential: admin.credential.cert({
    projectId: 'demo-haru-pr327',
    clientEmail: 'synthetic@demo-haru-pr327.iam.gserviceaccount.com',
    privateKey: keys.privateKey,
  }) }, 'pr327-offline');
  try {
    const token = await app.auth().createCustomToken('synthetic-test-user');
    const [header, payload, signature] = token.split('.');
    assert.equal(JSON.parse(Buffer.from(payload, 'base64url')).uid, 'synthetic-test-user');
    assert.equal(crypto.verify('RSA-SHA256', Buffer.from(`${header}.${payload}`),
      keys.publicKey, Buffer.from(signature, 'base64url')), true);
    assert.equal(crypto.verify('RSA-SHA256', Buffer.from(`${header}.${payload}tampered`),
      keys.publicKey, Buffer.from(signature, 'base64url')), false);
  } finally { await app.delete(); }
});

test('Firebase client SDK loads and initializes without network requests', async () => {
  const { initializeApp, deleteApp } = await import('firebase/app');
  const app = initializeApp({ projectId: 'demo-haru-pr327', apiKey: 'synthetic-offline' }, 'client-pr327');
  assert.equal(app.options.projectId, 'demo-haru-pr327');
  const { getFirestore, terminate } = await import('firebase/firestore');
  const db = getFirestore(app);
  assert.equal(db.app.name, 'client-pr327');
  await terminate(db);
  await deleteApp(app);
});

test('Admin rejects malformed private keys locally', () => {
  assert.throws(() => admin.credential.cert({
    projectId: 'demo-haru-pr327',
    clientEmail: 'synthetic@demo-haru-pr327.iam.gserviceaccount.com',
    privateKey: 'invalid synthetic key',
  }), /private key|PEM/i);
});
