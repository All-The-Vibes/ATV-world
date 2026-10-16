/**
 * The CI build (`node scripts/build.ts`). It keeps every push green and the world up:
 * 1. A plot that breaks the build is left out and shows as under construction (so do plots that import it).
 * 2. Any other file that breaks the build falls back to its live version.
 * 3. If it still fails, nothing deploys and the live world stays as it is.
 * Each fallback leaves a warning on the Actions run. `npm run build` stays strict so agents see real errors.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { build } from 'vite';
import { CODE_FILE, filesIn, scanPlots, type PlotSource } from './plots-plugin.ts';

const root = process.cwd();
const ci = process.env.GITHUB_ACTIONS === 'true';
const MAX_ROUNDS = 12;

function git(...args: string[]): string | null {
    try {
        return execFileSync('git', ['-c', 'core.quotePath=false', ...args], { cwd: root, encoding: 'utf8', maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch {
        return null;
    }
}

const lines = (s: string | null) => (s ?? '').split('\n').filter(Boolean);
const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const stripAnsi = (s: string) => s.replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, '');

function warn(title: string, message: string, file?: string) {
    if (!ci) return console.warn(`\n⚠ ${title}${file ? ` (${file})` : ''}\n${message}`);
    const data = (s: string) => s.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');
    const prop = (s: string) => data(s).replaceAll(':', '%3A').replaceAll(',', '%2C');
    console.log(`::warning ${file ? `file=${prop(file)},` : ''}title=${prop(title)}::${data(message)}`);
}

function output(key: string, value: string) {
    if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
}

// The commit that's live now. The deploy workflow reads it from the site's version.json.
// Files only ever get restored from it in CI, never in someone's local checkout.
const live = (() => {
    const sha = process.env.ATV_LIVE_SHA?.trim();
    return ci && sha && git('cat-file', '-e', `${sha}^{commit}`) !== null ? sha : null;
})();

const plots = scanPlots(root);
const slugs = new Set(plots.map((p) => p.slug));
const candidates = [
    ...new Set([
        ...lines(git('ls-files', '--cached', '--others', '--exclude-standard')),
        ...(live ? lines(git('diff', '--name-only', '--no-renames', live)) : []),
    ]),
];

/** One text per error: message, location, and code frame. Stack traces are dropped (they name our own scripts). */
function errorTexts(e: any): string[] {
    const list: any[] = Array.isArray(e?.errors) && e.errors.length ? e.errors : [e];
    return list.map((x) =>
        stripAnsi([x?.message ?? String(x), x?.id, x?.frame].filter(Boolean).join('\n'))
            .split('\n')
            .filter((l) => !/^\s+at\s/.test(l))
            .join('\n')
            .trim(),
    );
}

