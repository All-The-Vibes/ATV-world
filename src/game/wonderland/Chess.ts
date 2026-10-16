import Phaser from 'phaser';
import { CHESS, type PieceKind } from './curios';
import { Speaker, pick, still, type Feature } from './talk';

type Side = 'white' | 'red';
interface Piece {
    kind: PieceKind;
    side: Side;
    home: { r: number; c: number };
    r: number;
    c: number;
    sprite: Phaser.GameObjects.Image;
    speaker: Speaker;
    off: boolean;
}

const SETUP: [Side, PieceKind, number, number][] = [
    ['white', 'king', 7, 4], ['white', 'queen', 7, 3], ['white', 'rook', 7, 0], ['white', 'knight', 6, 1], ['white', 'bishop', 6, 5],
    ['white', 'pawn', 5, 2], ['white', 'pawn', 5, 6], ['white', 'pawn', 4, 4],
    ['red', 'king', 0, 4], ['red', 'queen', 0, 3], ['red', 'rook', 0, 7], ['red', 'knight', 1, 6], ['red', 'bishop', 1, 2],
    ['red', 'pawn', 2, 1], ['red', 'pawn', 2, 5], ['red', 'pawn', 3, 3],
];
const MOVE_LINES = ['Mind the squares!', 'Check! ...probably.', 'Excuse me, coming through!', 'I always wanted to be a queen.', "Whose move is it? Mine!"];
const TAKEN_LINES = ['Oof!', 'Most unfair!', 'I was only standing here!', 'Off the board I go!'];

/**
 * The Looking-Glass chessboard: the pieces are alive and play an endless, very loose game, hopping square to square
 * and knocking each other off the board. Now and then the Red Queen sprints a lap round the board, only to end up
 * exactly where she started.
 */
export class Chess implements Feature {
    private readonly pieces: Piece[] = [];
    private turn: Side = 'white';
    private wait = 1.5;
    private redTurns = 0;
    private busy = false;

    constructor(private readonly scene: Phaser.Scene, readonly x: number, readonly y: number) {
        const half = (CHESS.square * CHESS.size) / 2;
        scene.add.image(x, y, 'wl-chessboard').setDepth(-1e8 + 3);
        scene.add.image(x, y + half + 24, 'wl-tag-chess').setOrigin(0.5, 1).setDepth(y + half + 24);
        for (const [side, kind, r, c] of SETUP) {
            const sprite = scene.add.image(this.sx(c), this.sy(r), `wl-${side}-${kind}`).setOrigin(0.5, 1).setDepth(this.sy(r));
            const p: Piece = { kind, side, home: { r, c }, r, c, sprite, off: false, speaker: new Speaker(scene, () => ({ x: sprite.x, y: sprite.y - 28 })) };
            this.pieces.push(p);
        }
    }

    private sx(c: number) {
        return this.x - (CHESS.square * CHESS.size) / 2 + c * CHESS.square + CHESS.square / 2;
    }

    private sy(r: number) {
        return this.y - (CHESS.square * CHESS.size) / 2 + r * CHESS.square + CHESS.square - 3;
    }

    private at(r: number, c: number) {
        return this.pieces.find((p) => !p.off && p.r === r && p.c === c);
    }

    update(dt: number) {
        if (this.busy || (this.wait -= dt) > 0) return;
        this.wait = Phaser.Math.FloatBetween(1.4, 2.4);
        const side = this.turn;
        this.turn = side === 'white' ? 'red' : 'white';
        if (side === 'red' && ++this.redTurns % 4 === 0) {
            const rq = this.pieces.find((p) => p.side === 'red' && p.kind === 'queen' && !p.off);
            if (rq) {
                this.redQueenRuns(rq);
                return;
            }
        }
        const movers = Phaser.Utils.Array.Shuffle(this.pieces.filter((p) => p.side === side && !p.off));
        for (const p of movers) {
            const options = this.moves(p).filter(([r, c]) => {
                const there = this.at(r, c);
                return !there || (there.side !== side && there.kind !== 'king');
            });
            if (!options.length) continue;
            const [r, c] = pick(options);
            this.move(p, r, c);
            return;
        }
    }

