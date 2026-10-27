import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const schemaPath = join(scriptDir, '..', 'src', 'schema.sql');
const outputPath = join(scriptDir, '..', 'src', 'schema.ts');
const schemaSql = readFileSync(schemaPath, 'utf8');
writeFileSync(outputPath, `// Generated from schema.sql by scripts/embed-schema.mjs. Do not edit by hand.\nexport const SCHEMA_SQL = ${JSON.stringify(schemaSql)};\n`);
