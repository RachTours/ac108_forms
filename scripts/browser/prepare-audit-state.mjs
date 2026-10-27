import fs from 'node:fs';
import assert from 'node:assert/strict';
const fixture = JSON.parse(fs.readFileSync('output/group-workflows-local-fixture.json', 'utf8'));
assert.equal(fixture.browserOrigin, 'http://127.0.0.1:5000');
assert.ok(fixture.adminEmail.startsWith('group-workflows-qa-') && fixture.adminEmail.endsWith('@reviewroom.test'));
fs.mkdirSync('output/playwright', { recursive: true });
const actor = fixture.admin;
fs.writeFileSync('output/playwright/audit-state.json', JSON.stringify({ cookies: [{ name: 'reviewroom-admin', value: actor.token, domain: '127.0.0.1', path: '/', expires: -1, httpOnly: true, secure: false, sameSite: 'Lax' }], origins: [] }));
