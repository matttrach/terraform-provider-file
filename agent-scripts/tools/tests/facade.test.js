import test from 'node:test';
import assert from 'node:assert';

import * as libFile from '../../lib/file.js';
import * as toolFile from '../file.js';

import * as libGit from '../../lib/git.js';
import * as toolGit from '../git.js';

import * as libApproval from '../../lib/approval.js';
import * as toolApproval from '../approval.js';

import * as libPlan from '../../lib/plan.js';
import * as toolPlan from '../plan.js';

import * as libState from '../../lib/state.js';
import * as toolState from '../state.js';

import * as libTest from '../../lib/test.js';
import * as toolTest from '../test.js';

import * as libRemediate from '../../lib/remediate.js';
import * as toolRemediate from '../remediate.js';

import * as libMetaAnalysis from '../../lib/meta-analysis.js';
import * as toolMetaAnalysis from '../meta-analysis.js';

import * as libReview from '../../lib/review.js';
import * as toolReview from '../review.js';

import * as libProjectManager from '../../lib/project-manager.js';
import * as toolProjectManager from '../project-manager.js';

import * as libGemini from '../../lib/gemini.js';
import * as toolGemini from '../gemini.js';

test('facade re-export validation', async (t) => {
  const modules = [
    { name: 'file.js', lib: libFile, tool: toolFile },
    { name: 'git.js', lib: libGit, tool: toolGit },
    { name: 'approval.js', lib: libApproval, tool: toolApproval },
    { name: 'plan.js', lib: libPlan, tool: toolPlan },
    { name: 'state.js', lib: libState, tool: toolState },
    { name: 'test.js', lib: libTest, tool: toolTest },
    { name: 'remediate.js', lib: libRemediate, tool: toolRemediate },
    { name: 'meta-analysis.js', lib: libMetaAnalysis, tool: toolMetaAnalysis },
    { name: 'review.js', lib: libReview, tool: toolReview },
    { name: 'project-manager.js', lib: libProjectManager, tool: toolProjectManager },
    { name: 'gemini.js', lib: libGemini, tool: toolGemini },
  ];

  await Promise.all(
    modules.map(({ name, lib, tool }) =>
      t.test(`should perfectly re-export all functions from lib/${name} into tools/${name}`, () => {
        for (const [key, value] of Object.entries(lib)) {
          if (typeof value === 'function') {
            assert.ok(key in tool, `Missing expected export '${key}' in tools/${name}`);
            assert.strictEqual(typeof tool[key], 'function', `Export '${key}' in tools/${name} is not a function`);
          }
        }
      }),
    ),
  );
});
