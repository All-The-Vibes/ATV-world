const { test } = require('node:test');
const assert = require('node:assert/strict');
const { summarize } = require('../api/health/index.js');

const run = (name, conclusion = 'success', run_number = 1, status = 'completed') => ({
    name, conclusion, run_number, run_attempt: 1, status, head_branch: 'main',
});
const healthy = () => [run('Deploy'), run('CI Health'), run('CodeQL Advanced')];

test('green only when deploy and strict CI are known and passing', () => {
    assert.equal(summarize(healthy()).state, 'green');
    assert.equal(summarize([]).state, 'unknown');
    assert.equal(summarize([run('Deploy')]).state, 'unknown');
});

test('one failing check is yellow; multiple failures or a failed deploy are red', () => {
    assert.equal(summarize([...healthy(), run('CI Health', 'failure', 2)]).state, 'yellow');
    assert.equal(summarize([...healthy(), run('CI Health', 'failure', 2), run('CodeQL Advanced', 'failure', 2)]).state, 'red');
    assert.equal(summarize([...healthy(), run('Deploy', 'failure', 2)]).state, 'red');
    assert.equal(summarize([...healthy(), run('Deploy', 'timed_out', 2)]).state, 'red');
});

test('pending and cancelled runs never pretend to be healthy', () => {
    assert.equal(summarize([...healthy(), run('Deploy', null, 2, 'in_progress')]).message, 'CHECKS RUNNING');
    assert.equal(summarize([...healthy(), run('CI Health', 'cancelled', 2)]).state, 'yellow');
});

test('latest run and retry win, unrelated workflows and branches are ignored', () => {
    const retry = { ...run('CI Health', 'success', 2), run_attempt: 2 };
    const runs = [...healthy(), retry, run('CI Health', 'failure', 2),
        run('Unrelated', 'failure', 10), { ...run('Deploy', 'failure', 10), head_branch: 'feature' }];
    assert.equal(summarize(runs).state, 'green');
});

test('GitHub errors are explicit 503 responses, never a healthy fallback', async () => {
    const handler = require('../api/health/index.js');
    const original = global.fetch;
    const originalError = console.error;
    const errors = [];
    global.fetch = async () => ({ ok: false, status: 403 });
    console.error = (...args) => errors.push(args);
    try {
        const context = {};
        await handler(context);
        assert.equal(context.res.status, 503);
        assert.equal(JSON.parse(context.res.body).state, 'unknown');
        assert.equal(errors.length, 1);
    } finally {
        global.fetch = original;
        console.error = originalError;
    }
});
