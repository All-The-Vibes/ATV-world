/**
 * Finds every plot in plots/ and hands the list to the game as `virtual:atv-plots`.
 * A new folder is all it takes: no registry to edit, nothing to merge.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

export interface BuildInfo {
    sha: string;
    short: string;
    message: string;
    author: string;
    /** Commit time (ISO 8601). */
    time: string;
}

export interface PlotSource {
    slug: string;
    /** Entry file relative to the project root, e.g. `plots/my-plot/index.ts`. */
    file: string;
    /** Plot folder, or null for single-file plots like `plots/my-plot.ts`. */
    dir: string | null;
}

export interface PlotHint {
    lot?: [number, number] | false;
    size?: [number, number];
}

const VIRTUAL = 'virtual:atv-plots';
const RESOLVED = `\0${VIRTUAL}`;
const ENTRY_EXTS = ['ts', 'tsx', 'js', 'jsx', 'mjs'];
const SINGLE_FILE = /^(.+?)\.(?:ts|tsx|js|jsx|mjs)$/;
export const CODE_FILE = /\.(?:[cm]?[jt]sx?)$/i;
const IGNORED = /(?:^|[\\/])(?:node_modules|\.git)(?:[\\/]|$)/;

const git = (root: string, args: string[]) => {
    try {
        return execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'ignore'] });
    } catch {
        return '';
    }
};

/** Every plot: `plots/<slug>/index.*` folders, plus single files like `plots/<slug>.ts`. */
export function scanPlots(root: string): PlotSource[] {
    const base = path.join(root, 'plots');
    if (!fs.existsSync(base)) return [];
    const entries = fs.readdirSync(base, { withFileTypes: true }).filter((d) => !d.name.startsWith('.'));
    const found = new Map<string, PlotSource>();
    for (const d of entries) {
        if (!d.isDirectory()) continue;
        const ext = ENTRY_EXTS.find((e) => fs.existsSync(path.join(base, d.name, `index.${e}`)));
        if (ext) found.set(d.name, { slug: d.name, file: `plots/${d.name}/index.${ext}`, dir: `plots/${d.name}` });
    }
    for (const d of entries) {
        const m = d.isFile() ? SINGLE_FILE.exec(d.name) : null;
        if (m && !m[1].endsWith('.d') && !found.has(m[1])) found.set(m[1], { slug: m[1], file: `plots/${d.name}`, dir: null });
    }
    return [...found.values()].sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
}

/** When each plot first landed on main (0 = oldest). First come, first served for lots. */
export function plotOrder(root: string): Map<string, number> {
    const order = new Map<string, number>();
    const log = git(root, ['-c', 'core.quotePath=false', 'log', '--reverse', '--no-renames', '--diff-filter=A', '--name-only', '--format=@@', '--', 'plots']);
    let commit = -1;
    for (const raw of log.split('\n')) {
        const line = raw.trim();
        if (line === '@@') commit++;
        else if (line.startsWith('plots/')) {
            const rest = line.slice('plots/'.length);
            const cut = rest.indexOf('/');
            const slug = cut >= 0 ? rest.slice(0, cut) : rest.replace(/\.(?:ts|tsx|js|jsx|mjs)$/, '');
            if (!order.has(slug)) order.set(slug, commit);
        }
    }
    return order;
}

export function filesIn(dir: string): string[] {
    return (fs.readdirSync(dir, { recursive: true }) as string[])
        .filter((f) => !IGNORED.test(f))
        .map((f) => path.join(dir, f))
        .filter((f) => fs.statSync(f).isFile())
        .sort();
}

const LOT = /\blot\s*:\s*\[\s*(-?\d+)\s*,\s*(-?\d+)\s*\]/;
const NO_LOT = /\blot\s*:\s*false\b/;
const SIZE = /\bsize\s*:\s*\[\s*(\d+)\s*,\s*(\d+)\s*\]/;

