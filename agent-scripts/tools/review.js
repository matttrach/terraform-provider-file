export { runMapPhase, runReducePhase } from '../lib/review.js';
import { runMapPhase, runReducePhase } from '../lib/review.js';

export default async function run(...args) {
  await runMapPhase(...args);
  return await runReducePhase(...args);
}
