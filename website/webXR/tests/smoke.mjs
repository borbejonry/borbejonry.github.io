import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const html = await readFile(new URL('index.html', root), 'utf8');
const css = await readFile(new URL('styles.css', root), 'utf8');
const js = await readFile(new URL('src/main.js', root), 'utf8');
const readme = await readFile(new URL('README.md', root), 'utf8');

assert.match(html, /id="start-ar"/, 'Start AR control exists');
assert.match(html, /id="place-cube"/, 'Place cube control exists');
assert.match(html, /id="reset-scene"/, 'Reset control exists');
assert.match(html, /type="importmap"/, 'Three.js import map exists');
assert.match(css, /\.modal\.hidden/, 'Unsupported modal has a hidden state');
assert.match(js, /isSessionSupported\('immersive-ar'\)/, 'Runtime checks immersive AR support');
assert.match(js, /requiredFeatures:\s*\['hit-test'\]/, 'AR requires hit testing');
assert.match(js, /requestHitTestSource/, 'Hit-test source is requested');
assert.match(js, /getHitTestResults/, 'Frame hit results are consumed');
assert.match(js, /function classifySurface/, 'Surface orientation classification exists');
assert.match(js, /function resetScene/, 'Scene reset handler exists');
assert.match(js, /failedSession\.end\(\)/, 'Startup failures end a partially-created XR session');
assert.match(readme, /does \*\*not\*\* yet reconstruct an entire room/, 'README clearly states scope limitations');

console.log('WebXR static smoke tests passed.');
