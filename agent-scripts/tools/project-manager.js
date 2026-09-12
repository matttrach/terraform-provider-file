export { runProjectManager } from '../lib/project-manager.js';
import { runProjectManager } from '../lib/project-manager.js';

export default async function run(...args) {
  return await runProjectManager(...args);
}
