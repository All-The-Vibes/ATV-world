const REPO = 'All-The-Vibes/ATV-world';
const WATCHED = new Set(['Deploy', 'CI Health', 'CodeQL Advanced']);
const FAILED = new Set(['failure', 'timed_out', 'action_required', 'startup_failure', 'stale']);
let cached;
let loading;

function summarize(runs) {
    const latest = new Map();
    for (const run of runs) {
        if (run.head_branch !== 'main' || !WATCHED.has(run.name)) continue;
        const previous = latest.get(run.name);
        if (!previous || run.run_number > previous.run_number ||
            (run.run_number === previous.run_number && run.run_attempt > previous.run_attempt)) {
            latest.set(run.name, run);
        }
    }
    const checks = [...latest.values()].map(run => ({
        name: run.name,
        status: run.status,
        conclusion: run.conclusion,
    }));
    const failures = checks.filter(check => FAILED.has(check.conclusion));
    const broken = failures.some(check => check.name === 'Deploy') || failures.length >= 2;
    const pending = checks.some(check => check.status !== 'completed' ||
        !['success', 'skipped', 'neutral'].includes(check.conclusion));
    const known = checks.some(check => check.name === 'CI Health') &&
        checks.some(check => check.name === 'Deploy');
    return {
        state: broken ? 'red' : failures.length || pending ? 'yellow' : known ? 'green' : 'unknown',
        message: broken ? 'MAIN IS BROKEN' : failures.length ? 'CHECKS FAILING' :
            pending ? 'CHECKS RUNNING' : known ? 'MAIN IS HEALTHY' : 'AWAITING CI',
        checks,
        updated: Date.now(),
    };
}

async function load() {
    const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'ATV-World-Health' };
    if (process.env.GITHUB_HEALTH_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_HEALTH_TOKEN}`;
    const response = await fetch(`https://api.github.com/repos/${REPO}/actions/runs?branch=main&per_page=100`, {
        headers,
        signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`GitHub health request failed (${response.status})`);
    const data = await response.json();
    if (!Array.isArray(data.workflow_runs)) throw new Error('GitHub returned no workflow runs');
    cached = summarize(data.workflow_runs);
    return cached;
}

module.exports = async function (context) {
    const headers = { 'content-type': 'application/json', 'cache-control': 'no-store' };
    try {
        if (!cached || Date.now() - cached.updated >= 60_000) {
            loading ??= load().finally(() => { loading = undefined; });
            await loading;
        }
        context.res = { status: 200, headers, body: JSON.stringify(cached) };
    } catch (error) {
        console.error('[ATV] CI health unavailable:', error);
        context.res = {
            status: 503, headers,
            body: JSON.stringify({ state: 'unknown', message: 'CI UNAVAILABLE', checks: [], updated: Date.now() }),
        };
    }
};

module.exports.summarize = summarize;