/** Best-effort lot/size read from source, so a broken plot keeps its lot. */
export function readHints(src: string): PlotHint {
    const s = src.slice(Math.max(0, src.search(/definePlot\s*\(|export\s+default/)));
    const lot = LOT.exec(s);
    const size = SIZE.exec(s);
    return {
        lot: NO_LOT.test(s) ? false : lot ? [Number(lot[1]), Number(lot[2])] : undefined,
        size: size ? [Number(size[1]), Number(size[2])] : undefined,
    };
}

/** Plots left out of this build: `{ slug: reason }`, set by scripts/build.ts. */
function quarantined(): Record<string, string> {
    try {
        return JSON.parse(process.env.ATV_QUARANTINE || '{}');
    } catch {
        return {};
    }
}

export function buildInfo(root: string): BuildInfo {
    const [sha = '', author = '', time = '', ...subject] = git(root, ['log', '-1', '--format=%H%n%an%n%aI%n%s']).trim().split('\n');
    return {
        sha: sha || 'local',
        short: (sha || 'local').slice(0, 7),
        message: subject.join(' '),
        author,
        time: time || new Date().toISOString(),
    };
}

/** Plot chunks are named `assets/plot-<slug>-<hash>.js`, so a stack trace points at the right plot. */
export function chunkFileName(chunk: { facadeModuleId: string | null }): string {
    const m = chunk.facadeModuleId?.replaceAll('\\', '/').match(/\/plots\/([^/]+?)(?:\/index)?\.(?:[cm]?[jt]sx?)$/);
    return m ? `assets/plot-${m[1].replace(/[^\w-]/g, '_')}-[hash].js` : 'assets/[name]-[hash].js';
}

function moduleCode(root: string): string {
    const order = plotOrder(root);
    const left = quarantined();
    const rows = scanPlots(root).map((p) => {
        const error = left[p.slug] ?? null;
        const meta = {
            slug: p.slug,
            file: p.file,
            order: order.get(p.slug) ?? null,
            hint: readHints(fs.readFileSync(path.join(root, p.file), 'utf8')),
            error,
        };
        const load = error ? 'null' : `() => import(${JSON.stringify(`/${p.file}`)})`;
        return `  { ...${JSON.stringify(meta)}, load: ${load} }`;
    });
    return `export const plots = [\n${rows.join(',\n')}\n];\n`;
}

export function plotsPlugin(): Plugin {
    let root = process.cwd();
    let info: BuildInfo;
    return {
        name: 'atv-plots',
        config(config, env) {
            root = path.resolve(config.root ?? process.cwd());
            info = env.command === 'build'
                ? buildInfo(root)
                : { sha: 'dev', short: 'dev', message: 'Local dev server', author: '', time: new Date().toISOString() };
            return { define: { __ATV_BUILD__: JSON.stringify(info) } };
        },
        buildStart() {
            if (git(root, ['rev-parse', '--is-shallow-repository']).trim() === 'true') {
                this.warn('Shallow git clone: plots may land on different lots than on the live site.');
            }
        },
        resolveId(id) {
            return id === VIRTUAL ? RESOLVED : undefined;
        },
        load(id) {
            return id === RESOLVED ? moduleCode(root) : undefined;
        },
        // Phaser can't hot-swap, so any plot or game change reloads the page with a fresh plot list.
        hotUpdate({ file }) {
            if (this.environment.name !== 'client') return;
            const rel = path.relative(root, file).replaceAll('\\', '/');
            if (!rel.startsWith('plots/') && !rel.startsWith('src/game/') && !rel.startsWith('src/api/')) return;
            const graph = this.environment.moduleGraph;
            const mod = graph.getModuleById(RESOLVED);
            if (mod) graph.invalidateModule(mod);
            this.environment.hot.send({ type: 'full-reload' });
            return [];
        },
        // The live site polls this to know when a newer push has deployed.
        generateBundle() {
            const version = { ...info, built: new Date().toISOString() };
            this.emitFile({ type: 'asset', fileName: 'version.json', source: `${JSON.stringify(version, null, 2)}\n` });
        },
        // Images, sounds, JSON, etc. in a plot folder are served as-is at plots/<slug>/... (see plot.asset()).
        writeBundle(options) {
            const out = options.dir ?? path.join(root, 'dist');
            for (const p of scanPlots(root)) {
                if (!p.dir) continue;
                for (const f of filesIn(path.join(root, p.dir))) {
                    if (CODE_FILE.test(f)) continue;
                    const dest = path.join(out, path.relative(root, f));
                    fs.mkdirSync(path.dirname(dest), { recursive: true });
                    fs.copyFileSync(f, dest);
                }
            }
        },
    };
}
