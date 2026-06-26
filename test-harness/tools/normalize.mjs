// Normalize a raw capture.json into the canonical model.json (oracle whitelist).
// Usage: node normalize.mjs <capture.json> <model.json>
import { normalizeModel } from '../oracle/normalizeModel.js'
import { readFileSync, writeFileSync } from 'fs'
const cap = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const model = normalizeModel({ blocks: cap.blocks, selection: cap.selection })
writeFileSync(process.argv[3], JSON.stringify(model, null, 2) + '\n')
console.log('wrote', process.argv[3])
