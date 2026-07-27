/**
 * check-contract.ts — asserts the shape of the request bodies the create wizard
 * sends. Run with `npm run check:contract` (tsx, no test framework, no DOM).
 *
 * WHY THIS EXISTS. Every defect this slice closed was invisible to a typecheck
 * and to a browser:
 *
 *   D3  the tuning overlay was written at the umbrella ROOT. Helm discards
 *       values addressed to a key the chart does not have — silently, with no
 *       error and no rendered difference. A wrong scope is not a type error.
 *   D4  the chart name and image digest were hardcoded constants, so every app
 *       the wizard created deployed the TEMPLATE's code under the new app's
 *       name. The request was well-typed and well-formed and wrong.
 *   P3  configuration read at IMPORT rather than at use silently pins one image
 *       to one environment: the container renders /config.js at start, so a
 *       module-level constant has already captured the build-time value by the
 *       time it matters. Both spellings typecheck and both build.
 *
 * A typecheck cannot see either, and neither can a running browser without a
 * live cluster to notice the pod is running somebody else's image. So the
 * assertions below are about VALUES, not types: which key the overlay lands
 * under, that the artifacts came from the resolved app, and that no constant
 * from this repository leaks into a request.
 *
 * Exits non-zero on the first failure so CI fails loudly.
 */
import {
  DEFAULT_DEPENDENCIES,
  DEFAULT_TUNABLES,
  buildDeploymentRequest,
  buildOverlay,
  buildResources,
  describeNotDeployable,
  resolveDeployable,
  validateTunables,
  type DeployableApp,
} from '@/src/lib/api';
import { readConfig, runtimeConfig, type RuntimeConfig } from '@/src/lib/config';
import type { AppStatus, Dependencies, Tunables, ValidateResult } from '@/src/types';

let failures = 0;

