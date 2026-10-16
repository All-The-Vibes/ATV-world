import Phaser from 'phaser';
import { PixelCanvas, addPixels, shadowTexture, type ColorName } from '../kit';

export interface CostumeTarget {
    sprite: Phaser.GameObjects.Sprite;
}

interface Costumed {
    overlay: Phaser.GameObjects.Sprite;
    costume: number;
    visiting: boolean;
}

const COSTUMES = ['ghost', 'pumpkin', 'skeleton', 'vampire', 'cat'] as const;
const FRAME_NAMES = [
    'down-0', 'down-1', 'down-2',
    'up-0', 'up-1', 'up-2',
    'side-0', 'side-1', 'side-2',
    'cheer-0', 'cheer-1', 'cheer-2', 'point-l', 'point-r',
] as const;
const REACH = 48;
const LEAVE = 62;

/** A seated witch who gives nearby people a temporary, randomly chosen Halloween costume. */
export class Witch {
    readonly witch: Phaser.GameObjects.Image;
    private readonly costumed = new Map<Phaser.GameObjects.Sprite, Costumed>();
    private readonly still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    constructor(
        private readonly scene: Phaser.Scene,
        readonly x: number,
        readonly y: number,
        private readonly targets: () => readonly CostumeTarget[],
        private readonly active: () => boolean,
    ) {
        addPixels(scene, 'halloween-witch', witchArt());
        addPixels(scene, 'halloween-sparkle-gold', sparkleArt('gold'));
        addPixels(scene, 'halloween-sparkle-pink', sparkleArt('pink'));
        addPixels(scene, 'halloween-sparkle-cyan', sparkleArt('cyan'));
        COSTUMES.forEach((costume) => {
            const art = costumeArt(costume);
            addPixels(scene, `halloween-costume-${costume}`, art.canvas, art.frames);
        });

        scene.add.image(x, y, shadowTexture(scene, 34)).setAlpha(0.3).setDepth(-1e8);
        this.witch = scene.add.image(x, y, 'halloween-witch').setOrigin(0.5, 1).setDepth(y);
        scene.events.once('shutdown', () => this.destroy());
    }

    update() {
        const available = new Set(this.targets().map((target) => target.sprite));
        for (const sprite of available) {
            let state = this.costumed.get(sprite);
            if (!state) {
                state = {
                    overlay: this.scene.add.sprite(sprite.x, sprite.y, 'halloween-costume-ghost', 'down-0')
                        .setOrigin(sprite.originX, sprite.originY)
                        .setVisible(false),
                    costume: -1,
                    visiting: false,
                };
                this.costumed.set(sprite, state);
            }

            const distance = Phaser.Math.Distance.Between(sprite.x, sprite.y, this.x, this.y);
            const canVisit = this.active() && sprite.visible;
            if (!state.visiting && canVisit && distance <= REACH) this.costume(sprite, state);
            if (state.visiting && (!canVisit || distance > LEAVE)) {
                state.visiting = false;
                state.overlay.setVisible(false);
            }
            this.sync(sprite, state);
        }

        for (const [sprite, state] of this.costumed) {
            if (available.has(sprite)) continue;
            state.overlay.destroy();
            this.costumed.delete(sprite);
        }
    }

    setVisible(visible: boolean) {
        this.witch.setVisible(visible);
        if (!visible) {
            for (const state of this.costumed.values()) {
                state.visiting = false;
                state.overlay.setVisible(false);
            }
        }
    }

    destroy() {
        for (const state of this.costumed.values()) state.overlay.destroy();
        this.costumed.clear();
        this.witch.destroy();
    }

    private costume(sprite: Phaser.GameObjects.Sprite, state: Costumed) {
        let next = Phaser.Math.Between(0, COSTUMES.length - 1);
        if (next === state.costume) next = (next + Phaser.Math.Between(1, COSTUMES.length - 1)) % COSTUMES.length;
        state.costume = next;
        state.visiting = true;
        state.overlay.setTexture(`halloween-costume-${COSTUMES[next]}`).setVisible(true);
        this.sparkle(sprite.x, sprite.y - 10);
    }

