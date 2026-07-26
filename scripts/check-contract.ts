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
  type DeployableApp,
} from '@/src/lib/api';
import type { AppStatus, Dependencies, Tunables } from '@/src/types';

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

console.log(
  failures === 0
    ? '\nall contract checks passed\n'
    : `\n${failures} contract check(s) FAILED\n`,
);
process.exit(failures === 0 ? 0 : 1);
