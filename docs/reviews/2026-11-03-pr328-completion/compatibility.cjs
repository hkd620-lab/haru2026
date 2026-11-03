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
    projectId: 'demo-haru-pr328',
    clientEmail: 'synthetic@demo-haru-pr328.iam.gserviceaccount.com',
    privateKey: keys.privateKey,
  }) }, 'pr328-offline');
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

test('Admin rejects malformed private keys locally', () => {
  assert.throws(() => admin.credential.cert({
    projectId: 'demo-haru-pr328',
    clientEmail: 'synthetic@demo-haru-pr328.iam.gserviceaccount.com',
    privateKey: 'invalid synthetic key',
  }), /private key|PEM/i);
});

test('Firebase Admin resolves the reviewed node-forge package', () => {
  const { createRequire } = require('node:module');
  const fromAdmin = createRequire(require.resolve('firebase-admin'));
  assert.equal(fromAdmin.resolve('node-forge'), require.resolve('node-forge'));
  assert.equal(JSON.parse(require('node:fs').readFileSync(require('node:path').resolve(require.resolve('firebase-admin'), '../../package.json'), 'utf8')).version, '13.7.0');
});

test('Firebase Admin accepts synthetic PKCS1 and PKCS8 PEM private keys', () => {
  const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  for (const type of ['pkcs1', 'pkcs8']) {
    const pem = privateKey.export({ type, format: 'pem' });
    assert.ok(forge.pki.privateKeyFromPem(pem));
    assert.ok(admin.credential.cert({projectId: 'demo-haru-pr328', clientEmail: 'synthetic@demo-haru-pr328.iam.gserviceaccount.com', privateKey: pem}));
  }
});
