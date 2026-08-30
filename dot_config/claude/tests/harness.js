/**
 * A test harness for the workflow scripts this repository deploys to `~/.config/claude/workflows/`.
 *
 * Those scripts cannot be `import`ed. They are not modules and not plain scripts, but *workflow bodies*: they carry
 * `export const meta` and top-level `await` (module-only) alongside top-level `return` (function-only), and they read
 * `args` / `agent` / `parallel` / `phase` / `log` as free variables the `Workflow` tool injects. So this harness does
 * what that tool does — reads the committed source and compiles it with `new Function`, supplying those globals itself.
 *
 * The point of loading the real file rather than a refactored copy is that the tests cannot drift from what production
 * runs: there is no build step, no export surface, and no second source of truth to keep in sync.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';

export const WORKFLOWS_DIR = join(import.meta.dirname, '..', 'exact_workflows');

/**
 * Every workflow script in the source directory, as `{ name, path }` sorted by name. Suite-wide contract tests iterate
 * this, so a workflow added later is covered without anyone remembering to list it.
 */
export function workflowScripts() {
  let entries;

  try {
    entries = readdirSync(WORKFLOWS_DIR);
  } catch (cause) {
    throw new Error(
      `Could not read the workflow source directory ${WORKFLOWS_DIR}. If it moved, update WORKFLOWS_DIR in this ` +
        "harness — it is derived from the harness's own location, not configured anywhere else.",
      { cause },
    );
  }

  const scripts = entries
    .filter((entry) => entry.endsWith('.js'))
    .sort()
    .map((entry) => ({ name: basename(entry, '.js'), path: join(WORKFLOWS_DIR, entry) }));

  if (scripts.length === 0) {
    throw new Error(`${WORKFLOWS_DIR} contains no workflow scripts, so these tests would silently cover nothing.`);
  }

  return scripts;
}

export const COMMANDS_DIR = join(import.meta.dirname, '..', 'exact_commands');

/**
 * Every slash-command file, as `{ name, path }` sorted by name — `name` being what the user types after the slash.
 *
 * A command file is prose, so nothing about it can be compiled or unit-tested the way a script can. What *can* be
 * checked is that it agrees with the script it drives and with itself, which is where its silent failures live: a flag
 * documented under one spelling and passed under another, or a `meta.name` the wrapper mistypes, produces a command that
 * runs and quietly ignores what it was asked for.
 */
export function commandFiles() {
  let entries;

  try {
    entries = readdirSync(COMMANDS_DIR);
  } catch (cause) {
    throw new Error(
      `Could not read the command source directory ${COMMANDS_DIR}. If it moved, update COMMANDS_DIR in this ` +
        "harness — it is derived from the harness's own location, not configured anywhere else.",
      { cause },
    );
  }

  const commands = entries
    .filter((entry) => entry.endsWith('.md'))
    .sort()
    .map((entry) => ({ name: basename(entry, '.md'), path: join(COMMANDS_DIR, entry) }));

  if (commands.length === 0) {
    throw new Error(`${COMMANDS_DIR} contains no command files, so these tests would silently cover nothing.`);
  }

  return commands;
}

/**
 * A command file split into its YAML frontmatter block and its prose body. The frontmatter is returned as raw text
 * rather than parsed: there is no YAML parser in this repository's dependencies, and the two things worth asserting
 * about it (the keys present, and the flags listed in `argument-hint`) are more honestly read off the source than off a
 * hand-rolled parse of it.
 */
export function readCommand(commandPath) {
  const source = readFileSync(commandPath, 'utf8');
  const [, frontmatter, body] = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(source) || [];

  if (!frontmatter) {
    throw new Error(`${commandPath} has no \`---\`-delimited YAML frontmatter, which every command file requires.`);
  }

  return { source, frontmatter, body };
}

/**
 * Resolve one workflow by the name it is invoked under, i.e. the basename the `Workflow` tool's `scriptPath` ends in.
 */
export function workflowScript(name) {
  const found = workflowScripts().find((script) => script.name === name);

  if (!found) {
    throw new Error(`No workflow script named '${name}' in ${WORKFLOWS_DIR}.`);
  }

  return found.path;
}

// The globals the `Workflow` runtime injects into a script body, in the order `compile` binds them. `loadInternals` and
// `runWorkflow` supply them positionally, so this order is load-bearing — sorting it silently binds every one wrongly.
const WORKFLOW_GLOBALS = ['args', 'agent', 'parallel', 'pipeline', 'phase', 'log', 'budget', 'workflow'];

// `new Function` bodies cannot contain `export`, and a script's only export is its `meta` literal.
export const stripExport = (source) => source.replace(/^export const meta = /m, 'const meta = ');

export const readScript = (scriptPath) => readFileSync(scriptPath, 'utf8');

