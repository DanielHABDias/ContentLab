#!/usr/bin/env node
// Gera o par de chaves Ed25519 das atualizações. A privada fica FORA do repositório
// (padrão ~/.config/contentlab-release/); a pública vai para packaging/release-public-key.pem.
import { generateKeyPairSync } from 'node:crypto';
import { mkdir, writeFile, access } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const privateFile = process.argv[2] || path.join(os.homedir(), '.config', 'contentlab-release', 'update-signing-key.pem');
if (path.resolve(privateFile).startsWith(`${root}${path.sep}`)) { console.error('A chave privada não pode ficar dentro do repositório.'); process.exit(2); }
try { await access(privateFile); console.error(`Já existe ${privateFile}; não foi sobrescrita.`); process.exit(3); } catch { /* ok */ }
const { publicKey, privateKey } = generateKeyPairSync('ed25519');
await mkdir(path.dirname(privateFile), { recursive: true, mode: 0o700 });
await writeFile(privateFile, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600, flag: 'wx' });
await writeFile(path.join(root, 'packaging', 'release-public-key.pem'), publicKey.export({ type: 'spki', format: 'pem' }));
console.log(`Chave privada: ${privateFile} (guarde com backup; quem a tiver pode publicar atualizações)\nChave pública: packaging/release-public-key.pem (versione esta)`);
