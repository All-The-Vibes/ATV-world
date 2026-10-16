import Phaser from 'phaser';
import {
    PixelCanvas, addPixels, bayer, buildingArt, characterSheet, darker, lighter, lookKey,
    miniText, miniTextWidth, randomLook, shadowTexture, speechArt, toRamp, type CharacterLook, type Color,
} from '../kit';
import type { Burnable } from '../dragon/Dragon';

interface LockeNPC {
    name: string;
    sprite: Phaser.GameObjects.Sprite;
    shadow: Phaser.GameObjects.Image;
    label: Phaser.GameObjects.Image;
    bubble: Phaser.GameObjects.Image;
    anim: string;
    homeX: number;
    y: number;
    span: number;
    dir: number;
    speed: number;
    rest: number;
    quipOffset: number;
}

const LOCKE_SIBLINGS: {
    name: string;
    look: CharacterLook;
    dx: number;
    dy: number;
    span: number;
    speed: number;
    quip: string;
}[] = [
    {
        name: 'Tyler Locke',
        look: { skin: 'peach', hair: 'earth', hairStyle: 'short', shirt: 'blue', pants: 'navy', shoes: 'bark' },
        dx: -44,
        dy: 18,
        span: 24,
        speed: 19,
        quip: 'Check every door for the Head Key!',
    },
    {
        name: 'Kinsey Locke',
        look: { skin: 'peach', hair: 'bark', hairStyle: 'long', shirt: 'wine', pants: 'slate', shoes: 'ink' },
        dx: 0,
        dy: 25,
        span: 26,
        speed: 22,
        quip: 'Which door leads to the Anywhere Key?',
    },
    {
        name: 'Bode Locke',
        look: { skin: 'cream', hair: 'wood', hairStyle: 'spiky', hat: 'gold', shirt: 'orange', pants: 'blue', shoes: 'red' },
        dx: 44,
        dy: 19,
        span: 24,
        speed: 25,
        quip: 'I hear whispering keys behind the doors!',
    },
];

function drawMiniWindow(pc: PixelCanvas, x: number, y: number, w: number, h: number, glow: Color, trim: Color = 'cloud') {
    pc.rect(x, y, w, h, trim);
    for (let j = 1; j < h - 1; j++) {
        for (let i = 1; i < w - 1; i++) {
            const c = (i + j) % 3 === 0 ? lighter(glow) : bayer(x + i, y + j) < 0.45 ? glow : darker(glow);
            pc.set(x + i, y + j, c);
        }
    }
    pc.set(x + 1, y + 1, 'white');
    if (w >= 6) pc.rect(x + Math.floor(w / 2), y + 1, 1, h - 2, trim);
    if (h >= 7) pc.rect(x + 1, y + Math.floor(h / 2), w - 2, 1, trim);
    pc.rect(x - 1, y + h, w + 2, 1, darker(trim));
}

function drawPortalDoor(pc: PixelCanvas, x: number, y: number, w: number, h: number, color: Color, trim: Color = 'sand') {
    pc.rect(x - 1, y - 1, w + 2, h + 1, trim);
    const [d, b, l] = toRamp(color);
    for (let j = 0; j < h; j++) {
        for (let i = 0; i < w; i++) {
            if (j < 2 && (i < 2 - j || i >= w - 2 + j)) continue;
            pc.set(x + i, y + j, i === 0 ? l : i === w - 1 || i % 3 === 2 ? d : b);
        }
    }
    // Glowing keyhole in the door
    const kx = x + w - 3;
    const ky = y + Math.floor(h / 2);
    pc.set(kx, ky, 'gold').set(kx, ky + 1, 'yellow');
    // Small transom window at top of door
    if (h >= 12) {
        pc.rect(x + 2, y + 2, w - 4, 2, 'cyan').set(x + 2, y + 2, 'white');
    }
}

/**
 * The "Lock & Key" room (Keyhouse Manor): a mysterious Victorian house covered with lots of magical doors
 * and glowing windows, with Tyler Locke, Kinsey Locke, and Bode Locke patrolling outside.
 */
export class LockAndKey {
    readonly parts: { getBounds: () => Phaser.Geom.Rectangle }[] = [];
    readonly footprint: Phaser.Geom.Rectangle;
    private readonly npcs: LockeNPC[] = [];
    private clock = 0;