/** Files named in an error. Paths may be relative, absolute, or file:// URLs. */
function blamed(text: string): string[] {
    const rootPath = escRe(root.replaceAll('\\', '/'));
    const t = text
        .replaceAll('\\', '/')
        .replace(/file:\/\/\/?(?=[A-Za-z]:\/)/g, '')
        .replace(/file:\/\//g, '')
        .replace(new RegExp(`${rootPath}/`, 'gi'), '');
    return candidates.filter((f) => new RegExp(`(?:^|[\\s'"\`(\\[<,=/])${escRe(f)}(?=$|[\\s'"\`)\\]>:,?#])`, 'm').test(t));
}

/** `plots/<slug>/…` or `plots/<slug>.ts` → slug, for real plots only. */
function plotOf(file: string): string | null {
    const m = /^plots\/([^/]+?)(?:\/|\.(?:ts|tsx|js|jsx|mjs)$)/.exec(file);
    return m && slugs.has(m[1]) ? m[1] : null;
}

const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(?\s*)(['"])([^'"\n]+)\1/g;

/** Other plots that a plot imports files from. */
function importsOf(p: PlotSource): Set<string> {
    const found = new Set<string>();
    const files = p.dir ? filesIn(path.join(root, p.dir)).filter((f) => CODE_FILE.test(f)) : [path.join(root, p.file)];
    for (const file of files) {
        for (const [, , spec] of fs.readFileSync(file, 'utf8').matchAll(SPECIFIER)) {
            if (!spec.startsWith('.')) continue;
            const target = path.relative(root, path.resolve(path.dirname(file), spec)).replaceAll('\\', '/');
            const slug = plotOf(`${target}/`) ?? plotOf(target) ?? plotOf(`${target}.ts`);
            if (slug && slug !== p.slug) found.add(slug);
        }
    }
    return found;
}

let imports: Map<string, Set<string>> | undefined;

/** Plots that import `slug`, directly or through other plots. */
function dependents(slug: string): string[] {
    imports ??= new Map(plots.map((p) => [p.slug, importsOf(p)]));
    const out = new Set<string>();
    const queue = [slug];
    while (queue.length) {
        const s = queue.pop()!;
        for (const [other, deps] of imports) {
            if (deps.has(s) && other !== slug && !out.has(other)) {
                out.add(other);
                queue.push(other);
            }
        }
    }
    return [...out];
}

/** Put a file back the way it is live (or remove it if it isn't live yet). False if it already matches. */
function restore(file: string): boolean {
    if (!live || git('diff', '--quiet', live, '--', file) !== null) return false;
    if (git('cat-file', '-e', `${live}:${file}`) !== null) git('checkout', live, '--', file);
    else fs.rmSync(path.join(root, file), { force: true });
    return true;
}

const left: Record<string, string> = {};
const heldBack: Record<string, string> = {};
let heldAll = false;
let built = false;

for (let round = 1; round <= MAX_ROUNDS && !built; round++) {
    process.env.ATV_QUARANTINE = JSON.stringify(left);
    try {
        await build({ logLevel: round === 1 ? 'info' : 'warn' });
        built = true;
    } catch (e) {
        const texts = errorTexts(e);
        console.error(`\nBuild failed (round ${round}):\n\n${texts.join('\n\n')}\n`);
        let progress = false;
        for (const text of texts) {
            const reason = text.split('\n').filter((l) => l.trim()).slice(0, 12).join('\n').slice(0, 1200);
            for (const file of blamed(text)) {
                const slug = plotOf(file);
                if (slug) {
                    for (const s of [slug, ...dependents(slug)]) {
                        if (s in left) continue;
                        left[s] = s === slug ? reason : `Imports plots/${slug}, which doesn't build.`;
                        progress = true;
                    }
                } else if (!(file in heldBack) && restore(file)) {
                    heldBack[file] = reason;
                    progress = true;
                }
            }
        }
        // No single file to blame: hold back every change outside plots/ until the build works again.
        if (!progress && live && !heldAll) {
            heldAll = true;
            for (const file of lines(git('diff', '--name-only', '--no-renames', live, '--', '.', ':(exclude)plots'))) {
                if (!(file in heldBack) && restore(file)) {
                    heldBack[file] = `Held back with all other changes outside plots/: the build failed and no single file was to blame.\n${texts[0]?.slice(0, 1000) ?? ''}`;
                    progress = true;
                }
            }
        }
        if (!progress) break;
    }
}

for (const [slug, reason] of Object.entries(left)) {
    warn(`plots/${slug} didn't build, so it's under construction`, reason, plots.find((p) => p.slug === slug)?.file);
}
for (const [file, reason] of Object.entries(heldBack)) warn(`Kept the live version of ${file}`, reason, file);

if (built) {
    const versionFile = path.join(root, 'dist', 'version.json');
    if (fs.existsSync(versionFile)) {
        const version = JSON.parse(fs.readFileSync(versionFile, 'utf8'));
        version.underConstruction = Object.keys(left);
        version.liveVersionKept = Object.keys(heldBack);
        fs.writeFileSync(versionFile, `${JSON.stringify(version, null, 2)}\n`);
    }
    output('deploy', 'true');
} else {
    warn('Nothing deployed', "This push didn't build, even with fallbacks, so the live world is unchanged. See the log above.");
    output('deploy', 'false');
    if (!ci) process.exitCode = 1;
}
