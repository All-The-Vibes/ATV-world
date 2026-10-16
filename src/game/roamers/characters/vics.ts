import Phaser from 'phaser';
import type { LightHandle } from '../../fx/Atmosphere';
import { ensurePixels } from '../../kit';
import { vicsSheet } from '../props/vics';
import type { RoamerHandle, RoamerSpec } from '../types';

interface Effects {
    shield: Phaser.GameObjects.Graphics;
    neon: Phaser.GameObjects.Image;
    light?: LightHandle;
    flashUntil: number;
}

const effects = new WeakMap<RoamerHandle, Effects>();
const SHIELD_RANGE = 130;

function spawn(r: RoamerHandle): void {
    const scene = r.world.scene;
    const key = ensurePixels(scene, 'vics-neon-suit', () => vicsSheet(true));
    const e: Effects = {
        shield: scene.add.graphics().setName('vics-shield'),
        neon: scene.add.image(r.sprite.x, r.sprite.y, key, 'side-0')
            .setOrigin(0.5, 1).setBlendMode(Phaser.BlendModes.ADD).setDepth(2e6 + 1).setName('vics-neon'),
        light: r.world.atmosphere?.addLight(0, 0, 64, 0x60fff2, 0.85, 0.04, { halo: 20, haloAlpha: 0.45 })
            .follow(r.sprite, 0, -19),
        flashUntil: 0,
    };
    effects.set(r, e);
    r.sprite.setName('@vics');
    const sync = () => {
        const s = r.sprite;
        const night = r.world.atmosphere?.night ?? 0;
        const dragon = r.world.dragon();
        const near = dragon !== undefined && Math.hypot(dragon.x - s.x, dragon.y - s.y) <= SHIELD_RANGE;
        const flashing = scene.time.now < e.flashUntil;
        e.neon.setPosition(s.x, s.y).setFrame(s.frame.name).setFlipX(s.flipX)
            .setScale(s.scaleX, s.scaleY).setAlpha(s.alpha * night * (0.8 + 0.2 * Math.sin(r.age * 5)))
            .setVisible(s.visible);
        e.shield.clear().setPosition(s.x, s.y - 23).setDepth(s.depth + 2).setVisible(s.visible && (near || flashing));
        if (near || flashing) {
            const pulse = 0.5 + 0.5 * Math.sin(r.age * 6);
            e.shield.fillStyle(0x60fff2, flashing ? 0.18 : 0.06).fillEllipse(0, 0, 49, 59);
            e.shield.lineStyle(2, flashing ? 0xffe5a0 : 0x60fff2, 0.6 + pulse * 0.3).strokeEllipse(0, 0, 49, 59);
            e.shield.lineStyle(1, 0xff52cf, 0.4).strokeEllipse(0, 0, 55, 65);
        }
    };
    scene.events.on('postupdate', sync);
    r.sprite.once('destroy', () => {
        scene.events.off('postupdate', sync);
        e.shield.destroy();
        e.neon.destroy();
        e.light?.destroy();
        effects.delete(r);
    });
    sync();
}

const spec: RoamerSpec = {
    id: 'vics',
    name: '@vics',
    look: { githubUsername: 'vicslive', skin: '#9f62cc', hair: '#bd86e9', hairStyle: 'spiky', shirt: 'cyan', pants: 'navy', shoes: 'pink' },
    sheet: vicsSheet,
    showName: true,
    burnReply: 'Thanks for the warm welcome!',
    glow: 'cyan',
    ward: 'ring',
    every: [12, 20],
    stay: [100, 140],
    speed: 48,
    greet: ["@vics, floating through the vibes!", 'Roads? My board prefers the scenic route.', 'Neon suit. Fuzzy face. Ready to build.'],
    foil: ['Shields up. Tokens stay here!', 'No stealing my good vibes!'],
    token: ['Hoverboard fuel!', 'One more token toward the future.'],
    hooks: {
        onSpawn: spawn,
        onBurn(r) {
            const e = effects.get(r);
            if (e) e.flashUntil = r.world.scene.time.now + 4400;
            r.sparkle('cyan');
        },
    },
};

export default spec;
