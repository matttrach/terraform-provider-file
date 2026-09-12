export { runAutoRemediate } from '../lib/remediate.js';
import { runAutoRemediate } from '../lib/remediate.js';

export default async function run(...args) {
  return await runAutoRemediate(...args);
}