/**
 * Compile a script body the way the `Workflow` tool does: as the body of an async function whose parameters are the
 * injected globals. This is also what makes a top-level `return` legal, which the scripts rely on to bail out early.
 */
export function compile(body) {
  return new Function(...WORKFLOW_GLOBALS, `return (async () => {\n${body}\n})();`);
}

// --- Reading a script's meta block ----------------------------------------------------------------------------------
// The `Workflow` tool reads `meta` before executing the body, so it must be a self-contained literal. Extracting it by
// source text rather than by running the script keeps that check honest — and works for a script whose body would need
// a working `agent` to get anywhere.
const META_LITERAL = /^export const meta = (\{[\s\S]*?^\});$/m;

export function loadMeta(scriptPath) {
  const [, literal] = META_LITERAL.exec(readScript(scriptPath)) || [];

  if (!literal) {
    throw new Error(
      `${scriptPath} has no \`export const meta = { … };\` block, or it is not formatted so that the closing brace ` +
        'starts a line. The `Workflow` tool requires one.',
    );
  }

  // Evaluated with nothing in scope: a reference to any script-local value fails here rather than at launch.
  return {
    literal,
    value: new Function(`return ${literal};`)(),
  };
}

// --- Loading a script's declarations in isolation --------------------------------------------------------------------
// Everything above this marker is expected to be pure declaration — config knobs, schemas, prompt builders, helpers —
// with no `await` and no `agent` call. Slicing there and appending a `return` of the wanted names gives direct access to
// internals that are otherwise unreachable, since the scripts export nothing and return only results.
export const ORCHESTRATION_MARKER = '// --- Orchestration ---';

/**
 * Evaluate only a script's declaration section and return the named internals.
 *
 * `names` is the caller's, because which internals matter is a fact about the script under test, not about the harness.
 * Naming them explicitly rather than discovering them means renaming one fails these tests loudly instead of quietly
 * dropping whatever it used to cover. `args` is honoured, since the config knobs are themselves declarations derived
 * from it.
 */
export async function loadInternals(scriptPath, { names, args = {}, marker = ORCHESTRATION_MARKER } = {}) {
  if (!names?.length) {
    throw new Error('loadInternals needs the names of the internals to return.');
  }

  const source = readScript(scriptPath);
  const cut = source.indexOf(marker);

  if (cut === -1) {
    throw new Error(
      `${scriptPath} no longer contains the "${marker}" marker that separates its declarations from its ` +
        'orchestration. Restore the marker or pass the new one — without it these tests would cover nothing.',
    );
  }

  // The appended `return` is branded, because it is not the only `return` the slice can reach: a declaration section may
  // hold a top-level abort — `repo-review.js` bails out there when `args` is a string that is not JSON — and one of
  // those short-circuits before this one runs. Unbranded, its payload comes back looking like the internals, with every
  // requested name `undefined` and no ReferenceError for the diagnostic below to catch.
  const brand = '__loadInternals__';
  const body = `${stripExport(source.slice(0, cut))}\nreturn { '${brand}': true, ${names.join(', ')} };`;
  let loaded;

  try {
    const workflow = compile(body);

    loaded = await workflow(
      args,
      unusable('agent'),
      unusable('parallel'),
      unusable('pipeline'),
      unusable('phase'),
      unusable('log'),
      stubBudget(),
      unusable('workflow'),
    );
  } catch (error) {
    // Only a name the caller asked for can be diagnosed as a stale `names` list. Every other `ReferenceError` comes
    // from the script's own declarations — a typo, or a free variable the runtime injects that `WORKFLOW_GLOBALS` does
    // not list — and blaming `names` for those would send the reader to the wrong file entirely.
    const undeclared = error instanceof ReferenceError && /^(\S+) is not defined$/.exec(error.message)?.[1];

    if (undeclared && names.includes(undeclared)) {
      throw new Error(
        `An internal the caller asked for is missing from ${scriptPath}: ${error.message}. It was probably renamed — ` +
          'update the `names` list to match.',
        { cause: error },
      );
    }

    throw error;
  }

  const { [brand]: branded, ...internals } = loaded ?? {};

  if (!branded) {
    throw new Error(
      `The declaration section of ${scriptPath} returned before the internals could be collected, so what came back ` +
        `is that early \`return\`'s value (${describe(loaded)}) rather than the names asked for. Those early returns ` +
        'are abort paths guarding against unusable input, so the `args` passed here most likely trip one: pass args ' +
        'that get past the guard, or move the guard below the marker.',
    );
  }

  return internals;
}

// Enough of a returned value to recognize which abort produced it, without assuming it is serializable.
const describe = (value) =>
  value && typeof value === 'object' ? `an object with keys ${Object.keys(value).join(', ')}` : `a ${typeof value}`;