    constructor(
        private readonly scene: Phaser.Scene,
        readonly x: number,
        readonly y: number,
    ) {
        const { canvas } = buildingArt({
            w: 10,
            h: 7,
            style: 'brick',
            roof: 'purple',
            wall: 'dark',
            trim: 'sand',
            windows: false,
            door: false,
            chimney: true,
            seed: 42,
            draw: (pc, info) => {
                const { W, H, wallTop } = info;
                const wy1 = H - 3;

                // Ornate Victorian turret gable in the center of the roof
                for (let row = 0; row < 14; row++) {
                    const hw = 4 + row;
                    const ry = wallTop - 14 + row;
                    if (ry >= 2) {
                        pc.rect(Math.round(W / 2 - hw), ry, hw * 2, 1, row < 2 ? 'gold' : 'plum');
                    }
                }
                // Attic dormer windows across the roof
                const dormerColors: Color[] = ['cyan', 'gold', 'pink', 'lime', 'violet'];
                [20, 46, Math.round(W / 2 - 4), W - 54, W - 28].forEach((dx, idx) => {
                    drawMiniWindow(pc, dx, wallTop - 10, 8, 8, dormerColors[idx % dormerColors.length], 'sand');
                });

                // Upper-floor gallery of mysterious windows (10 windows across 2 upper tiers)
                const winColors: Color[] = ['sky', 'gold', 'violet', 'cyan', 'pink', 'yellow', 'lime', 'orange'];
                for (let tier = 0; tier < 2; tier++) {
                    const wy = wallTop + 3 + tier * 12;
                    for (let col = 0; col < 9; col++) {
                        const wx = 8 + col * 16;
                        // Leave center of tier 1 for the grand LOCK & KEY sign banner
                        if (tier === 1 && col >= 2 && col <= 6) continue;
                        drawMiniWindow(pc, wx, wy, 10, 9, winColors[(col + tier * 3) % winColors.length], 'cloud');
                    }
                }

                // Prominent "LOCK & KEY" signboard with a golden key emblem above the doors
                const title = 'LOCK & KEY';
                const tw = miniTextWidth(title);
                const sx = Math.round(W / 2 - tw / 2) - 10;
                const sy = wallTop + 15;
                const sw = tw + 20;
                pc.rect(sx, sy, sw, 11, 'bark')
                    .rect(sx, sy, sw, 1, 'gold')
                    .rect(sx, sy + 10, sw, 1, 'gold')
                    .rect(sx, sy, 1, 11, 'gold')
                    .rect(sx + sw - 1, sy, 1, 11, 'gold');
                // Tiny pixel-art golden key icon on the left of the sign
                pc.rect(sx + 3, sy + 4, 3, 3, 'gold')
                    .set(sx + 4, sy + 5, 'bark')
                    .rect(sx + 6, sy + 5, 4, 1, 'yellow')
                    .set(sx + 8, sy + 6, 'gold')
                    .set(sx + 9, sy + 6, 'gold');
                miniText(pc, sx + 12, sy + 3, title, 'yellow');

                // Ground-floor row of 7 magical doors (Anywhere Door, Ghost Door, Shadow Door, Omega Door, Mirror Door, etc.)
                const doorColors: Color[] = ['red', 'purple', 'wood', 'gold', 'teal', 'blue', 'orange'];
                const doorH = 17;
                const doorY = wy1 - doorH;
                for (let d = 0; d < 7; d++) {
                    const dx = 9 + d * 21;
                    drawPortalDoor(pc, dx, doorY, 11, doorH, doorColors[d % doorColors.length], d === 3 ? 'gold' : 'sand');
                    // Tiny side-light window between each pair of doors
                    if (d < 6) {
                        drawMiniWindow(pc, dx + 13, doorY + 2, 6, 9, winColors[(d + 2) % winColors.length], 'mist');
                    }
                }
            },
        });

        addPixels(scene, 'keyhouse-room', canvas);
        const building = scene.add.image(x, y, 'keyhouse-room').setOrigin(0.5, 1).setDepth(y);
        this.parts.push(building);
        this.footprint = building.getBounds();

        // Spawn the 3 Locke siblings from the "Locke & Key" series in front of the Lock & Key room
        LOCKE_SIBLINGS.forEach((spec, idx) => {
            const look = randomLook(spec.name, spec.look);
            const key = `keyhouse|${lookKey(look)}`;
            const sheet = characterSheet(look);
            addPixels(scene, key, sheet.canvas, sheet.frames);
            const anim = `${key}-walk`;
            if (!scene.anims.exists(anim)) {
                scene.anims.create({
                    key: anim,
                    frames: ['side-1', 'side-0', 'side-2', 'side-0'].map((frame) => ({ key, frame })),
                    frameRate: 8,
                    repeat: -1,
                });
            }

            const nx = x + spec.dx;
            const ny = y + spec.dy;
            const shadow = scene.add.image(nx, ny, shadowTexture(scene, 10)).setAlpha(0.28).setDepth(-1e8);
            const sprite = scene.add.sprite(nx, ny, key, 'side-0').setOrigin(0.5, 1).setDepth(ny).play(anim);
            sprite.setName(spec.name);

            const labelKey = `keyhouse-label-${spec.name}`;
            const labelCanvas = new PixelCanvas(miniTextWidth(spec.name) + 6, 9);
            labelCanvas.rect(0, 0, labelCanvas.width, 9, 'plum').rect(0, 0, labelCanvas.width, 1, 'gold');
            miniText(labelCanvas, 3, 2, spec.name, 'cream');
            addPixels(scene, labelKey, labelCanvas);
            const label = scene.add.image(nx, ny - 26, labelKey).setOrigin(0.5, 1).setDepth(ny + 1);

            const quipKey = `keyhouse-quip-${idx}`;
            addPixels(scene, quipKey, speechArt(spec.quip));
            const bubble = scene.add.image(nx, ny - 37, quipKey).setOrigin(0.5, 1).setDepth(1e5).setVisible(false);

            this.npcs.push({
                name: spec.name,
                sprite,
                shadow,
                label,
                bubble,
                anim,
                homeX: nx,
                y: ny,
                span: spec.span,
                dir: idx % 2 === 0 ? 1 : -1,
                speed: spec.speed,
                rest: 0,
                quipOffset: idx * 4,
            });
        });

        this.update(0);
        scene.events.once('shutdown', () => this.destroy());
    }