    private sync(sprite: Phaser.GameObjects.Sprite, state: Costumed) {
        if (!state.visiting) return;
        const frame = String(sprite.frame.name);
        const costumeFrame = FRAME_NAMES.includes(frame as typeof FRAME_NAMES[number]) ? frame : 'down-0';
        state.overlay
            .setPosition(sprite.x, sprite.y)
            .setFrame(costumeFrame)
            .setFlipX(sprite.flipX)
            .setAlpha(sprite.alpha)
            .setDepth(sprite.depth + 0.25)
            .setVisible(sprite.visible);
    }

    private sparkle(x: number, y: number) {
        const colors = ['gold', 'pink', 'cyan'] as const;
        for (let i = 0; i < 12; i++) {
            const angle = i / 12 * Math.PI * 2 + Phaser.Math.FloatBetween(-0.16, 0.16);
            const distance = Phaser.Math.Between(13, 27);
            const bit = this.scene.add.image(x, y, `halloween-sparkle-${colors[i % colors.length]}`)
                .setDepth(1e6)
                .setScale(i % 3 ? 1 : 1.5);
            if (this.still) {
                bit.setPosition(x + Math.cos(angle) * distance, y + Math.sin(angle) * distance);
                this.scene.time.delayedCall(180, () => bit.destroy());
                continue;
            }
            this.scene.tweens.add({
                targets: bit,
                x: x + Math.cos(angle) * distance,
                y: y + Math.sin(angle) * distance,
                alpha: 0,
                angle: i % 2 ? 90 : -90,
                duration: 420,
                ease: 'Quad.easeOut',
                onComplete: () => bit.destroy(),
            });
        }
    }
}

function sparkleArt(color: ColorName) {
    return new PixelCanvas(7, 7)
        .set(3, 0, color).set(3, 1, color).set(3, 2, 'white')
        .set(0, 3, color).set(1, 3, color).set(2, 3, 'white')
        .set(3, 3, 'white')
        .set(4, 3, 'white').set(5, 3, color).set(6, 3, color)
        .set(3, 4, 'white').set(3, 5, color).set(3, 6, color);
}

function witchArt() {
    const pc = new PixelCanvas(50, 48);
    // Broom and chair.
    pc.line(4, 43, 19, 4, 'wood').line(5, 43, 20, 4, 'clay');
    for (let i = 0; i < 8; i++) pc.line(2 + i, 45, 6 + i, 35, i % 2 ? 'gold' : 'sand');
    pc.rect(16, 28, 25, 4, 'earth').rect(18, 31, 3, 15, 'wood').rect(36, 31, 3, 15, 'wood');
    // Seated witch.
    pc.rect(22, 21, 15, 16, 'plum').rect(19, 35, 20, 7, 'night');
    pc.rect(21, 39, 7, 4, 'ink').rect(34, 39, 7, 4, 'ink');
    pc.rect(24, 12, 12, 10, 'forest').set(27, 16, 'ink').set(33, 16, 'ink');
    pc.set(35, 18, 'forest').set(36, 19, 'forest');
    pc.rect(22, 8, 17, 5, 'ink').rect(26, 3, 10, 7, 'night');
    pc.line(27, 3, 34, 0, 'night').line(34, 0, 38, 7, 'night');
    pc.rect(25, 10, 9, 2, 'violet').set(36, 4, 'pink');
    pc.rect(20, 22, 4, 11, 'plum').rect(36, 22, 4, 11, 'plum');
    pc.set(19, 32, 'forest').set(40, 32, 'forest');
    // Candy bowl.
    pc.ellipse(30, 35, 8, 3, 'orange').ellipse(30, 34, 6, 2, 'ink');
    ['gold', 'pink', 'cyan', 'lime'].forEach((color, i) => pc.set(26 + i * 3, 32 + i % 2, color as ColorName));
    return pc.outline('ink', true);
}

