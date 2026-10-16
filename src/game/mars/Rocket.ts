import Phaser from 'phaser';
import { shadowTexture } from '../kit';
import { rocketTextures } from './art';

/** How far up the rocket flies before it's out of sight. */
const FLIGHT = 420;
const still = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/** A rocket standing at (x, y) that can blast off out of sight and come back down onto the same spot. */
export class Rocket {
    readonly body: Phaser.GameObjects.Image;
    private readonly flame: Phaser.GameObjects.Sprite;
    private readonly shadow: Phaser.GameObjects.Image;

    constructor(private readonly scene: Phaser.Scene, readonly x: number, readonly y: number) {
        rocketTextures(scene);
        this.shadow = scene.add.image(x, y, shadowTexture(scene, 26)).setAlpha(0.3).setDepth(-1e8);
        this.body = scene.add.image(x, y, 'rocket').setOrigin(0.5, 1).setDepth(y);
        this.flame = scene.add.sprite(x, y - 1, 'rocket-flame', 0).setOrigin(0.5, 0).setVisible(false);
    }

    /** The base of the rocket: walking into it climbs aboard. */
    foot(): Phaser.Geom.Rectangle {
        return new Phaser.Geom.Rectangle(this.x - 13, this.y - 14, 26, 17);
    }

    /** Rumble on the spot for a moment, then lift off and fly up out of sight. */
    launch(done: () => void) {
        this.ignite();
        this.puff();
        const rumble = still() ? 0 : 1;
        this.scene.tweens.add({
            targets: this.body,
            x: this.x + rumble,
            duration: 50,
            yoyo: true,
            repeat: 7,
            onUpdate: () => this.follow(),
            onComplete: () => {
                this.body.setX(this.x).setDepth(1e6 + 1);
                this.scene.tweens.add({
                    targets: this.body,
                    y: this.y - FLIGHT,
                    duration: 1500,
                    ease: 'Quad.easeIn',
                    onUpdate: () => this.follow(),
                    onComplete: () => {
                        this.flame.stop().setVisible(false);
                        done();
                    },
                });
            },
        });
    }

    /** Come down from out of sight and settle back on the spot. */
    land(done: () => void) {
        this.body.setPosition(this.x, this.y - FLIGHT).setDepth(1e6 + 1);
        this.ignite();
        this.follow();
        this.scene.tweens.add({
            targets: this.body,
            y: this.y,
            duration: 1700,
            ease: 'Quad.easeOut',
            onUpdate: () => this.follow(),
            onComplete: () => {
                this.flame.stop().setVisible(false);
                this.body.setDepth(this.y);
                this.follow();
                this.puff();
                done();
            },
        });
    }

    private ignite() {
        this.flame.setVisible(true).play('rocket-flame');
    }

    /** Keep the flame under the nozzle, and fade the shadow as the rocket climbs. */
    private follow() {
        this.flame.setPosition(this.body.x, this.body.y - 1).setDepth(this.body.depth + 0.5);
        this.shadow.setAlpha(0.3 * Phaser.Math.Clamp(1 - (this.y - this.body.y) / 200, 0, 1));
    }

    /** A ring of smoke billowing out from the base. */
    private puff() {
        if (still()) return;
        for (let i = 0; i < 10; i++) {
            const a = (i / 10) * Math.PI * 2;
            const cloud = this.scene.add.image(this.x + Math.cos(a) * 4, this.y - 2, 'rocket-smoke')
                .setDepth(this.y + 1)
                .setAlpha(0.85);
            this.scene.tweens.add({
                targets: cloud,
                x: cloud.x + Math.cos(a) * 30,
                y: cloud.y + Math.sin(a) * 10 - 4,
                scale: 2,
                alpha: 0,
                duration: 900 + i * 40,
                ease: 'Quad.easeOut',
                onComplete: () => cloud.destroy(),
            });
        }
    }
}

/** The launch site in town: a pad, a tower, a sign, and the rocket to Mars. */
export class LaunchPad {
    readonly rocket: Rocket;
    /** Everything that should count toward the world's size. */
    readonly parts: { getBounds: () => Phaser.Geom.Rectangle }[];
    /** Where dropped tokens would be out of reach. */
    readonly area: Phaser.Geom.Rectangle;

    constructor(scene: Phaser.Scene, x: number, y: number) {
        rocketTextures(scene);
        const pad = scene.add.image(x, y + 6, 'rocket-pad').setOrigin(0.5, 1).setDepth(-1e7);
        const tower = scene.add.image(x - 26, y + 1, 'rocket-tower').setOrigin(0, 1).setDepth(y - 0.5);
        this.rocket = new Rocket(scene, x, y);
        const sign = scene.add.image(x, y + 18, 'rocket-sign').setDepth(y + 18);
        this.parts = [pad, tower, this.rocket.body, sign];
        this.area = new Phaser.Geom.Rectangle(x - 30, y - 74, 60, 98);
    }

    /** The player is walking into the rocket. */
    boards(x: number, y: number) {
        return this.rocket.foot().contains(x, y);
    }
}
