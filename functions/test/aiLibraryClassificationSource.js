const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const cache = new Map();
module.exports = function loadSource(name) {
  if (cache.has(name)) return cache.get(name);
  const filename = path.join(__dirname, '../src', name + '.ts');
  const mod = new Module(filename, module); mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = mod.require.bind(mod);
  mod.require = request => request.startsWith('./aiLibrary') ? module.exports(request.slice(2)) : original(request);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019, esModuleInterop: true } }).outputText, filename);
  cache.set(name, mod.exports); return mod.exports;
};
