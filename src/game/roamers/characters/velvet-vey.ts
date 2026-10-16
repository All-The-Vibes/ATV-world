import type { RoamerHandle, RoamerSpec } from '../types';
import { micProp } from '../props/velvet-vey';

const COLORS = [0xb070ff, 0xffd34d, 0xff7ac8];

function track(r: RoamerHandle, o: Phaser.GameObjects.GameObject) {
    const list = (r.data.objs ??= []) as Phaser.GameObjects.GameObject[];
    list.push(o);
    return o;
}

function star(r: RoamerHandle, x: number, y: number) {
    const s = r.world.scene;
    const p = s.add.rectangle(x, y, 2, 2, COLORS[Math.floor(Math.random() * 3)]).setDepth(1e6);
    track(r, p);
    s.tweens.add({ targets: p, y: y - 8, alpha: 0, scale: 2, duration: 600, onComplete: () => p.destroy() });
}

/** A spotlight cone of translucent pixels with stars twinkling around her. */
function performance(r: RoamerHandle, seconds: number) {
    const s = r.world.scene;
    const { x, y } = r.sprite;
    const cone = s.add.triangle(x, y - 14, 0, 0, -18, 28, 18, 28, 0xb070ff, 0.22).setOrigin(0.5, 0).setDepth(y - 1);
    cone.y = y - 40;
    cone.setFillStyle(0xb070ff, 0.22);
    track(r, cone);
    s.tweens.add({ targets: cone, angle: { from: -10, to: 10 }, duration: 900, yoyo: true, repeat: -1 });
    s.tweens.add({ targets: cone, alpha: 0, delay: seconds * 1000 - 400, duration: 400, onComplete: () => cone.destroy() });
    const ev = s.time.addEvent({
        delay: 140,
        repeat: Math.floor((seconds * 1000) / 140),
        callback: () => {
            const a = Math.random() * Math.PI * 2;
            star(r, r.sprite.x + Math.cos(a) * 16, r.sprite.y - 14 + Math.sin(a) * 14);
        },
    });
    track(r, { destroy: () => ev.remove(false) } as unknown as Phaser.GameObjects.GameObject);
}

const spec: RoamerSpec = {
    id: 'velvet-vey',
    name: 'Velvet Vey',
    look: { skin: 'cream', hair: 'pink', hairStyle: 'long', shirt: 'violet', pants: 'plum', shoes: 'gold' },
    prop: micProp,
    glow: 'pink',
    ward: 'rays',
    every: [30, 42],
    stay: [40, 60],
    speed: 22,
    greet: ['Darling, you came!', 'The stage is yours.', 'Lights, please!'],
    foil: ['Exit, stage left!', 'You are out of the show!', 'Boo! In the nicest way.'],
    token: ['Gold for the diva!', 'A prop for my number!', 'The audience tips well.'],
    hooks: {
        update(r, dt) {
            const d = r.data;
            d.showCd = ((d.showCd as number) ?? 6 + Math.random() * 4) - dt;
            if (d.showCd as number <= 0) {
                d.showCd = 10 + Math.random() * 3;
                r.pause(5);
                r.say('La la laaa~');
                performance(r, 5);
            }
            // Player in range: spotlight pose + cosmetic trail while close.
            const p = r.world.player();
            d.poseCd = ((d.poseCd as number) ?? 0) - dt;
            if (p && Math.hypot(p.x - r.sprite.x, p.y - r.sprite.y) < 26) {
                if ((d.poseCd as number) <= 0) {
                    d.poseCd = 14;
                    r.pause(1.8);
                    r.say('Spotlight, darling!');
                    d.trail = 1.8;
                }
            }
            if (((d.trail as number) ?? 0) > 0 && p) {
                d.trail = (d.trail as number) - dt;
                d.trailTick = ((d.trailTick as number) ?? 0) - dt;
                if ((d.trailTick as number) <= 0) {
                    d.trailTick = 0.12;
                    star(r, p.x + (Math.random() - 0.5) * 10, p.y - 4);
                }
            }
            // A UFO nearby: freeze and wave.
            const ufo = Reflect.get(r.world.scene, 'ufo') as { x?: number; y?: number } | undefined;
            d.ufoCd = ((d.ufoCd as number) ?? 0) - dt;
            if (ufo && typeof ufo.x === 'number' && typeof ufo.y === 'number' && (d.ufoCd as number) <= 0 && Math.hypot(ufo.x - r.sprite.x, ufo.y - r.sprite.y) < 90) {
                d.ufoCd = 20;
                r.pause(3);
                r.say('Take me to your leader!');
                const base = r.sprite.y;
                r.world.scene.tweens.add({ targets: r.sprite, y: base - 2, duration: 180, yoyo: true, repeat: 5, onComplete: () => r.sprite.setY(base) });
            }
        },
        onFoil(r) {
            for (let i = 0; i < 6; i++) star(r, r.sprite.x + (Math.random() - 0.5) * 20, r.sprite.y - 10 - Math.random() * 10);
        },
        onBurn(r) {
            r.pause(2);
            r.say('Encore! Encore!');
            for (let i = 0; i < 12; i++) star(r, r.sprite.x + (Math.random() - 0.5) * 24, r.sprite.y - 10 - Math.random() * 16);
        },
        onLeave(r) {
            for (const o of (r.data.objs ?? []) as Phaser.GameObjects.GameObject[]) o.destroy();
        },
    },
};

export default spec;