// Declarations must not reach for the runtime; if one starts to, say so rather than letting it read as a mystery.
const unusable = (name) => () => {
  throw new Error(`${name}() was called while loading declarations only — it is not available there.`);
};

export const stubBudget = () => ({ total: null, spent: () => 0, remaining: () => Infinity });

// --- Running a whole script -----------------------------------------------------------------------------------------

/**
 * Faithful stand-in for the runtime's `parallel`: concurrent, a barrier, and — importantly for these tests — a thunk
 * that throws resolves to `null` rather than rejecting the whole call. Several failure paths in these scripts exist
 * only because of that behaviour, so getting it wrong here would hide them.
 */
const parallelImpl = (thunks) =>
  Promise.all(thunks.map((thunk) => Promise.resolve().then(thunk).catch(() => null)));

/**
 * Faithful stand-in for the runtime's `pipeline`: each item runs every stage independently with no barrier, and a stage
 * that throws drops that item to `null`.
 *
 * That last clause is the one a script has to be written against, and it is also the one no fake `agent` can produce —
 * every `agent` call inside a stage sits under a `parallel()` or a `try`, so nothing a scenario answers reaches the
 * `catch` here. `runWorkflow` therefore takes a `pipeline` override, so a test can wrap this and drop an item the way the
 * runtime would (a stalled agent *throws*; see the no-progress watchdog) and assert what the script does about it.
 */
export const pipelineImpl = (items, ...stages) =>
  Promise.all(
    items.map(async (item, index) => {
      let value = item;

      try {
        for (const stage of stages) {
          value = await stage(value, item, index);
        }

        return value;
      } catch {
        return null;
      }
    }),
  );

/**
 * Run an entire workflow script against a fake `agent`.
 *
 * `agent` is called as `agent(call)` with `{ label, prompt, opts }` and returns the structured result the real
 * subagent would have (or `null` to simulate one that never returned, or throws to simulate a dead agent).
 *
 * Returns the script's own return value plus everything observable from outside it: every agent call in order (with
 * prompts, so the instructions sent can be asserted), the `log` lines, and the phases entered — each once, in the
 * order it was first entered, by either of the two routes into a phase.
 */
export async function runWorkflow({ scriptPath, args = {}, agent, pipeline = pipelineImpl } = {}) {
  if (typeof agent !== 'function') {
    throw new Error(
      'runWorkflow needs an `agent` function to answer the agent calls the script makes. Without one every call ' +
        "throws, and `parallel`'s catch-all turns that into a plausible-looking early bail — so the test would pass " +
        'for the wrong reason.',
    );
  }

  const calls = [];
  const logs = [];
  const phases = [];

  // A phase group is created either by a `phase('X')` call or by an agent's `phase: 'X'` option, and the runtime enters
  // it just the same — `/repo-review`'s 'Review Fix' arrives *only* the second way. Recording just the calls would
  // leave a phase the run really entered invisible from out here, which is worse than absent: the negative assertion
  // `expect(run.phases).not.toContain(…)` would pass vacuously for every option-only phase. Titles are matched exactly
  // and one title is one group, so a repeat (a `phase()` in a loop, or every agent in a group naming it) adds nothing.
  const enterPhase = (title) => {
    if (title && !phases.includes(title)) {
      phases.push(title);
    }
  };

  const agentImpl = async (prompt, opts = {}) => {
    const call = { label: opts.label, prompt, opts };
    calls.push(call);
    enterPhase(opts.phase);
    call.result = await agent(call);

    return call.result;
  };

  const workflow = compile(stripExport(readScript(scriptPath)));
  const result = await workflow(
    args,
    agentImpl,
    parallelImpl,
    pipeline,
    enterPhase,
    (message) => logs.push(message),
    stubBudget(),
    () => {
      throw new Error('workflow() is not available to a nested workflow.');
    },
  );

  return {
    result,
    calls,
    logs,
    phases,

    // Convenience accessors, since almost every assertion is "what did the agents with this label get asked / say".
    // Both return the matches rather than a boolean, so a test can assert how many there were and in what order, and a
    // failure names the lines that were there instead of just `false`. A RegExp is tested against each candidate; a
    // string matches a label whole — a label is a closed vocabulary this suite writes out in full — but matches a log
    // line as a substring, since a log line is prose carrying interpolated counts and SHAs no assertion wants to repeat.
    called: (pattern) => calls.filter((call) => matches(pattern, call.label)),
    logged: (pattern) =>
      logs.filter((line) => (pattern instanceof RegExp ? pattern.test(line) : line.includes(pattern))),
  };
}

const matches = (pattern, label = '') =>
  pattern instanceof RegExp ? pattern.test(label) : label === pattern;