    private moves(p: Piece): [number, number][] {
        const out: [number, number][] = [];
        const add = (dr: number, dc: number) => {
            const r = p.r + dr, c = p.c + dc;
            if (r >= 0 && r < CHESS.size && c >= 0 && c < CHESS.size) out.push([r, c]);
        };
        const slide = (dirs: [number, number][]) => dirs.forEach(([dr, dc]) => {
            for (let k = 1; k <= 3; k++) {
                add(dr * k, dc * k);
                if (this.at(p.r + dr * k, p.c + dc * k)) break;
            }
        });
        const straight: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        const diagonal: [number, number][] = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
        if (p.kind === 'pawn') {
            const fwd = p.side === 'white' ? -1 : 1;
            if (!this.at(p.r + fwd, p.c)) add(fwd, 0);
            for (const dc of [-1, 1]) if (this.at(p.r + fwd, p.c + dc)) add(fwd, dc);
            if (p.r + fwd < 0 || p.r + fwd >= CHESS.size) add(0, Math.random() < 0.5 ? -1 : 1);
        } else if (p.kind === 'knight') {
            [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]].forEach(([dr, dc]) => add(dr, dc));
        } else if (p.kind === 'rook') slide(straight);
        else if (p.kind === 'bishop') slide(diagonal);
        else if (p.kind === 'queen') slide([...straight, ...diagonal]);
        else [...straight, ...diagonal].forEach(([dr, dc]) => add(dr, dc));
        return out;
    }

    private move(p: Piece, r: number, c: number) {
        const taken = this.at(r, c);
        const from = { x: p.sprite.x, y: p.sprite.y }, to = { x: this.sx(c), y: this.sy(r) };
        p.r = r;
        p.c = c;
        if (Math.random() < 0.25) p.speaker.say(pick(MOVE_LINES), 1.8);
        this.hop(p.sprite, from, to, p.kind === 'knight' ? 22 : 10, () => {
            if (taken) this.knockOff(taken);
        });
    }

    private hop(sprite: Phaser.GameObjects.Image, from: { x: number; y: number }, to: { x: number; y: number }, arc: number, done?: () => void) {
        if (still()) {
            sprite.setPosition(to.x, to.y).setDepth(to.y);
            done?.();
            return;
        }
        const t = { v: 0 };
        this.scene.tweens.add({
            targets: t,
            v: 1,
            duration: 380,
            ease: 'Sine.easeInOut',
            onUpdate: () => sprite.setPosition(from.x + (to.x - from.x) * t.v, from.y + (to.y - from.y) * t.v - Math.sin(Math.PI * t.v) * arc).setDepth(from.y + (to.y - from.y) * t.v + 1),
            onComplete: () => {
                sprite.setDepth(to.y);
                done?.();
            },
        });
    }

    /** Taken: the piece tumbles off the edge of the board, and wanders back on later. */
    private knockOff(p: Piece) {
        p.off = true;
        p.speaker.say(pick(TAKEN_LINES), 1.6);
        const out = p.c < CHESS.size / 2 ? -1 : 1;
        this.scene.tweens.add({
            targets: p.sprite,
            x: this.x + out * ((CHESS.square * CHESS.size) / 2 + 30),
            y: p.sprite.y + 10,
            angle: still() ? 0 : out * 270,
            alpha: 0,
            duration: 700,
            ease: 'Quad.easeIn',
            onComplete: () => this.scene.time.delayedCall(6000, () => this.comeBack(p)),
        });
    }

    private comeBack(p: Piece) {
        let { r, c } = p.home;
        if (this.at(r, c)) {
            const free: [number, number][] = [];
            for (let rr = 0; rr < CHESS.size; rr++) for (let cc = 0; cc < CHESS.size; cc++) if (!this.at(rr, cc)) free.push([rr, cc]);
            [r, c] = pick(free);
        }
        p.r = r;
        p.c = c;
        p.off = false;
        p.sprite.setAngle(0).setPosition(this.sx(c), this.sy(r) - 30).setDepth(this.sy(r));
        this.scene.tweens.add({ targets: p.sprite, y: this.sy(r), alpha: 1, duration: 400, ease: 'Bounce.easeOut' });
        p.speaker.say("I'm back! Did I miss much?", 1.8);
    }

    /** "Faster! Faster!" A lap of the board at full tilt, finishing exactly where she began. */
    private redQueenRuns(q: Piece) {
        this.busy = true;
        const half = (CHESS.square * CHESS.size) / 2 + 12;
        const start = { x: q.sprite.x, y: q.sprite.y };
        const corners = [
            { x: this.x - half, y: this.y - half }, { x: this.x + half, y: this.y - half },
            { x: this.x + half, y: this.y + half }, { x: this.x - half, y: this.y + half }, { x: this.x - half, y: this.y - half }, start,
        ];
        q.speaker.say('Faster! FASTER!', 2.4);
        const leg = (i: number) => {
            if (i >= corners.length) {
                q.speaker.say('Here, you see, it takes all the running you can do to keep in the same place.', 3.6);
                this.busy = false;
                return;
            }
            const to = corners[i];
            this.scene.tweens.add({
                targets: q.sprite,
                x: to.x,
                y: to.y,
                duration: still() ? 1 : Math.max(120, Phaser.Math.Distance.Between(q.sprite.x, q.sprite.y, to.x, to.y) * 3.2),
                onUpdate: () => q.sprite.setDepth(q.sprite.y + 1).setFlipX(to.x < q.sprite.x),
                onComplete: () => leg(i + 1),
            });
        };
        leg(0);
    }
}
