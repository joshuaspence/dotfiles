/**
 * Tests for the test harness itself.
 *
 * `runWorkflow()` is the main integration test entry point: these verify that the harness accurately mocks the workflow
 * runtime, captures observable behavior (agent calls, logs, phases), and provides the convenience accessors that other
 * tests rely on. The rest cover the harness's own loaders and their error paths, since a harness that fails silently
 * makes every test built on it vacuous.
 */

import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { writeFileSync, mkdirSync, mkdtempSync, rmSync, readFileSync } from 'node:fs';

import {
  compile,
  loadInternals,
  loadMeta,
  ORCHESTRATION_MARKER,
  pipelineImpl,
  runWorkflow,
  stripExport,
  stubBudget,
  workflowScript,
} from './harness.js';

// A minimal workflow script for testing the harness itself
const minimalWorkflow = `
export const meta = {
  title: 'Test Workflow',
  phases: [],
};

const result = await agent('test prompt', { label: 'test-agent' });
log('test log message');
phase('Test Phase');

return { done: true, value: result };
`;

// Create a temporary workflow for testing. This lives under the OS temp dir, not the source tree: a fixture written
// beside the tests would show up as untracked in the chezmoi source directory if it ever outlived the run.
const TEST_WORKFLOWS_DIR = mkdtempSync(join(tmpdir(), 'harness-workflows-'));
const TEST_SCRIPT_PATH = join(TEST_WORKFLOWS_DIR, 'test-workflow.js');

function setupTestWorkflow(source = minimalWorkflow) {
  mkdirSync(TEST_WORKFLOWS_DIR, { recursive: true });
  writeFileSync(TEST_SCRIPT_PATH, source, 'utf8');
  // Registered here rather than called at the end of each test body, so that a failing assertion — which skips the rest
  // of the body — still tears the fixture down.
  onTestFinished(cleanupTestWorkflow);
}

function cleanupTestWorkflow() {
  rmSync(TEST_WORKFLOWS_DIR, { recursive: true, force: true });
}

