import Phaser from 'phaser';
import {
    HEX, MINI_FONT_HEIGHT, PixelCanvas, addPixels, miniText, miniTextWidth, shadowTexture, speechArt, stripFrames, wrapWords,
    type ColorName,
} from '../kit';

type House = { name: string; fill: ColorName; trim: ColorName; motto: string };

/** The four houses of ATV. */
export const HOUSES: House[] = [
    { name: 'PUSHTOMAIN', fill: 'red', trim: 'gold', motto: 'BRAVE ENOUGH TO SKIP REVIEW' },
    { name: 'LINTERCLAW', fill: 'blue', trim: 'cloud', motto: 'NOT ONE WARNING LEFT' },
    { name: 'MERGEPUFF', fill: 'gold', trim: 'ink', motto: 'APPROVES EVERY PR' },
    { name: 'HOTFIXERIN', fill: 'forest', trim: 'mist', motto: 'PATCHES PROD AT 3AM' },
];

const MUSINGS = [
    'PLENTY OF COMMITS, I SEE.',
    'YOU PUSH ON FRIDAYS?!',
    'A KNACK FOR MERGE CONFLICTS...',
    'SO MANY OPEN TABS IN HERE.',
    'TALENT, YES. TESTS, NO.',
    'I SEE A LOT OF TODO COMMENTS.',
];

/** Seconds: the hop on or off a head, then each line, counted from when the hat lands. */
const HOP = 0.4;
const SAY_MUSING = 1.5;
const SAY_BETTER = 3.1;
const ANNOUNCE = 4.3;
const HOP_BACK = 7;

/** Walk this close to the stool to get sorted; go this far away before it'll sort you again. */
const REACH = 16;
const REARM = 34;

type Player = { sprite: Phaser.GameObjects.Sprite; marker: Phaser.GameObjects.Image };

/**
 * A talking hat on a stool. Walk up to it and it hops onto your head, hums and haws,
 * and sorts you into one of the four houses of ATV. Walk away and back for a re-sort.
 */
export class SortingHat {
    readonly stool: Phaser.GameObjects.Image;
    readonly hat: Phaser.GameObjects.Sprite;
    private readonly seat: Phaser.Math.Vector2;
    private state: 'idle' | 'hop' | 'sorting' | 'return' = 'idle';
    private t = 0;
    private armed = true;
    private readonly from = new Phaser.Math.Vector2();
    private bubble?: Phaser.GameObjects.Image;
    private saidAt = -Infinity;
    private step = 0;
    private house = -1;
    private wobble = 0;

    /** `canSort` is false while the player can't be reached (inside HQ, say). */
    constructor(private scene: Phaser.Scene, x: number, y: number, private player: () => Player | undefined, private canSort: () => boolean) {
        drawTextures(scene);
        scene.add.image(x, y, shadowTexture(scene, 16)).setAlpha(0.25).setDepth(-1e8);
        this.stool = scene.add.image(x, y + 1, 'sorting-hat-stool').setOrigin(0.5, 1).setDepth(y);
        this.seat = new Phaser.Math.Vector2(x, y - 10);
        this.hat = scene.add.sprite(this.seat.x, this.seat.y, 'sorting-hat', 0).setOrigin(0.5, 1).setDepth(y + 1);
    }

    update(dt: number) {
        const p = this.player();
        const present = !!p && p.sprite.visible && this.canSort();
        if (this.state !== 'idle' && !present) {
            this.reset();
            return;
        }

        switch (this.state) {
            case 'idle': {
                this.wobble += dt;
                this.hat.setPosition(this.seat.x, this.seat.y).setAngle(Math.sin(this.wobble * 1.7) * 3);
                if (!present) break;
                const d = Phaser.Math.Distance.Between(p.sprite.x, p.sprite.y, this.stool.x, this.stool.y);
                if (d > REARM) this.armed = true;
                if (this.armed && d < REACH) {
                    this.armed = false;
                    this.state = 'hop';
                    this.t = 0;
                    this.from.set(this.hat.x, this.hat.y);
                }
                break;
            }
            case 'hop': {
                this.t += dt;
                const k = Math.min(1, this.t / HOP);
                const to = this.head(p!);
                this.hop(this.from, to, k).setAngle((1 - k) * -40).setDepth(p!.sprite.depth + 2);
                if (k >= 1) {
                    this.state = 'sorting';
                    this.t = 0;
                    this.step = 0;
                    p!.marker.setVisible(false);
                    this.say('HMM... DIFFICULT. VERY DIFFICULT.');
                }
                break;
            }
            case 'sorting': {
                this.t += dt;
                const at = this.head(p!);
                const shake = this.t < ANNOUNCE ? Math.sin(this.t * 9) * 4 : 0;
                this.hat.setPosition(at.x, at.y).setAngle(shake).setDepth(p!.sprite.depth + 2);
                if (this.step === 1 && this.t >= SAY_MUSING) this.say(Phaser.Utils.Array.GetRandom(MUSINGS));
                if (this.step === 2 && this.t >= SAY_BETTER) this.say('WHERE TO PUT YOU... BETTER BE...');
                if (this.step === 3 && this.t >= ANNOUNCE) this.announce();
                if (this.t >= HOP_BACK) {
                    this.clearBubble();
                    this.state = 'return';
                    this.t = 0;
                    this.from.set(this.hat.x, this.hat.y);
                    p!.marker.setVisible(true);
                }
                break;
            }
            case 'return': {
                this.t += dt;
                const k = Math.min(1, this.t / HOP);
                this.hop(this.from, this.seat, k).setAngle(k * 360);
                if (k >= 1) {
                    this.state = 'idle';
                    this.hat.setDepth(this.stool.depth + 1);
                }
                break;
            }
        }

        // Flap the mouth while the latest line is being said.
        const now = this.scene.time.now;
        this.hat.setFrame(now - this.saidAt < 900 && Math.floor(now / 110) % 2 ? 1 : 0);
        this.bubble?.setPosition(Math.round(this.hat.x), Math.round(this.hat.y - 24));
    }