function costumeArt(costume: typeof COSTUMES[number]) {
    const pc = new PixelCanvas(16 * FRAME_NAMES.length, 22);
    const frames = FRAME_NAMES.map((name, index) => {
        drawCostume(pc, index * 16, costume, name);
        pc.outline('ink', false, { x: index * 16, y: 0, w: 16, h: 22 });
        return { name, x: index * 16, y: 0, w: 16, h: 22 };
    });
    return { canvas: pc, frames };
}

function drawCostume(pc: PixelCanvas, ox: number, costume: typeof COSTUMES[number], frame: string) {
    const side = frame.startsWith('side');
    const up = frame.startsWith('up');
    const step = frame.endsWith('1') ? -1 : frame.endsWith('2') ? 1 : 0;
    const p = (x: number, y: number, color: ColorName) => pc.set(ox + x, y, color);
    const rect = (x: number, y: number, w: number, h: number, color: ColorName) => pc.rect(ox + x, y, w, h, color);

    if (costume === 'ghost') {
        pc.ellipse(ox + 8, 9, 7, 8, up ? 'cloud' : 'white');
        rect(2, 8, 12, 11, 'white');
        p(2, 20, 'white'); p(3, 19, 'white'); p(5, 20, 'white'); p(8, 19, 'white'); p(11, 20, 'white'); p(13, 19, 'white');
        if (!up) {
            p(side ? 9 : 5, 7, 'ink');
            p(side ? 10 : 10, 7, 'ink');
            if (!side) rect(7, 11, 3, 1, 'slate');
        }
        return;
    }

    if (costume === 'pumpkin') {
        pc.ellipse(ox + 8, 7, 7, 6, 'orange');
        rect(7, 0, 2, 3, 'forest');
        if (!up) {
            p(side ? 10 : 5, 6, 'yellow'); p(side ? 11 : 10, 6, 'yellow');
            rect(side ? 9 : 6, 9, side ? 3 : 5, 1, 'ink');
        }
        rect(3, 12, 10, 5, 'night');
        rect(4, 17, 8, 3, 'plum');
        p(4 + (step < 0 ? -1 : 0), 20, 'ink'); p(10 + (step > 0 ? 1 : 0), 20, 'ink');
        return;
    }

    if (costume === 'skeleton') {
        rect(3, 11, 10, 6, 'ink'); rect(4, 17, 8, 4, 'ink');
        rect(7, 11, 2, 6, 'cloud');
        rect(5, 13, 6, 1, 'cloud'); rect(5, 15, 6, 1, 'cloud');
        rect(5, 17, 2, 4, 'cloud'); rect(9, 17, 2, 4, 'cloud');
        p(3, 12, 'cloud'); p(12, 12, 'cloud');
        return;
    }

    if (costume === 'vampire') {
        rect(2, 11, 12, 9, 'wine');
        pc.line(ox + 2, 11, ox, 19, 'night').line(ox + 13, 11, ox + 15, 19, 'night');
        rect(6, 11, 4, 6, 'white');
        p(6, 11, 'red'); p(9, 11, 'red');
        if (!up) { p(side ? 11 : 6, 10, 'white'); p(side ? 11 : 9, 10, 'white'); }
        return;
    }

    // Black cat.
    p(4, 2, 'night'); p(5, 1, 'night'); p(10, 1, 'night'); p(11, 2, 'night');
    rect(3, 11, 10, 7, 'night'); rect(4, 18, 3, 3, 'night'); rect(9, 18, 3, 3, 'night');
    p(3, 12, 'pink'); p(12, 12, 'pink');
    pc.line(ox + 12, 16, ox + 15, 13 + step, 'night');
}
