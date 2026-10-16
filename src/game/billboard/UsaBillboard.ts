import Phaser from 'phaser';
import { PixelCanvas, ensurePixels, miniText, miniTextWidth, speechArt, stripFrames, type ColorName } from '../kit';

const W = 136;
const H = 68;

interface CornerAd {
    brand: string;
    badge: string;
    headline: string;
    tagline: string;
    offer: string;
    borderColor: ColorName;
    badgeColor: ColorName;
    headlineColor: ColorName;
    icon: 'atv2' | 'phoenix' | 'tokenmaster';
    quip: string;
}

const CORNER_ADS: readonly CornerAd[] = [
    {
        brand: 'ATV 2.0',
        badge: 'NEW RELEASE',
        headline: 'DOUBLE THE VIBES',
        tagline: 'ZERO PULL REQUESTS!',
        offer: 'SHIP STRAIGHT TO MAIN',
        borderColor: 'cyan',
        badgeColor: 'blue',
        headlineColor: 'yellow',
        icon: 'atv2',
        quip: 'ATV 2.0: Twice the vibes, still zero pull requests!',
    },
    {
        brand: 'PHOENIX',
        badge: 'REBRAND AI',
        headline: 'PROD OUTAGE?',
        tagline: 'IT IS A REBRAND!',
        offer: 'RISE FROM THE ASHES',
        borderColor: 'orange',
        badgeColor: 'red',
        headlineColor: 'gold',
        icon: 'phoenix',
        quip: 'Phoenix: Every production outage is just a personal rebrand.',
    },
    {
        brand: 'TOKENMASTERX',
        badge: 'MAX THROUGHPUT',
        headline: 'INFINITE CONTEXT',
        tagline: '10M TOKENS / SEC',
        offer: 'UNLIMITED VIBE POWER',
        borderColor: 'gold',
        badgeColor: 'violet',
        headlineColor: 'lime',
        icon: 'tokenmaster',
        quip: 'TokenmasterX: Minting and burning context tokens at light speed!',
    },
];

function drawCornerAdIcon(pc: PixelCanvas, ox: number, oy: number, icon: CornerAd['icon']) {
    if (icon === 'atv2') {
        // Glowing pixel globe + golden vibe star
        pc.ellipse(ox + 9, oy + 9, 8, 8, 'blue')
            .ellipse(ox + 9, oy + 9, 6, 6, 'sky')
            .rect(ox + 5, oy + 6, 4, 3, 'lime')
            .rect(ox + 10, oy + 8, 4, 4, 'grass')
            .rect(ox + 6, oy + 12, 3, 2, 'lime')
            .set(ox + 15, oy + 3, 'yellow')
            .set(ox + 14, oy + 4, 'gold')
            .set(ox + 16, oy + 4, 'gold')
            .set(ox + 15, oy + 5, 'yellow');
    } else if (icon === 'phoenix') {
        // Rising fiery Phoenix with spread wings
        pc.line(ox + 2, oy + 11, ox + 7, oy + 6, 'red')
            .line(ox + 3, oy + 12, ox + 7, oy + 8, 'orange')
            .line(ox + 16, oy + 11, ox + 11, oy + 6, 'red')
            .line(ox + 15, oy + 12, ox + 11, oy + 8, 'orange')
            .ellipse(ox + 9, oy + 10, 3, 5, 'orange')
            .ellipse(ox + 9, oy + 9, 2, 3, 'yellow')
            .set(ox + 9, oy + 3, 'gold')
            .set(ox + 8, oy + 4, 'yellow')
            .set(ox + 10, oy + 4, 'yellow')
            .line(ox + 8, oy + 15, ox + 6, oy + 17, 'red')
            .line(ox + 10, oy + 15, ox + 12, oy + 17, 'gold');
    } else {
        // TokenmasterX golden coin stack + lightning bolt
        pc.ellipse(ox + 9, oy + 14, 7, 3, 'clay')
            .ellipse(ox + 9, oy + 11, 7, 3, 'gold')
            .ellipse(ox + 9, oy + 8, 7, 3, 'yellow')
            .rect(ox + 7, oy + 7, 5, 1, 'bark')
            .rect(ox + 9, oy + 8, 1, 3, 'bark')
            .line(ox + 14, oy + 2, ox + 11, oy + 7, 'cyan')
            .line(ox + 11, oy + 7, ox + 15, oy + 7, 'white')
            .line(ox + 15, oy + 7, ox + 12, oy + 13, 'cyan');
    }
}