    private hop(from: { x: number; y: number }, to: { x: number; y: number }, k: number) {
        return this.hat.setPosition(
            Phaser.Math.Linear(from.x, to.x, k),
            Phaser.Math.Linear(from.y, to.y, k) - Math.sin(k * Math.PI) * 18,
        );
    }

    private head(p: Player) {
        return { x: Math.round(p.sprite.x), y: Math.round(p.sprite.y - 15) };
    }

    /** Put the hat straight back on its stool (the player went indoors mid-sort). */
    private reset() {
        this.clearBubble();
        this.state = 'idle';
        this.armed = false;
        this.hat.setPosition(this.seat.x, this.seat.y).setAngle(0).setDepth(this.stool.depth + 1).setFrame(0);
        this.player()?.marker.setVisible(true);
    }

    private say(text: string) {
        this.step++;
        const key = `sorting-hat-say-${text}`;
        if (!this.scene.textures.exists(key)) addPixels(this.scene, key, speechArt(text, 22));
        this.showBubble(key);
    }

    private announce() {
        this.step++;
        let pick = Phaser.Math.Between(0, HOUSES.length - 1);
        if (pick === this.house) pick = (pick + Phaser.Math.Between(1, HOUSES.length - 1)) % HOUSES.length;
        this.house = pick;
        const house = HOUSES[pick];
        const key = `sorting-hat-house-${house.name}`;
        if (!this.scene.textures.exists(key)) addPixels(this.scene, key, bannerArt(house));
        const bubble = this.showBubble(key).setScale(0.2);
        this.scene.tweens.add({ targets: bubble, scale: 1, duration: 260, ease: 'Back.easeOut' });

        const cam = this.scene.cameras.main;
        const c = HEX[house.fill];
        cam.flash(260, (c >> 16) & 255, (c >> 8) & 255, c & 255);
        cam.shake(160, 0.003);
        this.confetti(house);
    }

    private showBubble(key: string) {
        this.clearBubble();
        this.saidAt = this.scene.time.now;
        this.bubble = this.scene.add.image(Math.round(this.hat.x), Math.round(this.hat.y - 24), key).setOrigin(0.5, 1).setDepth(1e6);
        return this.bubble;
    }

    private clearBubble() {
        this.bubble?.destroy();
        this.bubble = undefined;
    }

    private confetti(house: House) {
        const colors = [house.fill, house.trim, 'white'] as const;
        for (let i = 0; i < 36; i++) {
            const bit = this.scene.add.image(this.hat.x, this.hat.y - 10, `sorting-hat-confetti-${colors[i % colors.length]}`).setDepth(1e6 - 1);
            const angle = Phaser.Math.FloatBetween(-Math.PI, 0);
            const speed = Phaser.Math.Between(30, 70);
            this.scene.tweens.add({
                targets: bit,
                x: bit.x + Math.cos(angle) * speed,
                y: bit.y + Math.sin(angle) * speed * 0.8,
                angle: Phaser.Math.Between(-360, 360),
                duration: 420,
                ease: 'Quad.easeOut',
                onComplete: () => this.scene.tweens.add({
                    targets: bit,
                    y: bit.y + Phaser.Math.Between(30, 55),
                    x: bit.x + Phaser.Math.Between(-10, 10),
                    alpha: 0,
                    duration: Phaser.Math.Between(900, 1500),
                    onComplete: () => bit.destroy(),
                }),
            });
        }
    }
}