    burnables(): Burnable[] {
        return this.npcs.map((n) => ({
            sprite: n.sprite,
            headroom: 38,
            hold: (seconds: number) => {
                n.rest = Math.max(n.rest, seconds);
            },
        }));
    }

    sprites(): Phaser.GameObjects.Sprite[] {
        return this.npcs.map((n) => n.sprite);
    }

    update(dt: number) {
        const step = Math.min(dt, 0.1);
        this.clock += step;

        this.npcs.forEach((n, idx) => {
            if (n.rest > 0) {
                n.rest -= step;
                if (n.sprite.anims.isPlaying) n.sprite.stop().setFrame('side-0');
            } else {
                if (!n.sprite.anims.isPlaying) n.sprite.play(n.anim);
                n.sprite.x += n.dir * n.speed * step;
                const minX = n.homeX - n.span;
                const maxX = n.homeX + n.span;
                if (n.sprite.x <= minX || n.sprite.x >= maxX) {
                    n.sprite.x = Phaser.Math.Clamp(n.sprite.x, minX, maxX);
                    n.dir *= -1;
                }
                n.sprite.setFlipX(n.dir < 0);
            }
            n.shadow.setPosition(n.sprite.x, n.y);
            n.label.setPosition(n.sprite.x, n.y - 26).setDepth(n.y + 1);

            const activeSpeaker = Math.floor(this.clock / 4) % this.npcs.length === idx;
            const talkWindow = (this.clock % 4) < 2.8 && n.rest <= 0;
            n.bubble.setPosition(n.sprite.x, n.y - 37).setVisible(activeSpeaker && talkWindow);
        });
    }

    destroy() {
        for (const n of this.npcs) {
            n.sprite.destroy();
            n.shadow.destroy();
            n.label.destroy();
            n.bubble.destroy();
        }
    }
}