function createCornerBillboardSheet() {
    const frames = CORNER_ADS.length;
    const pc = new PixelCanvas(W * frames, H);

    CORNER_ADS.forEach((ad, f) => {
        const ox = f * W;

        // Twin heavy steel support legs + concrete footings
        for (const lx of [22, W - 30]) {
            pc.rect(ox + lx, H - 16, 8, 14, 'slate')
                .rect(ox + lx + 1, H - 16, 2, 14, 'steel')
                .rect(ox + lx - 2, H - 3, 12, 3, 'night');
        }
        // Cross-beam catwalk under the board
        pc.rect(ox + 10, H - 17, W - 20, 3, 'steel')
            .rect(ox + 10, H - 17, W - 20, 1, 'cloud');

        // Outer neon frame + dark screen
        pc.rect(ox + 2, 4, W - 4, H - 20, 'night')
            .rect(ox + 3, 5, W - 6, H - 22, ad.borderColor)
            .rect(ox + 5, 7, W - 10, H - 26, 'white')
            .rect(ox + 6, 8, W - 12, H - 28, 'ink');

        // Top spotlights
        for (const sx of [26, Math.floor(W / 2), W - 26]) {
            pc.rect(ox + sx - 3, 1, 6, 3, 'slate')
                .rect(ox + sx - 2, 3, 4, 1, ad.headlineColor);
        }

        // Chasing perimeter bulbs
        for (let bx = 6; bx < W - 6; bx += 6) {
            const on = ((bx / 6) + f) % 2 === 0;
            pc.set(ox + bx, 6, on ? 'yellow' : ad.borderColor);
            pc.set(ox + bx, H - 19, on ? ad.borderColor : 'yellow');
        }

        // Top header bar: Brand on left, Badge on right
        pc.rect(ox + 8, 10, W - 16, 9, 'night');
        miniText(pc, ox + 11, 12, ad.brand, ad.headlineColor);

        const bw = miniTextWidth(ad.badge) + 4;
        const bx = ox + W - 10 - bw;
        pc.rect(bx, 11, bw, 7, ad.badgeColor);
        miniText(pc, bx + 2, 12, ad.badge, 'white');

        // Left pixel-art icon for the ad
        drawCornerAdIcon(pc, ox + 10, 22, ad.icon);

        // Right ad copy: Headline, Tagline, and Offer pill
        const textX = ox + 32;
        miniText(pc, textX, 22, ad.headline, ad.headlineColor);
        miniText(pc, textX, 30, ad.tagline, 'white');

        const ow = miniTextWidth(ad.offer) + 6;
        pc.rect(textX, 38, ow, 7, ad.badgeColor)
            .rect(textX, 38, ow, 1, ad.borderColor);
        miniText(pc, textX + 3, 39, ad.offer, 'yellow');

        // Page indicator dots in bottom-right corner
        for (let d = 0; d < frames; d++) {
            pc.rect(ox + W - 20 + d * 4, 41, 2, 2, d === f ? 'yellow' : 'slate');
        }
    });

    pc.outline('ink');
    return { canvas: pc, frames: stripFrames(frames, W, H) };
}

/**
 * Corner billboard towards the right corner alternating between 3 ads:
 * ATV 2.0, Phoenix, and TokenmasterX.
 */
export class UsaBillboard {
    readonly parts: { getBounds: () => Phaser.Geom.Rectangle }[] = [];
    readonly footprint: Phaser.Geom.Rectangle;
    private readonly sprite: Phaser.GameObjects.Sprite;
    private readonly bubble: Phaser.GameObjects.Image;
    private readonly quipKeys: string[] = [];
    private adIndex = 0;

    constructor(private readonly scene: Phaser.Scene, readonly x: number, readonly y: number) {
        ensurePixels(scene, 'corner-billboard-ads', createCornerBillboardSheet);
        CORNER_ADS.forEach((ad, i) => {
            const k = `corner-billboard-quip-${i}`;
            ensurePixels(scene, k, () => speechArt(ad.quip, 26));
            this.quipKeys.push(k);
        });

        this.sprite = scene.add.sprite(x, y, 'corner-billboard-ads', 0)
            .setOrigin(0.5, 1)
            .setDepth(y)
            .setInteractive({ useHandCursor: true });
        this.parts.push(this.sprite);
        this.footprint = new Phaser.Geom.Rectangle(x - W / 2 + 12, y - 14, W - 24, 14);

        this.bubble = scene.add.image(x, y - H - 4, this.quipKeys[0])
            .setOrigin(0.5, 1)
            .setDepth(1e5)
            .setVisible(false);
        this.parts.push(this.bubble);

        // Alternate between ATV 2.0, Phoenix, and TokenmasterX every 4 seconds
        scene.time.addEvent({
            delay: 4000,
            loop: true,
            callback: () => this.nextAd(false),
        });

        // Clicking cycles immediately and shows the ad's speech bubble
        this.sprite.on('pointerdown', () => this.nextAd(true));
    }

    private nextAd(showBubble: boolean) {
        this.adIndex = (this.adIndex + 1) % CORNER_ADS.length;
        this.sprite.setFrame(this.adIndex);
        this.bubble.setTexture(this.quipKeys[this.adIndex]);
        if (showBubble) {
            this.bubble.setVisible(true);
            this.scene.time.delayedCall(3500, () => {
                if (this.bubble.active) this.bubble.setVisible(false);
            });
        }
    }
}