describe('runWorkflow', () => {
  describe('validation', () => {
    it('throws when agent is not a function', async () => {
      setupTestWorkflow(`
export const meta = { title: 'Test', phases: [] };

return { done: true };
`);

      await expect(runWorkflow({
        scriptPath: TEST_SCRIPT_PATH,
        agent: 'not a function',
      })).rejects.toThrow(
        'runWorkflow needs an `agent` function to answer the agent calls the script makes. Without one every call ' +
          "throws, and `parallel`'s catch-all turns that into a plausible-looking early bail — so the test would pass " +
          'for the wrong reason.',
      );
    });

    it('throws when agent is missing', async () => {
      setupTestWorkflow(`
export const meta = { title: 'Test', phases: [] };

return { done: true };
`);

      await expect(runWorkflow({
        scriptPath: TEST_SCRIPT_PATH,
      })).rejects.toThrow(
        'runWorkflow needs an `agent` function to answer the agent calls the script makes.',
      );
    });
  });

  describe('agent mocking', () => {
    it('captures all agent calls in order with prompts and options', async () => {
      setupTestWorkflow(`
export const meta = { title: 'Test', phases: [] };

await agent('first prompt', { label: 'agent-1' });
await agent('second prompt', { label: 'agent-2', model: 'opus' });

return { done: true };
`);

      const run = await runWorkflow({
        scriptPath: TEST_SCRIPT_PATH,
        agent: () => ({ success: true }),
      });

      expect(run.calls).toHaveLength(2);
      expect(run.calls[0].prompt).toBe('first prompt');
      expect(run.calls[0].label).toBe('agent-1');
      expect(run.calls[1].prompt).toBe('second prompt');
      expect(run.calls[1].label).toBe('agent-2');
      expect(run.calls[1].opts.model).toBe('opus');
    });

    it('attaches each agent result to its call record', async () => {
      setupTestWorkflow(`
export const meta = { title: 'Test', phases: [] };

const r1 = await agent('first', { label: 'a' });
const r2 = await agent('second', { label: 'b' });

return { r1, r2 };
`);

      const run = await runWorkflow({
        scriptPath: TEST_SCRIPT_PATH,
        agent: (call) => ({ echo: call.prompt }),
      });

      expect(run.calls[0].result).toEqual({ echo: 'first' });
      expect(run.calls[1].result).toEqual({ echo: 'second' });
      expect(run.result.r1).toEqual({ echo: 'first' });
      expect(run.result.r2).toEqual({ echo: 'second' });
    });

    it('propagates null from a dead agent without failing the workflow', async () => {
      setupTestWorkflow(`
export const meta = { title: 'Test', phases: [] };

const result = await agent('test', { label: 'dead-agent' });

return { result };
`);

      const run = await runWorkflow({
        scriptPath: TEST_SCRIPT_PATH,
        agent: () => null,
      });

      expect(run.calls[0].result).toBeNull();
      expect(run.result.result).toBeNull();
    });

    it('lets the workflow handle a throwing agent', async () => {
      setupTestWorkflow(`
export const meta = { title: 'Test', phases: [] };

let caught = false;
try {
  await agent('test', { label: 'failing-agent' });
} catch (error) {
  caught = true;
}

return { caught };
`);

      const run = await runWorkflow({
        scriptPath: TEST_SCRIPT_PATH,
        agent: () => {
          throw new Error('Agent failed');
        },
      });

      expect(run.result.caught).toBe(true);
    });
  });

  describe('log capture', () => {
    it('captures all log calls in order', async () => {
      setupTestWorkflow(`
export const meta = { title: 'Test', phases: [] };

log('first message');
log('second message');
log('third message');

return { done: true };
`);

      const run = await runWorkflow({
        scriptPath: TEST_SCRIPT_PATH,
        agent: () => null,
      });

      expect(run.logs).toEqual(['first message', 'second message', 'third message']);
    });
  });

  describe('phase capture', () => {
    it('captures all phase calls in order', async () => {
      setupTestWorkflow(`
export const meta = { title: 'Test', phases: [
  { title: 'First' },
  { title: 'Second' },
] };

phase('First');
phase('Second');

return { done: true };
`);

      const run = await runWorkflow({
        scriptPath: TEST_SCRIPT_PATH,
        agent: () => null,
      });

      expect(run.phases).toEqual(['First', 'Second']);
    });

    it('records a repeated phase once, in the order it was first entered', async () => {
      // One title is one phase group, so re-entering it adds nothing — whether that is a `phase()` in a loop, several
      // agents in a group each naming the phase, or an agent option naming a phase a `phase()` call already opened.
      // Without this, `expect(run.phases).toEqual([…])` in the workflow tests would be order-and-count sensitive to
      // how often a script happens to re-announce a phase rather than to which phases it entered.
      setupTestWorkflow(`
export const meta = { title: 'Test', phases: [
  { title: 'First' },
  { title: 'Second' },
] };

phase('Second');
phase('First');
phase('First');
await agent('a', { label: 'a', phase: 'First' });
await agent('b', { label: 'b', phase: 'Second' });
await agent('c', { label: 'c', phase: 'Second' });

return { done: true };
`);

      const run = await runWorkflow({
        scriptPath: TEST_SCRIPT_PATH,
        agent: () => null,
      });

      expect(run.phases).toEqual(['Second', 'First']);
    });
  });

  describe('result return', () => {
    it('returns the script return value', async () => {
      setupTestWorkflow(`
export const meta = { title: 'Test', phases: [] };

return { findings: [1, 2, 3], summary: 'done' };
`);

      const run = await runWorkflow({
        scriptPath: TEST_SCRIPT_PATH,
        agent: () => null,
      });

      expect(run.result).toEqual({ findings: [1, 2, 3], summary: 'done' });
    });
  });

  describe('called() accessor', () => {
    it('filters calls by exact label match', async () => {
      setupTestWorkflow(`
export const meta = { title: 'Test', phases: [] };

await agent('p1', { label: 'validator' });
await agent('p2', { label: 'reviewer' });
await agent('p3', { label: 'validator' });

return {};
`);

      const run = await runWorkflow({
        scriptPath: TEST_SCRIPT_PATH,
        agent: () => ({}),
      });

      expect(run.called('validator')).toHaveLength(2);
      expect(run.called('reviewer')).toHaveLength(1);
      expect(run.called('unknown')).toHaveLength(0);
    });

    it('filters calls by regex pattern', async () => {
      setupTestWorkflow(`
export const meta = { title: 'Test', phases: [] };

await agent('p1', { label: 'fix:1' });
await agent('p2', { label: 'fix:2' });
await agent('p3', { label: 'review' });

return {};
`);

      const run = await runWorkflow({
        scriptPath: TEST_SCRIPT_PATH,
        agent: () => ({}),
      });

      expect(run.called(/^fix:/)).toHaveLength(2);
      expect(run.called(/review/)).toHaveLength(1);
      expect(run.called(/^survey/)).toHaveLength(0);
    });

    it('handles agents with no label', async () => {
      setupTestWorkflow(`
export const meta = { title: 'Test', phases: [] };

await agent('unlabeled');
await agent('labeled', { label: 'test' });

return {};
`);

      const run = await runWorkflow({
        scriptPath: TEST_SCRIPT_PATH,
        agent: () => ({}),
      });

      expect(run.called('test')).toHaveLength(1);
      expect(run.called('')).toHaveLength(1);
    });
  });

  describe('logged() accessor', () => {
    it('returns every log line containing the substring', async () => {
      setupTestWorkflow(`
export const meta = { title: 'Test', phases: [] };

log('Starting workflow');
log('Processing items');
log('Workflow complete');

return {};
`);

      const run = await runWorkflow({
        scriptPath: TEST_SCRIPT_PATH,
        agent: () => null,
      });

      expect(run.logged('Starting').length).toBe(1);
      expect(run.logged('Processing').length).toBe(1);
      expect(run.logged('complete').length).toBe(1);
    });

    it('returns nothing when no log contains the substring', async () => {
      setupTestWorkflow(`
export const meta = { title: 'Test', phases: [] };

log('first message');
log('second message');

return {};
`);

      const run = await runWorkflow({
        scriptPath: TEST_SCRIPT_PATH,
        agent: () => null,
      });

      expect(run.logged('third')).toHaveLength(0);
      expect(run.logged('unknown')).toHaveLength(0);
    });

    it('performs case-sensitive matching', async () => {
      setupTestWorkflow(`
export const meta = { title: 'Test', phases: [] };

log('Test Message');

return {};
`);

      const run = await runWorkflow({
        scriptPath: TEST_SCRIPT_PATH,
        agent: () => null,
      });

      expect(run.logged('Test').length).toBe(1);
      expect(run.logged('test')).toHaveLength(0);
    });

    it('matches a RegExp against each line, and returns them in the order they were logged', async () => {
      // The reason this returns the lines rather than a boolean: a log line carries interpolated counts, so what a test
      // usually wants to know is *how many* rounds logged one and in what order — which a substring cannot ask.
      setupTestWorkflow(`
export const meta = { title: 'Test', phases: [] };

log('Round 1 produced 3 findings');
log('Round 2 produced 1 findings');
log('Done');

return {};
`);

      const run = await runWorkflow({
        scriptPath: TEST_SCRIPT_PATH,
        agent: () => null,
      });

      expect(run.logged(/^Round \d+ produced/)).toEqual([
        'Round 1 produced 3 findings',
        'Round 2 produced 1 findings',
      ]);
      expect(run.logged(/^Round 3/)).toHaveLength(0);
    });
  });

  describe('args handling', () => {
    it('passes args to the workflow', async () => {
      setupTestWorkflow(`
export const meta = { title: 'Test', phases: [] };

return { receivedArgs: args };
`);

      const run = await runWorkflow({
        scriptPath: TEST_SCRIPT_PATH,
        args: { foo: 'bar', count: 42 },
        agent: () => null,
      });

      expect(run.result.receivedArgs).toEqual({ foo: 'bar', count: 42 });
    });
  });
});

