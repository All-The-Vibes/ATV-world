import Phaser from 'phaser';
import { ensurePixels, speechArt } from '../kit';
import { AI_ADS, type AIAd } from './ads';
import {
    BILLBOARD_H,
    BILLBOARD_W,
    createAdScreen,
    createBillboardFrame,
    createBillboardShadow,
    SCREEN_H,
    SCREEN_OFFSET_X,
    SCREEN_OFFSET_Y,
    SCREEN_W,
} from './art';

const AD_DISPLAY_SECONDS = 5.5;
const MARQUEE_INTERVAL = 0.25;
const SCALE = 2;

export class Billboard {
    readonly parts: (Phaser.GameObjects.Image | Phaser.GameObjects.Sprite)[] = [];
    private readonly shadow: Phaser.GameObjects.Image;
    private readonly frame: Phaser.GameObjects.Image;
    private readonly screen: Phaser.GameObjects.Image;
    private readonly quipBubble: Phaser.GameObjects.Image;

    private adIndex = 0;
    private adTimer = 0;
    private marqueeTimer = 0;
    private marqueeFrame = 0;
    private isTransitioning = false;
    private quipTimeout?: ReturnType<typeof setTimeout>;

    constructor(
        private readonly scene: Phaser.Scene,
        readonly x: number,
        readonly y: number
    ) {
        // 1. Ensure all textures are generated
        this.ensureTextures();

        // 2. Add ground shadow
        this.shadow = scene.add.image(x, y + 2, 'billboard-shadow')
            .setScale(SCALE)
            .setAlpha(0.35)
            .setDepth(-1e8);
        this.parts.push(this.shadow);

        // 3. Add main chassis / frame
        this.frame = scene.add.image(x, y, 'billboard-frame-0')
            .setScale(SCALE)
            .setOrigin(0.5, 1)
            .setDepth(y);
        this.parts.push(this.frame);

        // 4. Add screen inside the frame
        // Screen center coordinates at 2x scale
        const screenCenterX = x;
        const screenCenterY = y - (BILLBOARD_H - SCREEN_OFFSET_Y - SCREEN_H / 2) * SCALE;

        this.screen = scene.add.image(screenCenterX, screenCenterY, `billboard-ad-${this.adIndex}`)
            .setScale(SCALE)
            .setOrigin(0.5, 0.5)
            .setDepth(y + 0.1);
        this.parts.push(this.screen);

        // 5. Speech bubble for quips
        this.quipBubble = scene.add.image(x, y - BILLBOARD_H * SCALE - 6, 'billboard-quip-0')
            .setScale(1.2)
            .setOrigin(0.5, 1)
            .setDepth(1e5)
            .setVisible(false);
        this.parts.push(this.quipBubble);

        // 6. Interactivity: click billboard to rotate to next ad immediately & show quip!
        this.frame.setInteractive({ useHandCursor: true });
        this.frame.on('pointerdown', () => {
            this.rotateAd(true);
        });

        // Clean up on scene destroy
        scene.events.once('shutdown', () => this.destroy());
    }

    private ensureTextures() {
        // Shadow
        ensurePixels(this.scene, 'billboard-shadow', () => createBillboardShadow());

        // Chassis frames (marquee 0, 1, 2)
        for (let f = 0; f < 3; f++) {
            ensurePixels(this.scene, `billboard-frame-${f}`, () => createBillboardFrame(f));
        }

        // Screen contents for each ad
        AI_ADS.forEach((ad, i) => {
            ensurePixels(this.scene, `billboard-ad-${i}`, () => createAdScreen(ad, i, AI_ADS.length));
            ensurePixels(this.scene, `billboard-quip-${i}`, () => speechArt(ad.quip, 22));
        });
    }

    /** Rotate to the next ad with a slick digital scanline transition. */
    rotateAd(manual = false) {
        if (this.isTransitioning) return;
        this.isTransitioning = true;
        this.adTimer = 0;

        const nextIndex = (this.adIndex + 1) % AI_ADS.length;

        // Quick CRT digital line collapse & reopen with texture swap
        this.scene.tweens.add({
            targets: this.screen,
            scaleY: 0.08 * SCALE,
            alpha: 0.6,
            duration: 80,
            ease: 'Quad.easeIn',
            onComplete: () => {
                this.adIndex = nextIndex;
                this.screen.setTexture(`billboard-ad-${this.adIndex}`);
                this.scene.tweens.add({
                    targets: this.screen,
                    scaleY: SCALE,
                    alpha: 1,
                    duration: 100,
                    ease: 'Quad.easeOut',
                    onComplete: () => {
                        this.isTransitioning = false;
                    },
                });
            },
        });

        // If clicked manually, display the ad's witty quip!
        if (manual) {
            this.showQuip(nextIndex);
        }
    }

    /** Show the speech bubble with the ad's humorous quip. */
    private showQuip(index: number) {
        if (this.quipTimeout) clearTimeout(this.quipTimeout);
        this.quipBubble.setTexture(`billboard-quip-${index}`).setVisible(true);

        // Pop-in bounce
        this.quipBubble.setScale(0.8);
        this.scene.tweens.add({
            targets: this.quipBubble,
            scale: 1.25,
            duration: 180,
            ease: 'Back.easeOut',
        });

        // Hide after 4.5 seconds
        this.quipTimeout = setTimeout(() => {
            if (this.quipBubble.scene) {
                this.scene.tweens.add({
                    targets: this.quipBubble,
                    alpha: 0,
                    duration: 250,
                    onComplete: () => {
                        this.quipBubble.setVisible(false).setAlpha(1);
                    },
                });
            }
        }, 4500);
    }

    update(dt: number) {
        const clampedDt = Math.min(dt, 0.1);

        // 1. Advance marquee chase lights
        this.marqueeTimer += clampedDt;
        if (this.marqueeTimer >= MARQUEE_INTERVAL) {
            this.marqueeTimer = 0;
            this.marqueeFrame = (this.marqueeFrame + 1) % 3;
            this.frame.setTexture(`billboard-frame-${this.marqueeFrame}`);
        }

        // 2. Auto-rotate ads timer
        this.adTimer += clampedDt;
        if (this.adTimer >= AD_DISPLAY_SECONDS) {
            this.rotateAd(false);
        }
    }

    /** Returns collision footprint for the billboard footings so player cannot walk through the posts. */
    bounds(): Phaser.Geom.Rectangle {
        return new Phaser.Geom.Rectangle(this.x - (BILLBOARD_W * SCALE) / 2 + 16 * SCALE, this.y - 12, (BILLBOARD_W - 32) * SCALE, 16);
    }

    getBounds(): Phaser.Geom.Rectangle {
        return this.frame.getBounds();
    }

    /** Current ad object. */
    get currentAd(): AIAd {
        return AI_ADS[this.adIndex];
    }

    destroy() {
        if (this.quipTimeout) clearTimeout(this.quipTimeout);
        this.parts.forEach((part) => part.destroy());
    }
}
