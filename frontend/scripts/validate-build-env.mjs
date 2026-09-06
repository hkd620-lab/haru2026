import { loadEnv } from 'vite';

const REQUIRED_FIREBASE_ENV_KEYS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
];

const mode = process.env.NODE_ENV || 'production';
const loadedEnv = loadEnv(mode, process.cwd(), '');
const env = { ...loadedEnv, ...process.env };

const missingKeys = REQUIRED_FIREBASE_ENV_KEYS.filter((key) => {
  const value = env[key];
  return typeof value !== 'string' || value.trim().length === 0;
});

if (missingKeys.length > 0) {
  console.error('Missing required Firebase build environment variables:');
  for (const key of missingKeys) {
    console.error(`- ${key}`);
  }
  process.exit(1);
}

console.log('Firebase build environment validation passed.');