describe('loadInternals', () => {
  it('throws when names is missing', async () => {
    const scriptPath = workflowScript('repo-review');

    await expect(loadInternals(scriptPath, {})).rejects.toThrow(
      'loadInternals needs the names of the internals to return.',
    );
  });

  it('throws when names is empty', async () => {
    const scriptPath = workflowScript('repo-review');

    await expect(loadInternals(scriptPath, { names: [] })).rejects.toThrow(
      'loadInternals needs the names of the internals to return.',
    );
  });

  it('throws when the orchestration marker is not found', async () => {
    const scriptPath = workflowScript('repo-review');

    await expect(loadInternals(scriptPath, { names: ['anything'], marker: 'NONEXISTENT_MARKER' })).rejects.toThrow(
      /no longer contains the "NONEXISTENT_MARKER" marker/,
    );
  });

  it('throws a helpful error when a requested internal does not exist', async () => {
    const scriptPath = workflowScript('repo-review');

    await expect(loadInternals(scriptPath, { names: ['nonExistentInternal'] })).rejects.toThrow(
      /An internal the caller asked for is missing.*nonExistentInternal is not defined/,
    );
  });
});

describe('loadMeta', () => {
  it('throws when script has no meta block', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'harness-test-'));
    const scriptPath = join(tmpDir, 'no-meta.js');

    try {
      writeFileSync(scriptPath, 'const foo = 42;\n');

      expect(() => loadMeta(scriptPath)).toThrow(/has no `export const meta = { … };` block/);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('throws when meta block closing brace is not on its own line', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'harness-test-'));
    const scriptPath = join(tmpDir, 'malformed-meta.js');

    try {
      writeFileSync(scriptPath, 'export const meta = { name: "test" };\n');

      expect(() => loadMeta(scriptPath)).toThrow(/has no `export const meta = { … };` block/);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('WORKFLOW_GLOBALS order', () => {
  // `WORKFLOW_GLOBALS` defines the parameter order `compile` binds, and both `loadInternals` and `runWorkflow` supply
  // their values *positionally*. A mismatch binds every global wrongly and is invisible until a run dies, so the order
  // is pinned here — and the two call sites are checked for arity, since a dropped or added argument shifts every slot
  // after it. Matched structurally rather than by quoting the call sites verbatim: their argument *expressions* are
  // ordinary implementation detail and change often, while their arity and the array's order are the contract.
  const HARNESS_SOURCE = readFileSync(new URL('./harness.js', import.meta.url), 'utf8');

  // Split a call's argument list on the commas at paren/brace/bracket depth 0, so an inline arrow or object literal
  // counts as the single argument it is.
  const argumentsOf = (source, from) => {
    let depth = 0;
    let current = '';
    const args = [];

    for (let i = from; i < source.length; i += 1) {
      const char = source[i];

      if ('([{'.includes(char)) {
        depth += 1;

        if (depth === 1) {
          continue;
        }
      } else if (')]}'.includes(char)) {
        depth -= 1;

        if (depth === 0) {
          break;
        }
      }

      if (char === ',' && depth === 1) {
        args.push(current.trim());
        current = '';
      } else if (depth >= 1) {
        current += char;
      }
    }

    if (current.trim()) {
      args.push(current.trim());
    }

    return args.filter((arg) => arg.length > 0);
  };

  it('is the canonical order the runtime injects', () => {
    const [, literal] = /const WORKFLOW_GLOBALS = \[([\s\S]*?)\];/.exec(HARNESS_SOURCE) || [];

    expect(literal, 'Could not find the WORKFLOW_GLOBALS array in harness.js').toBeTruthy();

    const order = literal
      .split(',')
      .map((item) => item.trim().replace(/^['"]|['"]$/g, ''))
      .filter(Boolean);

    expect(order).toEqual(['args', 'agent', 'parallel', 'pipeline', 'phase', 'log', 'budget', 'workflow']);
  });

  it('is supplied one argument per global at both call sites', () => {
    // `loadInternals` and `runWorkflow` are the only two callers of a compiled workflow.
    const sites = [...HARNESS_SOURCE.matchAll(/await workflow\(/g)];

    expect(sites).toHaveLength(2);

    for (const site of sites) {
      const args = argumentsOf(HARNESS_SOURCE, site.index + 'await workflow'.length);

      expect(args).toHaveLength(8);
      expect(args[0]).toBe('args');
    }
  });

  it('binds parameters positionally in a compiled function', async () => {
    const fn = compile('return { args, agent, parallel, pipeline, phase, log, budget, workflow };');
    const values = ['args-value', 'agent-value', 'parallel-value', 'pipeline-value', 'phase-value', 'log-value',
      'budget-value', 'workflow-value'];

    await expect(fn(...values)).resolves.toEqual({
      args: 'args-value',
      agent: 'agent-value',
      parallel: 'parallel-value',
      pipeline: 'pipeline-value',
      phase: 'phase-value',
      log: 'log-value',
      budget: 'budget-value',
      workflow: 'workflow-value',
    });
  });

  it('binds each global into the slot runWorkflow means it to have', async () => {
    // The arity check above cannot tell a swap of two adjacent slots from a correct call, so drive the real thing: each
    // global is *called* and its result asserted, rather than merely type-checked: all four of `parallel`, `pipeline`,
    // `phase` and `workflow` are functions, so `typeof` alone would accept any permutation of them. `parallel` takes
    // thunks and swallows a thrower into `null`; `pipeline` takes plain values and threads them through its stages;
    // `workflow` refuses to nest. Each call's shape is wrong for the other implementations, so a swapped slot cannot
    // produce these results.
    setupTestWorkflow(`
export const meta = { title: 'Test', phases: [] };

phase('Slot check');
log('logged');
const answered = await agent('asked', { label: 'slot' });

const parallelled = await parallel([() => 'first', () => { throw new Error('thrown'); }]);
const pipelined = await pipeline([1, 2], (value) => value * 2, (value) => value + 1);

let nested = 'workflow() resolved instead of refusing to nest';

try {
  await workflow('nested');
} catch (error) {
  nested = error.message;
}

return {
  answered,
  seenArgs: args,
  parallelled,
  pipelined,
  nested,
  budgetRemaining: budget.remaining(),
};
`);

    const run = await runWorkflow({
      scriptPath: TEST_SCRIPT_PATH,
      args: { sentinel: 'args' },
      agent: () => 'answer',
    });

    expect(run.phases).toEqual(['Slot check']);
    expect(run.logs).toEqual(['logged']);
    expect(run.calls[0].prompt).toBe('asked');
    expect(run.result.answered).toBe('answer');
    expect(run.result.seenArgs).toEqual({ sentinel: 'args' });
    expect(run.result.parallelled).toEqual(['first', null]);
    expect(run.result.pipelined).toEqual([3, 5]);
    expect(run.result.nested).toBe('workflow() is not available to a nested workflow.');
    expect(run.result.budgetRemaining).toBe(Infinity);
  });
});

describe('pipelineImpl', () => {
  it('runs each item through all stages sequentially', async () => {
    const items = [1, 2, 3];
    const double = (x) => x * 2;
    const addTen = (x) => x + 10;

    const result = await pipelineImpl(items, double, addTen);

    expect(result).toEqual([12, 14, 16]);
  });

  it('passes the transformed value to each subsequent stage', async () => {
    const items = ['hello'];
    const toUpper = (s) => s.toUpperCase();
    const exclaim = (s) => `${s}!`;

    const result = await pipelineImpl(items, toUpper, exclaim);

    expect(result).toEqual(['HELLO!']);
  });

  it('provides the original item and index to each stage', async () => {
    const items = [10, 20];
    const calls = [];
    const stage = (value, item, index) => {
      calls.push({ value, item, index });
      return value + 1;
    };

    await pipelineImpl(items, stage, stage);

    // Items process concurrently, so order is not guaranteed. Check each item's stages ran sequentially.
    const item0Calls = calls.filter((c) => c.index === 0);
    const item1Calls = calls.filter((c) => c.index === 1);

    expect(item0Calls).toEqual([
      { value: 10, item: 10, index: 0 },
      { value: 11, item: 10, index: 0 },
    ]);
    expect(item1Calls).toEqual([
      { value: 20, item: 20, index: 1 },
      { value: 21, item: 20, index: 1 },
    ]);
  });

  it('converts an item to null when any stage throws', async () => {
    const items = [1, 2, 3];
    const double = (x) => x * 2;
    const rejectEven = (x) => {
      if (x % 2 === 0) throw new Error('even');
      return x;
    };

    const result = await pipelineImpl(items, double, rejectEven);

    // Item 1: 1 * 2 = 2, then throws -> null
    // Item 2: 2 * 2 = 4, then throws -> null
    // Item 3: 3 * 2 = 6, then throws -> null
    expect(result).toEqual([null, null, null]);
  });

  it('processes items independently with no barrier', async () => {
    const order = [];
    const items = [1, 2, 3];

    const stage1 = async (x) => {
      order.push(`stage1-${x}-start`);
      await Promise.resolve();
      order.push(`stage1-${x}-end`);
      return x;
    };

    const stage2 = async (x) => {
      order.push(`stage2-${x}-start`);
      await Promise.resolve();
      order.push(`stage2-${x}-end`);
      return x;
    };

    await pipelineImpl(items, stage1, stage2);

    // All stage1 starts should happen before any stage1 ends (due to concurrent execution)
    const stage1Starts = order.filter((s) => s.includes('stage1') && s.includes('start'));
    const stage1Ends = order.filter((s) => s.includes('stage1') && s.includes('end'));
    const firstStage1End = order.indexOf(stage1Ends[0]);

    expect(stage1Starts).toHaveLength(3);
    expect(stage1Starts.every((s, i) => order.indexOf(s) < firstStage1End)).toBe(true);
  });

  it('handles async stages', async () => {
    const items = [1, 2];
    const asyncDouble = async (x) => {
      await Promise.resolve();
      return x * 2;
    };

    const result = await pipelineImpl(items, asyncDouble);

    expect(result).toEqual([2, 4]);
  });

  it('returns an empty array when given no items', async () => {
    const result = await pipelineImpl([], (x) => x * 2);

    expect(result).toEqual([]);
  });

  it('returns items unchanged when given no stages', async () => {
    const items = [1, 2, 3];
    const result = await pipelineImpl(items);

    expect(result).toEqual([1, 2, 3]);
  });

  it('only converts the throwing item to null, not others', async () => {
    const items = [1, 2, 3];
    const rejectTwo = (x) => {
      if (x === 2) throw new Error('rejected');
      return x * 10;
    };

    const result = await pipelineImpl(items, rejectTwo);

    expect(result).toEqual([10, null, 30]);
  });
});

describe('unusable() helper', () => {
  it.each([
    {
      name: 'agent',
      code: "const result = agent('test prompt');",
      loadNames: ['result'],
      expectedError: 'agent() was called while loading declarations only — it is not available there.',
    },
    {
      name: 'parallel',
      code: "const result = parallel([() => 'test']);",
      loadNames: ['result'],
      expectedError: 'parallel() was called while loading declarations only — it is not available there.',
    },
    {
      name: 'pipeline',
      code: 'const result = pipeline([], (x) => x);',
      loadNames: ['result'],
      expectedError: 'pipeline() was called while loading declarations only — it is not available there.',
    },
    {
      name: 'phase',
      code: "phase('Test Phase');\nconst dummy = 'value';",
      loadNames: ['dummy'],
      expectedError: 'phase() was called while loading declarations only — it is not available there.',
    },
    {
      name: 'log',
      code: "log('test message');\nconst dummy = 'value';",
      loadNames: ['dummy'],
      expectedError: 'log() was called while loading declarations only — it is not available there.',
    },
    {
      name: 'workflow',
      code: "workflow({ scriptPath: 'test' });\nconst dummy = 'value';",
      loadNames: ['dummy'],
      expectedError: 'workflow() was called while loading declarations only — it is not available there.',
    },
  ])('throws when a declaration calls $name()', async ({ code, loadNames, expectedError }) => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'harness-test-'));
    const scriptPath = join(tmpDir, 'test-workflow.js');

    try {
      writeFileSync(
        scriptPath,
        `export const meta = { name: 'test' };

${code}

${ORCHESTRATION_MARKER}

return {};
`,
      );

      await expect(
        loadInternals(scriptPath, { names: loadNames }),
      ).rejects.toThrow(expectedError);
    } finally {
      rmSync(tmpDir, { recursive: true });
    }
  });

  it('allows declarations that do not call runtime functions', async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'harness-test-'));
    const scriptPath = join(tmpDir, 'test-workflow.js');

    try {
      writeFileSync(
        scriptPath,
        `export const meta = { name: 'test' };

const helper = (x) => x * 2;
const config = { value: 42 };

${ORCHESTRATION_MARKER}

return {};
`,
      );

      await expect(
        loadInternals(scriptPath, { names: ['helper', 'config'] }),
      ).resolves.toEqual({
        helper: expect.any(Function),
        config: { value: 42 },
      });
    } finally {
      rmSync(tmpDir, { recursive: true });
    }
  });
});

