/**
 * Scenario fixtures for `repo-review.js`.
 *
 * Reaching the Fix phase means satisfying five earlier phases of agents (survey, CLAUDE.md scan, partition, six
 * reviewers, dedupe, validators), none of which a test about cherry-pick disjointness cares about. `fixScenario`
 * supplies a working default for all of them and lets a test override only the part under examination.
 *
 * Everything is keyed off the agent labels, which encode the finding index, revision attempt and vote — so a scenario
 * can answer per-finding without the test having to know the order agents happen to run in.
 */

import { loadInternals, runWorkflow, workflowScript } from '../harness.js';

// Resolved by name from the workflow source directory, so this is the only place the script under test is identified.
export const SCRIPT = workflowScript('repo-review');

// The internals these tests examine. Named explicitly rather than discovered: renaming one should fail here loudly
// instead of quietly dropping whatever it used to cover.
const INTERNALS = [
  'meta',

  // Argument handling and the config knobs derived from it.
  ...[
    'breadth',                                                                                                          
    'capLeaf',                                                                                                          
    'depth',                                                                                                            
    'effort',                                                                                                           
    'EFFORT_ORDER',                                                                                                     
    'fix',                                                                                                              
    'FIX_REVISION_CAP',                                                                                                 
    'input',                                                                                                            
    'leafEffort',                                                                                                       
    'LOOP_DEFAULT_ROUNDS',
    'loopEnabled',                                                                                                      
    'lsFiles',                                                                                                          
    'maxRounds',                                                                                                        
    'nonNegativeIntOr',                                                                                                 
    'normalizeArgs',                                                                                                    
    'path',                                                                                                             
    'positiveIntOr',                                                                                                    
    'reviewers',                                                                                                        
    'scope',
  ],

  // Untrusted-input guards.
  ...[
    'isCommitSha',
    'isSafeBranchName',
  ],

  // Grouping and sizing.
  ...[
    'autoUnitTarget',
    'fileInUnit',
    'groupByFileCollision',
  ],

  // Prompt builders.
  ...[
    'architecturalLensPrompt',                                                                                          
    'bulletList',                                                                                                       
    'claudeMdPrompt',                                                                                                   
    'dedupePrompt',                                                                                                     
    'fixerPrompt',                                                                                                      
    'fixReviewPrompt',                                                                                                  
    'generatedPathsBlock',                                                                                              
    'partitionPrompt',                                                                                                  
    'pinToReviewHead',                                                                                                  
    'reconcilePrompt',                                                                                                  
    'reviewerPrompt',                                                                                                   
    'surveyBlock',
    'surveyPrompt',                                                                                                     
    'validatorPrompt',
  ],

  // Agent rosters and schemas.
  ...[
    'ARCHITECTURAL_LENSES',                                                                                             
    'FIX_RESULT_SCHEMA',                                                                                                
    'ISSUES_SCHEMA',
    'PARTITION_SCHEMA',                                                                                                 
    'RECONCILE_RESULT_SCHEMA',                                                                                          
    'REVIEWERS',                                                                                                        
    'REVIEW_RESULT_SCHEMA',                                                                                             
    'SURVEY_SCHEMA',                                                                                                    
    'VERDICT_SCHEMA',
  ],
];

// The script's declarations, evaluated against `args` — the config knobs are themselves derived from it.
export const internals = (args = {}) => loadInternals(SCRIPT, { names: INTERNALS, args });

// --- Label parsing --------------------------------------------------------------------------------------------------
// The script encodes which finding, revision attempt and vote an agent belongs to in its label, so a fake agent can
// answer per-finding from the label alone. Mirrors `findingTag` / `attemptTag` / `voteTag`.
const PER_FINDING = /^(fix|revise|review-fix|validate):(.+?)#(\d+)(?: attempt (\d+))?(?: vote (\d+)\/(\d+))?$/;

export function parseLabel(label = '') {
  const perFinding = PER_FINDING.exec(label);

  if (perFinding) {
    const [, kind, category, idx, attempt, vote] = perFinding;

    return {
      kind,
      category,
      idx: Number(idx),

      // `attemptTag` renders attempt N as "attempt N+1", and omits it entirely for the original attempt.
      attempt: attempt ? Number(attempt) - 1 : 0,
      vote: vote ? Number(vote) - 1 : 0,
    };
  }

  if (label.startsWith('review:')) {
    const [, unit, key] = label.split(':');

    // The architecture lenses are labelled `review:arch:<lens>` and all report a single category.
    return { kind: 'review', unit, key, category: unit === 'arch' ? 'architecture' : key };
  }

  if (label.startsWith('reconcile:')) {
    return { kind: 'reconcile', merging: label.slice('reconcile:'.length) };
  }

  if (label.startsWith('dedupe')) {
    return { kind: 'dedupe' };
  }

  return { kind: label };
}

// A plausible reviewed HEAD and the remote default branch a sandbox is really created at.
export const HEAD = 'cd976db1f0a94c2f9b7e5d3a8c1e6f40b2d75a93';
export const STALE = 'b5427db9e1c8f7a6d5b4c3e2f1a0987654321abc';

// Deterministic 40-character hex object names. `Math.random` is unavailable to workflow scripts and would make failures
// irreproducible here too, so commit SHAs are derived from a seed.
export const commitSha = (seed) => `deadbeef${String(seed).padStart(32, '0')}`;

export const issue = (over = {}) => ({
  description: 'A validated finding',
  severity: 'high',
  category: 'bug',
  file: 'src/a.ts',
  lines: '10',
  reason: 'bug',
  ...over,
});

