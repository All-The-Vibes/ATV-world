import Phaser from 'phaser';
import { addPixels, characterSheet, lookKey, randomLook, shadowTexture, type Accessory, type PixelCanvas } from '../../kit';
import type { RoamerHandle, RoamerSpec } from '../types';
import { pulseBlade } from '../props/dusk-marshal';

interface Escort {
    sprite: Phaser.GameObjects.Sprite;
    shadow: Phaser.GameObjects.Image;
    anim: string;
}

interface TrailPoint {
    x: number;
    y: number;
}

const guardArmor: Accessory = (pc: PixelCanvas, ox: number, facing, frame) => {
    const side = facing === 'side';
    const helmetX = ox + (side ? 4 : 3);
    const helmetW = side ? 8 : 10;
    pc.rect(helmetX, 2, helmetW, 4, 'white')
        .rect(helmetX - (side ? 0 : 1), 5, helmetW + (side ? 0 : 2), 2, 'cloud')
        .rect(ox + (side ? 6 : 5), 7, side ? 4 : 6, 1, 'navy')
        .set(ox + (frame % 2 ? 7 : 8), 7, 'cyan')
        .rect(ox + 4, 11, 8, 4, 'white')
        .rect(ox + 5, 12, 6, 2, 'cloud')
        .rect(ox + 6, 14, 4, 1, 'steel')
        .rect(ox + 2, 11, 2, 3, 'cloud')
        .rect(ox + 12, 11, 2, 3, 'cloud');
};

function escortSheet(index: number) {
    const looks = [
        { shirt: 'white', pants: 'steel', shoes: 'white' },
        { shirt: 'cloud', pants: 'slate', shoes: 'white' },
        { shirt: 'white', pants: 'steel', shoes: 'mist' },
    ] as const;
    const look = randomLook(`ivory-circuit-guard-${index}`, {
        skin: 'sand',
        hair: 'ink',
        hairStyle: 'bald',
        hat: 'cloud',
        ...looks[index],
    });
    return { look, ...characterSheet(look, guardArmor) };
}

function trailTarget(trail: TrailPoint[], distance: number, x: number, y: number, flipX: boolean): TrailPoint {
    let remaining = distance;
    for (let i = 1; i < trail.length; i++) {
        const newer = trail[i - 1];
        const older = trail[i];
        const length = Math.hypot(older.x - newer.x, older.y - newer.y);
        if (length >= remaining) {
            const t = remaining / length;
            return { x: newer.x + (older.x - newer.x) * t, y: newer.y + (older.y - newer.y) * t };
        }
        remaining -= length;
    }
    const oldest = trail.at(-1) ?? { x, y };
    return { x: oldest.x + (flipX ? 1 : -1) * remaining, y: oldest.y };
}

function escortsFor(r: RoamerHandle): Escort[] {
    const existing = r.data.escorts as Escort[] | undefined;
    if (existing) return existing;

    const { scene } = r.world;
    const escorts = [0, 1, 2].map((index) => {
        const { look, canvas, frames } = escortSheet(index);
        const key = lookKey(look);
        addPixels(scene, key, canvas, frames);
        const anim = `${key}-escort-walk`;
        if (!scene.anims.exists(anim)) {
            scene.anims.create({
                key: anim,
                frames: ['side-1', 'side-0', 'side-2', 'side-0'].map((frame) => ({ key, frame })),
                frameRate: 8,
                repeat: -1,
            });
        }
        const behind = (index + 1) * 22;
        const x = r.sprite.x + (r.sprite.flipX ? behind : -behind);
        const shadow = scene.add.image(x, r.sprite.y, shadowTexture(scene, 10)).setAlpha(0.25).setDepth(-1e8 + 1);
        const sprite = scene.add.sprite(x, r.sprite.y, key, 'side-0').setOrigin(0.5, 1).setDepth(r.sprite.y).play(anim);
        return { sprite, shadow, anim };
    });
    r.data.escorts = escorts;
    r.data.trail = [{ x: r.sprite.x, y: r.sprite.y }] satisfies TrailPoint[];
    return escorts;
}

function follow(r: RoamerHandle, dt: number): void {
    const escorts = escortsFor(r);
    const trail = r.data.trail as TrailPoint[];
    const leader = r.sprite;
    const last = trail[0];
    if (Math.hypot(leader.x - last.x, leader.y - last.y) >= 3) {
        trail.unshift({ x: leader.x, y: leader.y });
        if (trail.length > 64) trail.length = 64;
    }

    escorts.forEach((escort, index) => {
        const sprite = escort.sprite;
        const target = trailTarget(trail, (index + 1) * 22, leader.x, leader.y, leader.flipX);
        const dx = target.x - sprite.x;
        const dy = target.y - sprite.y;
        const distance = Math.hypot(dx, dy);
        if (distance > 1.5) {
            const step = Math.min(distance, 42 * dt);
            sprite.x += dx / distance * step;
            sprite.y += dy / distance * step;
            if (Math.abs(dx) > 1) sprite.setFlipX(dx < 0);
            if (!sprite.anims.isPlaying) sprite.play(escort.anim);
        } else if (sprite.anims.isPlaying) {
            sprite.stop().setFrame('side-0');
        }
        sprite.setDepth(sprite.y);
        escort.shadow.setPosition(sprite.x, sprite.y);
    });
}

const spec: RoamerSpec = {
    id: 'dusk-marshal',
    name: 'Dusk Marshal',
    look: {
        skin: 'sand',
        hair: 'ink',
        hairStyle: 'bald',
        hat: 'night',
        shirt: 'night',
        pants: 'ink',
        shoes: 'ink',
    },
    prop: pulseBlade,
    glow: 'red',
    ward: 'rays',
    every: [32, 48],
    stay: [38, 58],
    speed: 30,
    greet: ['The night is calm. For now.', 'My escorts are on patrol.', 'Keep your eyes on the horizon.'],
    foil: ['Stand down, little troublemaker.', 'The patrol has this covered.', 'Peace restored.'],
    token: ['A curious energy source.', 'Secure the shiny object.', 'The patrol has found a token.'],
    hooks: {
        update(r, dt) {
            follow(r, dt);
        },
        onLeave(r) {
            const escorts = r.data.escorts as Escort[] | undefined;
            escorts?.forEach(({ sprite, shadow }) => {
                sprite.destroy();
                shadow.destroy();
            });
            r.data.escorts = undefined;
            r.data.trail = undefined;
        },
    },
};

export default spec;