describe('stripExport', () => {
  it('strips "export const meta = " from the source', () => {
    const source = 'export const meta = { foo: "bar" };';
    const result = stripExport(source);
    expect(result).toBe('const meta = { foo: "bar" };');
  });

  it('strips "export const meta = " when it appears mid-source', () => {
    const source = `// comment
export const meta = {
  title: 'Test',
};

const foo = 'bar';`;
    const result = stripExport(source);
    expect(result).toBe(`// comment
const meta = {
  title: 'Test',
};

const foo = 'bar';`);
  });

  it('returns source unchanged when "export const meta = " is absent', () => {
    const source = `const meta = { foo: "bar" };
const other = 123;`;
    const result = stripExport(source);
    expect(result).toBe(source);
  });

  it('returns empty source unchanged', () => {
    const source = '';
    const result = stripExport(source);
    expect(result).toBe('');
  });
});

describe('compile()', () => {
  it('returns a function', () => {
    const compiled = compile('');
    expect(typeof compiled).toBe('function');
  });

  it('returns a function that returns a promise', async () => {
    const compiled = compile('');
    const result = compiled();
    expect(result).toBeInstanceOf(Promise);
    await result; // Ensure it resolves
  });

  it('handles empty body', async () => {
    const compiled = compile('');
    const result = await compiled();
    expect(result).toBeUndefined();
  });

  it('executes the body as an async function', async () => {
    const compiled = compile('return 42;');
    const result = await compiled();
    expect(result).toBe(42);
  });

  it('binds parameters in the correct order', async () => {
    // The function should receive parameters in the order defined by WORKFLOW_GLOBALS
    const compiled = compile('return { args, agent, parallel, pipeline, phase, log, budget, workflow };');

    const mockArgs = { test: true };
    const mockAgent = () => {};
    const mockParallel = () => {};
    const mockPipeline = () => {};
    const mockPhase = () => {};
    const mockLog = () => {};
    const mockBudget = { total: 100 };
    const mockWorkflow = () => {};

    const result = await compiled(
      mockArgs,
      mockAgent,
      mockParallel,
      mockPipeline,
      mockPhase,
      mockLog,
      mockBudget,
      mockWorkflow,
    );

    expect(result.args).toBe(mockArgs);
    expect(result.agent).toBe(mockAgent);
    expect(result.parallel).toBe(mockParallel);
    expect(result.pipeline).toBe(mockPipeline);
    expect(result.phase).toBe(mockPhase);
    expect(result.log).toBe(mockLog);
    expect(result.budget).toBe(mockBudget);
    expect(result.workflow).toBe(mockWorkflow);
  });

  it('allows top-level return statements', async () => {
    const compiled = compile('if (true) return "early"; return "late";');
    const result = await compiled();
    expect(result).toBe('early');
  });

  it('allows top-level await', async () => {
    const compiled = compile('const value = await Promise.resolve(123); return value;');
    const result = await compiled();
    expect(result).toBe(123);
  });

  it('propagates exceptions from the body', async () => {
    const compiled = compile('throw new Error("test error");');
    await expect(compiled()).rejects.toThrow('test error');
  });

  it('handles syntax errors at compile time', () => {
    expect(() => compile('this is not valid javascript {')).toThrow();
  });

  it('can access arguments passed positionally', async () => {
    const compiled = compile('return args.value + 10;');
    const result = await compiled({ value: 5 });
    expect(result).toBe(15);
  });
});

