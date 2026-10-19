const fs = require('node:fs');
const originalRead = fs.readFileSync;
const variant = process.env.HARU_CONTRACT_MUTANT;
const changes = {
  lock: ['if (lawSaveRef.current || lawSaved) return;', 'if (lawSaved) return;'],
  saved: ['if (lawSaveRef.current || lawSaved) return;', 'if (lawSaveRef.current) return;'],
  mounted: ['if (lawSaveMountedRef.current) {', 'if (true) {'],
  setup: ['lawSaveMountedRef.current = true;', '/* setup reset removed */'],
  cleanup: ['return () => { lawSaveMountedRef.current = false; };', 'return () => {};'],
};
fs.readFileSync = function(file, ...args) {
  const result = originalRead.call(this, file, ...args);
  if (String(file).endsWith('/assistants/haruLaw/HaruLawPanel.tsx')) {
    if (typeof result !== 'string') throw new Error('expected text source');
    const [before, after] = changes[variant];
    if (result.split(before).length !== 2) throw new Error('mutant anchor is not unique');
    return result.replace(before, after); // Process memory only; never write app source.
  }
  return result;
};
globalThis.fetch = () => { throw new Error('mutation network access forbidden'); };