// The six per-unit reviewer keys, so a scenario can hand each reviewer the findings that belong to it. A reviewer's
// category is stamped onto whatever it returns, so returning a 'security' issue from the 'bug' reviewer would silently
// relabel it and break every category-dependent expectation.
export const REVIEWER_KEYS = ['bug', 'claude-md', 'code-quality', 'consistency', 'security', 'test-critique'];

const DEFAULT_SURVEY = {
  languages: ['TypeScript'],
  tooling: 'npm test',
  entryPoints: ['src/index.ts'],
  structure: [{ path: 'src', fileCount: 2 }],
};

/**
 * Build a fake agent for a `--fix` run.
 *
 * Overridable behaviours, each receiving the parsed label so it can answer per-finding:
 *
 *   fix(issue, { idx, attempt, call })        → FIX_RESULT_SCHEMA shape, or null for an agent that never returned
 *   reviewFix(issue, { idx, attempt, vote })  → REVIEW_RESULT_SCHEMA shape
 *   reconcile({ indices, fixes, groupIdx })   → RECONCILE_RESULT_SCHEMA shape
 *   validate(issue, { idx, vote })            → VERDICT_SCHEMA shape
 */
export function fixScenario({
  headSha = HEAD,
  issues = [issue()],
  exclusions = [],
  unitPaths,
  survey = {},
  claudeMd = { paths: [] },
  headOnly,
  fix,
  reviewFix,
  reconcile,
  validate,
} = {}) {
  // Every fix result handed out, by finding index — so the reconcile default can compute its group's file union the way
  // the real reconciler would, and so tests can assert against what the fixers actually claimed.
  const handedOut = new Map();
  const unmatched = [];
  let reconcileCount = 0;

  const defaultFix = (subject, { idx, attempt }) => ({
    status: 'applied',
    sha: commitSha(idx * 10 + attempt),
    branch: `rrfix/wf_test/${idx}${attempt ? `-r${attempt}` : ''}`,
    changedFiles: [subject.file],
    reason: 'fixed',
  });

  const defaultReconcile = ({ indices, fixes, groupIdx }) => ({
    status: 'resolved',
    sha: commitSha(900 + groupIdx),
    branch: `rrmerge/wf_test/${groupIdx}`,
    reason: `merged ${indices.length} fixes`,

    // Staying inside the group's union is exactly what the script checks, so the cooperative default does.
    changedFiles: [...new Set(fixes.flatMap((result) => result?.changedFiles || []))],
  });

  const agent = (call) => {
    const label = parseLabel(call.label);

    switch (label.kind) {
      case 'survey':
        return {
          ...DEFAULT_SURVEY,
          inScopeFileCount: (unitPaths ?? filesOf(issues)).length,
          headSha,
          ...survey,
        };

      case 'claude-md-scan':
        return claudeMd;

      // The one-question re-ask the Fix phase falls back to when the survey dropped `headSha`. Defaults to failing, so
      // a test that removes `headSha` sees the refusal path unless it deliberately supplies a recovery.
      case 'review-head':
        return headOnly ?? null;

      case 'partition':
        return {
          units: [
            {
              name: 'core',
              summary: 'the code',
              paths: unitPaths ?? filesOf(issues),
            },
          ],
          exclusions,
        };

      case 'review':
        return { issues: issues.filter((subject) => subject.category === label.category) };

      // Standing in for a real dedupe: collapse the six reviewers' overlapping reports back to the canonical set, which
      // also fixes the finding order the per-finding labels index into.
      case 'dedupe':
        return { issues };

      case 'validate':
        return (validate ?? (() => ({ confirmed: true, rationale: 'confirmed' })))(issues[label.idx], label);

      case 'fix':
      case 'revise': {
        const result = (fix ?? defaultFix)(issues[label.idx], { ...label, call });
        handedOut.set(label.idx, result);

        return result;
      }

      case 'review-fix':
        return (reviewFix ?? (() => ({ approved: true, objection: '' })))(issues[label.idx], label);

      case 'reconcile': {
        // The label names the findings being merged (`reconcile:bug#0+bug#1`), which is enough to recover the group.
        const indices = [...label.merging.matchAll(/#(\d+)/g)].map((match) => Number(match[1]));
        const groupIdx = reconcileCount++;

        return (reconcile ?? defaultReconcile)({
          indices,
          fixes: indices.map((idx) => handedOut.get(idx)),
          groupIdx,
          call,
        });
      }

      default:
        // Returning null keeps the run going, but an unanswered agent almost always means a new phase this scenario has
        // not been taught about — `runFix` turns a non-empty list into a failure once the run is over.
        unmatched.push(call.label);

        return null;
    }
  };

  return { agent, unmatched, handedOut };
}

const filesOf = (issues) => [...new Set(issues.map((subject) => subject.file))];

/**
 * Run a `--fix` review end to end. `depth` and `reviewers` are pinned to 1 so the number of validators and fix
 * reviewers is fixed rather than following the `auto` heuristics, which vary by category.
 */
export async function runFix({ args = {}, ...config } = {}) {
  const scenario = fixScenario(config);
  const run = await runWorkflow({
    scriptPath: SCRIPT,
    args: {
      depth: 1,
      fix: true,
      reviewers: 1,
      ...args,
    },
    agent: scenario.agent,
  });

  if (scenario.unmatched.length) {
    throw new Error(
      `The scenario had no answer for agent label(s): ${[...new Set(scenario.unmatched)].join(', ')}. Teach ` +
        'fixScenario about them — an unanswered agent returns null, which quietly exercises a failure path.',
    );
  }

  return { ...run, scenario };
}

// The per-finding outcome for finding `idx`, which is what most fix assertions are really about.
export const outcomeAt = (run, idx) => run.result.fix.outcomes[idx];