describe('stubBudget', () => {
  it('provides total as null', () => {
    const budget = stubBudget();

    expect(budget.total).toBe(null);
  });

  it('provides spent() method returning 0', () => {
    const budget = stubBudget();

    expect(typeof budget.spent).toBe('function');
    expect(budget.spent()).toBe(0);
  });

  it('provides remaining() method returning Infinity', () => {
    const budget = stubBudget();

    expect(typeof budget.remaining).toBe('function');
    expect(budget.remaining()).toBe(Infinity);
  });
});

describe('workflowScript', () => {
  it('throws when workflow name is not found', () => {
    expect(() => workflowScript('nonexistent-workflow')).toThrow(
      /No workflow script named 'nonexistent-workflow'/,
    );
  });
});

describe('workflowScripts', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  // `vi.resetModules()` clears the module registry but not the mock registry, so an un-removed `doMock('node:fs')` would
  // leak into every later dynamic import in this file. Drop the registration and re-reset so the leak cannot happen.
  afterEach(() => {
    vi.doUnmock('node:fs');
    vi.resetModules();
  });

  it('throws a descriptive error when the workflows directory cannot be read', async () => {
    // Mock readdirSync to throw an error simulating a missing or unreadable directory
    vi.doMock('node:fs', () => ({
      readdirSync: vi.fn(() => {
        const err = new Error('ENOENT: no such file or directory');
        err.code = 'ENOENT';
        throw err;
      }),
      readFileSync: vi.fn(),
    }));

    const { workflowScripts, WORKFLOWS_DIR } = await import('./harness.js');

    expect(() => workflowScripts()).toThrow(
      new RegExp(`Could not read the workflow source directory ${WORKFLOWS_DIR.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
    );
  });

  it('throws a descriptive error when the workflows directory is empty', async () => {
    // Mock readdirSync to return an empty array simulating a directory with no .js files
    vi.doMock('node:fs', () => ({
      readdirSync: vi.fn(() => []),
      readFileSync: vi.fn(),
    }));

    const { workflowScripts, WORKFLOWS_DIR } = await import('./harness.js');

    expect(() => workflowScripts()).toThrow(
      new RegExp(`${WORKFLOWS_DIR.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} contains no workflow scripts`),
    );
  });
});