/** A swallowtail banner in the house's colors: the house name, big, over its motto. */
function bannerArt(house: House): PixelCanvas {
    const title = `${house.name}!`;
    const motto = wrapWords(house.motto, 22);
    const w = Math.max(miniTextWidth(title) * 2, ...motto.map(miniTextWidth)) + 12;
    const h = 4 + MINI_FONT_HEIGHT * 2 + 3 + motto.length * (MINI_FONT_HEIGHT + 2) + 3;
    const pc = new PixelCanvas(w, h + 4);
    pc.rect(1, 1, w - 2, h - 2, house.fill).rect(2, 2, w - 4, 1, house.trim).rect(2, h - 3, w - 4, 1, house.trim);
    pc.rect(3, h - 1, 4, 4, house.fill).rect(4, h + 2, 2, 1, null);
    pc.rect(w - 7, h - 1, 4, 4, house.fill).rect(w - 6, h + 2, 2, 1, null);

    const big = new PixelCanvas(miniTextWidth(title), MINI_FONT_HEIGHT);
    miniText(big, 0, 0, title, house.trim);
    const bx = Math.floor((w - big.width * 2) / 2);
    for (let y = 0; y < big.height; y++) {
        for (let x = 0; x < big.width; x++) if (big.filled(x, y)) pc.rect(bx + x * 2, 4 + y * 2, 2, 2, house.trim);
    }
    const text = house.fill === 'gold' ? 'ink' : 'white';
    motto.forEach((line, i) => {
        miniText(pc, Math.floor((w - miniTextWidth(line)) / 2), 4 + MINI_FONT_HEIGHT * 2 + 3 + i * (MINI_FONT_HEIGHT + 2), line, text);
    });
    return pc.outline('ink');
}

function drawTextures(scene: Phaser.Scene) {
    if (scene.textures.exists('sorting-hat')) return;

    // A battered wizard's hat with a floppy tip, a patch, and a face in its creases. Frame 1 has its mouth open.
    const hat = new PixelCanvas(48, 24);
    for (let f = 0; f < 2; f++) {
        const ox = f * 24;
        for (let y = 5; y <= 19; y++) {
            const hw = 1.5 + (y - 5) * 0.4;
            const cx = 12 + (y < 9 ? (y - 9) * 0.5 : 0);
            for (let x = Math.floor(cx - hw); x <= Math.ceil(cx + hw); x++) {
                const n = (x - (cx - hw)) / (hw * 2);
                hat.set(ox + x, y, n < 0.25 ? 'wood' : n > 0.72 ? 'bark' : 'earth');
            }
        }
        // The tip flops over to the left.
        hat.line(ox + 10, 5, ox + 9, 3, 'earth').line(ox + 9, 3, ox + 6, 2, 'earth').line(ox + 6, 3, ox + 4, 4, 'earth')
            .set(ox + 9, 4, 'earth').set(ox + 10, 4, 'wood').set(ox + 8, 3, 'wood');
        hat.ellipse(ox + 12, 20.5, 11.5, 2.5, (_x, _y, nx, ny) => (ny < -0.2 ? 'wood' : nx > 0.6 ? 'bark' : 'earth'));
        hat.line(ox + 4, 19, ox + 20, 19, 'bark');
        hat.rect(ox + 14, 8, 3, 3, 'clay').set(ox + 13, 9, 'cream').set(ox + 17, 9, 'cream');
        hat.line(ox + 7, 11, ox + 9, 10, 'bark').line(ox + 13, 10, ox + 15, 11, 'bark');
        hat.set(ox + 8, 12, 'ink').set(ox + 14, 12, 'ink');
        if (f === 0) hat.line(ox + 8, 15, ox + 14, 15, 'bark').set(ox + 7, 14, 'bark').set(ox + 15, 14, 'bark');
        else hat.ellipse(ox + 11.5, 15.5, 3.5, 1.8, 'ink').set(ox + 11, 16, 'red').set(ox + 12, 16, 'red');
        hat.outline('ink', false, { x: ox, y: 0, w: 24, h: 24 });
    }
    addPixels(scene, 'sorting-hat', hat, stripFrames(2, 24, 24));

    const stool = new PixelCanvas(16, 13);
    stool.rect(1, 1, 14, 3, 'wood').rect(2, 1, 12, 1, 'clay')
        .line(3, 4, 2, 12, 'bark').line(12, 4, 13, 12, 'bark').line(7, 4, 7, 11, 'earth')
        .line(3, 8, 12, 8, 'earth')
        .outline('ink');
    addPixels(scene, 'sorting-hat-stool', stool);

    for (const c of ['red', 'gold', 'blue', 'cloud', 'ink', 'forest', 'mist', 'white'] as const) {
        addPixels(scene, `sorting-hat-confetti-${c}`, new PixelCanvas(2, 2).rect(0, 0, 2, 2, c));
    }
}