function check(name: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ok   ${name}`);
    return;
  }
  failures++;
  console.error(`  FAIL ${name}${detail ? `\n       ${detail}` : ''}`);
}

function eq(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  check(name, a === e, `expected ${e}\n       actual   ${a}`);
}

// A published app as GET /api/v1/apps/{name} reports one. The values are
// deliberately un-round: a test whose expected output could be produced by a
// hardcoded constant proves nothing about where the value came from.
const publishedStatus: AppStatus = {
  name: 'orders-v3-fcdc',
  ready: true,
  repoUrl: 'https://github.com/lurodrisilva/orders-v3-fcdc',
  defaultBranch: 'main',
  chartPublished: true,
  chartStatus: 'published',
  chart: {
    repository: 'ghcr.io/lurodrisilva/helm-charts',
    name: 'orders-v3-umbrella',
    version: '0.4.0-sha-9f1c2ab',
    appValuesKey: 'app',
  },
  image: {
    repository: 'ghcr.io/lurodrisilva/orders-v3-fcdc',
    tag: '9f1c2ab',
    digest: 'sha256:1111111111111111111111111111111111111111111111111111111111111111',
    sourceCommit: '9f1c2ab',
  },
};

console.log('\nbuildOverlay — the overlay must be subchart-scoped (D3)');
{
  const overlay = buildOverlay(DEFAULT_TUNABLES, 'app');
  eq('scoped under the reported values key', Object.keys(overlay), ['app']);
  check(
    'nothing at the umbrella root',
    !('resources' in overlay) && !('replicaCount' in overlay) && !('autoscaling' in overlay),
    'a root-scoped key is the D3 defect: Helm discards it without an error',
  );

  // The key is whatever the platform reported. An app still on umbrella 0.3.0
  // keys its subchart after itself, so a hardcoded 'app' would be wrong for it.
  const legacy = buildOverlay(DEFAULT_TUNABLES, 'orders-v3');
  eq('honours a non-alias key from a pre-0.4.0 chart', Object.keys(legacy), ['orders-v3']);

  const app = overlay.app as Record<string, unknown>;
  eq('sizing is always sent', app.resources, {
    requests: { cpu: DEFAULT_TUNABLES.cpuRequest, memory: DEFAULT_TUNABLES.memoryRequest },
  });
  check(
    'an untuned create sends no autoscaling',
    !('autoscaling' in app),
    'autoscaling is platform-locked in production; sending it unasked would fail a clean create there',
  );
  check('an untouched create sends no securityContext', !('securityContext' in app));

  const tuned: Tunables = { ...DEFAULT_TUNABLES, minReplicas: 3, runAsRoot: true };
  const tunedApp = buildOverlay(tuned, 'app').app as Record<string, unknown>;
  eq('tuning replicas sends autoscaling', tunedApp.autoscaling, { minReplicas: 3, maxReplicas: 10 });
  eq('opting into root sends the locked knob', tunedApp.securityContext, { runAsNonRoot: false });
}

console.log('\nbuildResources — declared dependencies (ADR-0023)');
{
  eq('the default sends nothing', buildResources(DEFAULT_DEPENDENCIES), []);

  const overridden: Dependencies = {
    postgres: { override: true, size: 'medium', version: '15', storageMb: 65536 },
  };
  eq('an override sends exactly one postgres', buildResources(overridden), [
    { type: 'postgres', size: 'medium', version: '15', storageMb: 65536 },
  ]);
  check(
    'no name is sent',
    !('name' in buildResources(overridden)[0]),
    'the orchestrator derives the name from the app id; a caller-supplied one is how an app and its database disagree',
  );
}

console.log('\nresolveDeployable — an app with no artifact must not be deployable (D4)');
{
  check('a published app resolves', resolveDeployable(publishedStatus) !== null);
  check('a null status does not', resolveDeployable(null) === null);

  const cases: [string, AppStatus][] = [
    ['repo not ready', { ...publishedStatus, ready: false, chartStatus: 'awaiting-first-build', chartPublished: false }],
    ['chart not published', { ...publishedStatus, chartStatus: 'awaiting-first-build', chartPublished: false }],
    ['registry unreachable', { ...publishedStatus, chartStatus: 'unavailable', chartPublished: false }],
    ['no values key', { ...publishedStatus, chart: { ...publishedStatus.chart!, appValuesKey: '' } }],
    ['no chart version', { ...publishedStatus, chart: { ...publishedStatus.chart!, version: '' } }],
    ['a tag instead of a digest', { ...publishedStatus, image: { ...publishedStatus.image!, digest: 'latest' } }],
    ['no source commit', { ...publishedStatus, image: { ...publishedStatus.image!, sourceCommit: '' } }],
    ['a truncated source commit', { ...publishedStatus, image: { ...publishedStatus.image!, sourceCommit: '9f1c2' } }],
  ];
  for (const [label, status] of cases) {
    check(`${label} → not deployable`, resolveDeployable(status) === null);
  }
}

console.log('\ndescribeNotDeployable — waiting must be distinguishable from broken');
{
  check('a deployable app has no blocker', describeNotDeployable(publishedStatus) === null);
  check(
    'awaiting-first-build is worth waiting for',
    describeNotDeployable({ ...publishedStatus, chartStatus: 'awaiting-first-build', chartPublished: false })
      ?.waiting === true,
  );
  check(
    'unavailable is NOT worth waiting for',
    describeNotDeployable({ ...publishedStatus, chartStatus: 'unavailable', chartPublished: false })?.waiting === false,
    'polling through a registry outage shows "waiting for the first build" for a build that already finished',
  );
  check('a mock path with no scaffold is not worth waiting for', describeNotDeployable(null)?.waiting === false);
}

console.log('\nbuildDeploymentRequest — every artifact must come from the resolved app (D4)');
{
  const deployable = resolveDeployable(publishedStatus) as DeployableApp;
  const body = buildDeploymentRequest(
    'orders-v3',
    'payments',
    { ...DEFAULT_TUNABLES, environment: 'development' },
    deployable,
    buildResources({ postgres: { override: true, size: 'medium', version: '15', storageMb: 65536 } }),
  );

  eq('chart.name is the app’s own umbrella', body.chart.name, 'orders-v3-umbrella');
  eq('chart.versionConstraint is the exact resolved version', body.chart.versionConstraint, '0.4.0-sha-9f1c2ab');
  check(
    'the version constraint is not a wildcard',
    body.chart.versionConstraint !== '*',
    'a wildcard re-resolves at execution time, so the recorded request is not reproducible',
  );
  eq('image.repository is the app’s own', body.image.repository, 'ghcr.io/lurodrisilva/orders-v3-fcdc');
  eq('image.digest is the resolved digest', body.image.digest, publishedStatus.image!.digest);
  eq('source.gitSha is the commit the image was built from', body.source.gitSha, '9f1c2ab');
  eq('source.gitRef names the app’s default branch', body.source.gitRef, 'refs/heads/main');
  eq('the overlay is scoped to the reported key', Object.keys(body.values), ['app']);
  eq('namespace derives from app + environment', body.target.namespace, 'orders-v3-development');
  eq('resources are carried through', body.resources, [
    { type: 'postgres', size: 'medium', version: '15', storageMb: 65536 },
  ]);

  // D4's signature: a request that names this repository's template instead of
  // the app. Asserted on the serialised body so a constant reintroduced anywhere
  // inside it is caught, not only in the fields checked above.
  const serialised = JSON.stringify(body);
  for (const leak of ['hex-scaffold', 'net-hexagonal', 'payment-gateway-v2']) {
    check(`no "${leak}" anywhere in the body`, !serialised.includes(leak), `found in: ${serialised}`);
  }

  // Reserved paths: the platform refuses these at create in every mode, so the
  // wizard must never build a body containing one.
  check('the body sets no sqldatabase values', !('sqldatabase' in body.values));
  const appValues = body.values.app as Record<string, unknown>;
  check(
    'the body sets no postgres.bindBuildingBlock',
    !('postgres' in appValues),
    'which database an app reads its credentials from is not a caller knob (ADR-0023)',
  );

  const clean = buildDeploymentRequest('orders-v3', 'payments', DEFAULT_TUNABLES, deployable, []);
  check(
    'declaring nothing omits resources entirely',
    !('resources' in clean),
    'so a create that asks for no override is byte-identical to a pre-S6 body',
  );
}

console.log('\nruntime configuration — the image must not be pinned to one environment (P3)');
{
  // The assertion that matters is at the FETCH BOUNDARY, not on the resolver.
  // readConfig() can be perfectly correct while api.ts still captures its result
  // into a module constant at import — and a constant is exactly the defect,
  // because the deployed value only arrives when the container renders
  // /config.js at start. So: change the runtime config and observe the URL the
  // request is actually made to, twice, in one process.
  let lastUrl = '';
  const realFetch = globalThis.fetch;
  globalThis.fetch = ((input: unknown) => {
    lastUrl = String(input);
    const body: ValidateResult = {
      environment: 'development',
      mode: 'audit',
      violations: [],
      blocked: false,
    };
    return Promise.resolve(
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
  }) as typeof globalThis.fetch;

  const setRuntime = (rt: RuntimeConfig | undefined) => {
    (globalThis as { __PORTAL_CONFIG__?: RuntimeConfig }).__PORTAL_CONFIG__ = rt;
  };

  try {
    setRuntime({ VITE_ORCHESTRATOR_URL: 'https://orchestrator.example' });
    await validateTunables(DEFAULT_TUNABLES, 'app', 'token');
    eq(
      'the request goes to the runtime-configured origin',
      lastUrl,
      'https://orchestrator.example/api/v1/deployments:validate',
    );

    // The same process, a different value. This fails if the base was read once
    // at import — which is the regression, stated as a test.
    setRuntime({ VITE_ORCHESTRATOR_URL: '' });
    await validateTunables(DEFAULT_TUNABLES, 'app', 'token');
    eq(
      'an EMPTY runtime origin means same-origin, not the baked default',
      lastUrl,
      '/api/v1/deployments:validate',
    );
  } finally {
    globalThis.fetch = realFetch;
    setRuntime(undefined);
  }

  // Precedence is by key PRESENCE. `runtime || baked` is the idiom that reads
  // naturally and is wrong here: the deployed ConfigMap ships an EMPTY
  // orchestrator URL on purpose (same-origin, ADR-0024), and an empty client id
  // is the mock-mode switch. Truthiness cannot tell "set to empty" from "not
  // set", so it would re-pin the image to whatever was baked.
  //
  // THE BAKED VALUES BELOW MUST BE NON-EMPTY. Under plain Node import.meta.env
  // is empty, so asserting against the real environment compares "" to "" and
  // passes whichever way the precedence is written — a green test proving
  // nothing. That is not hypothetical: the first version of these assertions
  // survived a deliberate rewrite of the resolver to `rt[key] || env[key]`.
  const baked = {
    VITE_ORCHESTRATOR_URL: 'https://baked-at-build-time.example',
    VITE_ENTRA_CLIENT_ID: 'baked-client-id',
    VITE_ENTRA_AUTHORITY: 'https://login.microsoftonline.com/baked-tenant',
  };
  eq('an absent key falls through to the baked value',
    readConfig({}, baked).orchestratorUrl, 'https://baked-at-build-time.example');
  eq('an absent key with nothing baked uses the default',
    readConfig({}, {}).entraAuthority, 'https://login.microsoftonline.com/common');
  eq('a present-but-empty orchestrator URL beats the baked one (same-origin)',
    readConfig({ VITE_ORCHESTRATOR_URL: '' }, baked).orchestratorUrl, '');
  eq('a present-but-empty client id beats the baked one (mock mode)',
    readConfig({ VITE_ENTRA_CLIENT_ID: '' }, baked).entraClientId, '');
  eq('a present value wins over the baked value',
    readConfig({ VITE_ENTRA_AUTHORITY: 'https://login.microsoftonline.com/8f77fb2e' }, baked)
      .entraAuthority,
    'https://login.microsoftonline.com/8f77fb2e');
  // A key present with a null value is still PRESENT. The entrypoint only ever
  // emits strings, so this is reachable by a hand-edited config.js — and it must
  // resolve the same way an empty string does rather than quietly restoring the
  // baked value.
  eq('a present null is empty, not a fall-through',
    readConfig({ VITE_ORCHESTRATOR_URL: null as unknown as string }, baked).orchestratorUrl, '');
  // A malformed or missing /config.js must not take the app down: every key
  // falls through rather than throwing during module evaluation.
  eq('a missing runtime object is survivable',
    readConfig(runtimeConfig(), baked).entraClientId, 'baked-client-id');
}

console.log(
  failures === 0
    ? '\nall contract checks passed\n'
    : `\n${failures} contract check(s) FAILED\n`,
);
process.exit(failures === 0 ? 0 : 1);
