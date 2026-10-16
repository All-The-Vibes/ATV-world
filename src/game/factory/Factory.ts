import Phaser from 'phaser';
import {
    PixelCanvas, addCreatorNametag, addPixels, characterSheet, discoGlowArt, lookKey, miniText, miniTextWidth, randomLook, shadowTexture, speechArt,
    type Facing,
} from '../kit';
import { MAX_AGENTS, roleById, type Role, type RoleId } from '../../factory/roles';
import { onDismiss, onSpawn, setFactoryAgents, setFactoryOpen, type AgentInfo } from '../../factory/bridge';
import type { Burnable } from '../dragon/Dragon';
import { beltArt, factoryArt } from './art';

export interface FactoryOptions {
    /** Where agents may walk. */
    area: () => Phaser.Geom.Rectangle;
    /** Whether an agent can stand there (not inside a building). */
    open: (x: number, y: number) => boolean;
}

interface Agent {
    info: AgentInfo;
    role: Role;
    key: string;
    sprite: Phaser.GameObjects.Sprite;
    shadow: Phaser.GameObjects.Image;
    tag: Phaser.GameObjects.Image;
    bubble: Phaser.GameObjects.Image;
    facing: Facing;
    target?: Phaser.Math.Vector2;
    speed: number;
    /** Seconds spent standing still, until the next walk. */
    wait: number;
    /** Seconds until the agent is off the belt and free to wander. */
    arriving: number;
    sayIn: number;
    bubbleLeft: number;
    /** A teammate's hand-off is coming: answer in this many seconds (0 = nothing pending). */
    replyIn: number;
    replyLine: string;
    leaving: boolean;
}

/** How far from where they stand an agent looks for the next spot to walk to. */
const ROAM = 130;

/**
 * The Agent Factory. Walk into the building (or click it) for a role picker; pick a role and a new
 * agent rolls out of the door on the conveyor belt and wanders the town, muttering role-flavored lines
 * and handing work to the other roles it meets.
 */
export class Factory {
    readonly building: Phaser.GameObjects.Image;
    readonly belt: Phaser.GameObjects.Sprite;
    /** Everything drawn for the factory itself, to fold into the world's bounds. */
    readonly parts: { getBounds: () => Phaser.Geom.Rectangle }[] = [];
    private readonly agents: Agent[] = [];
    private readonly foot: Phaser.Geom.Rectangle;
    private readonly door: Phaser.Math.Vector2;
    private readonly counts = new Map<RoleId, number>();
    private nextId = 1;
    private readonly stops: (() => void)[] = [];

    constructor(private readonly scene: Phaser.Scene, readonly x: number, readonly y: number, private readonly opts: FactoryOptions) {
        const { canvas, info } = factoryArt();
        addPixels(scene, 'factory-building', canvas);
        scene.add.image(x, y, shadowTexture(scene, canvas.width * 0.8)).setAlpha(0.25).setDepth(-1e8);
        this.building = scene.add.image(x, y, 'factory-building').setOrigin(0.5, 1).setDepth(y)
            .setInteractive({ useHandCursor: true }).setName('Agent Factory');
        this.building.on('pointerup', (p: Phaser.Input.Pointer) => {
            if (p.getDistance() < 6) setFactoryOpen(true);
        });
        this.parts.push(this.building);

        const left = x - canvas.width / 2;
        this.door = new Phaser.Math.Vector2(left + (info.door?.x ?? canvas.width / 2) + (info.door?.w ?? 0) / 2, y);
        this.foot = new Phaser.Geom.Rectangle(left + 6, y - 24, canvas.width - 12, 27);

        const belt = beltArt();
        addPixels(scene, 'factory-belt', belt.canvas, belt.frames);
        if (!scene.anims.exists('factory-belt')) {
            scene.anims.create({
                key: 'factory-belt', frames: belt.frames.map(({ name }) => ({ key: 'factory-belt', frame: name })), frameRate: 6, repeat: -1,
            });
        }
        addPixels(scene, 'factory-say-blank', speechArt('...'));
        this.belt = scene.add.sprite(this.door.x, y + 11, 'factory-belt', 0).setOrigin(0.5, 1).setDepth(y + 2).play('factory-belt');
        this.parts.push(this.belt);

        this.stops.push(
            onSpawn((role) => this.spawn(role)),
            onDismiss((id) => this.dismiss(id)),
        );
        const stop = () => this.destroy();
        scene.events.once('shutdown', stop);
        scene.events.once('destroy', stop);
    }

    /** The space the player can't walk through (and agents can't wander into). */
    solids(): Phaser.Geom.Rectangle[] {
        return [this.building.getBounds()];
    }

    /** Whoever is in the factory, for things that react to townspeople (the dragon, say). */
    burnables(): Burnable[] {
        return this.agents.filter((a) => !a.leaving).map((a) => ({
            sprite: a.sprite,
            headroom: 38,
            hold: (seconds: number) => {
                a.wait = Math.max(a.wait, seconds);
                a.target = undefined;
            },
        }));
    }

    /** Build an agent: it drops onto the belt out front, then wanders. The oldest one goes home if the town is full. */
    spawn(roleId: RoleId) {
        const role = roleById(roleId);
        while (this.agents.filter((a) => !a.leaving).length >= MAX_AGENTS) {
            this.dismiss(this.agents.find((a) => !a.leaving)?.info.id);
        }
        const n = (this.counts.get(role.id) ?? 0) + 1;
        this.counts.set(role.id, n);
        const info: AgentInfo = { id: this.nextId++, role: role.id, name: `${role.tag}-${n}` };

        const look = randomLook(`${role.id}-${n}`, role.look);
        const key = lookKey(look);
        const sheet = characterSheet(look);
        addPixels(this.scene, key, sheet.canvas, sheet.frames);
        for (const facing of ['down', 'up', 'side'] as const) {
            const anim = `${key}-${facing}-walk`;
            if (this.scene.anims.exists(anim)) continue;
            this.scene.anims.create({
                key: anim, frames: [`${facing}-1`, `${facing}-0`, `${facing}-2`, `${facing}-0`].map((frame) => ({ key, frame })),
                frameRate: 8, repeat: -1,
            });
        }

        const tagKey = `factory-tag-${info.name}`;
        const tagArt = new PixelCanvas(miniTextWidth(info.name) + 6, 9);
        tagArt.rect(0, 0, tagArt.width, 9, role.badge);
        miniText(tagArt, 3, 2, info.name, role.badgeText);
        addPixels(this.scene, tagKey, tagArt.outline('ink'));

        const px = this.door.x, py = this.y + 8;
        const shadow = this.scene.add.image(px, py, shadowTexture(this.scene, 10)).setAlpha(0.25).setDepth(-1e8);
        const sprite = this.scene.add.sprite(px, py - 14, key, 'down-0').setOrigin(0.5, 1).setDepth(py).setAlpha(0);
        const tag = this.scene.add.image(px, py - 26, tagKey).setOrigin(0.5, 1).setDepth(py + 1).setAlpha(0);
        const bubble = this.scene.add.image(px, py - 38, 'factory-say-blank').setOrigin(0.5, 1).setDepth(1e5).setVisible(false);
        const agent: Agent = {
            info, role, key, sprite, shadow, tag, bubble, facing: 'down', speed: Phaser.Math.Between(20, 30), wait: 0,
            arriving: 0.9, sayIn: Phaser.Math.FloatBetween(4, 9), bubbleLeft: 0, replyIn: 0, replyLine: '', leaving: false,
        };
        addCreatorNametag(sprite, look, { gap: 16, speech: () => agent.bubble });
        this.agents.push(agent);
        this.scene.tweens.add({ targets: [sprite, tag], alpha: 1, duration: 300 });
        this.scene.tweens.add({ targets: sprite, y: py, duration: 450, ease: 'Bounce.easeOut' });
        this.flash(px, py - 10);
        this.say(agent, 'HELLO, WORLD!');
        this.publish();
    }

    /** Send one agent (or everyone, with no id) back to the factory. */
    dismiss(id?: number) {
        for (const a of this.agents) {
            if (a.leaving || (id !== undefined && a.info.id !== id)) continue;
            a.leaving = true;
            a.bubble.setVisible(false);
            this.flash(a.sprite.x, a.sprite.y - 10);
            this.scene.tweens.add({
                targets: [a.sprite, a.tag, a.shadow], alpha: 0, duration: 260,
                onComplete: () => {
                    [a.sprite, a.tag, a.shadow, a.bubble].forEach((o) => o.destroy());
                    const i = this.agents.indexOf(a);
                    if (i >= 0) this.agents.splice(i, 1);
                },
            });
        }
        this.publish();
    }

    /** `player` is whoever can walk into the factory: it opens the role picker and steps them back out front. */
    update(dt: number, player?: Phaser.GameObjects.Sprite) {
        if (player && this.foot.contains(player.x, player.y)) {
            player.stop().setPosition(this.door.x, this.foot.bottom + 18);
            setFactoryOpen(true);
        }
        for (const a of this.agents) {
            if (a.leaving) continue;
            this.think(a, dt);
            a.shadow.setPosition(a.sprite.x, a.sprite.y);
            a.sprite.setDepth(a.sprite.y);
            a.tag.setPosition(a.sprite.x, a.sprite.y - 26).setDepth(a.sprite.y + 1);
            a.bubble.setPosition(a.sprite.x, a.sprite.y - 38);
        }
    }

    private think(a: Agent, dt: number) {
        if (a.bubbleLeft > 0 && (a.bubbleLeft -= dt) <= 0) a.bubble.setVisible(false);
        if (a.arriving > 0) {
            a.arriving -= dt;
            return;
        }
        if (a.replyIn > 0 && (a.replyIn -= dt) <= 0) this.say(a, a.replyLine);
        if ((a.sayIn -= dt) <= 0) {
            a.sayIn = Phaser.Math.FloatBetween(8, 15);
            this.chatter(a);
        }

        if (a.wait > 0) {
            a.wait -= dt;
            this.stand(a);
            return;
        }
        if (!a.target) {
            a.target = this.pickTarget(a);
            if (!a.target) {
                a.wait = 1;
                return;
            }
        }
        const dx = a.target.x - a.sprite.x, dy = a.target.y - a.sprite.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 2) {
            a.target = undefined;
            a.wait = Phaser.Math.FloatBetween(1.5, 4);
            return;
        }
        const step = Math.min(dist, a.speed * dt);
        const nx = a.sprite.x + dx / dist * step, ny = a.sprite.y + dy / dist * step;
        if (!this.opts.open(nx, ny)) {
            a.target = undefined;
            a.wait = 0.4;
            return;
        }
        a.sprite.setPosition(nx, ny);
        if (Math.abs(dx) > Math.abs(dy)) {
            a.facing = 'side';
            a.sprite.setFlipX(dx < 0);
        } else {
            a.facing = dy < 0 ? 'up' : 'down';
            a.sprite.setFlipX(false);
        }
        const anim = `${a.key}-${a.facing}-walk`;
        if (a.sprite.anims.currentAnim?.key !== anim || !a.sprite.anims.isPlaying) a.sprite.play(anim);
    }

    private stand(a: Agent) {
        if (a.sprite.anims.isPlaying) a.sprite.stop();
        a.sprite.setFrame(`${a.facing}-0`);
    }

    private pickTarget(a: Agent): Phaser.Math.Vector2 | undefined {
        const area = this.opts.area();
        for (let i = 0; i < 12; i++) {
            const x = Phaser.Math.Clamp(a.sprite.x + Phaser.Math.FloatBetween(-ROAM, ROAM), area.left, area.right);
            const y = Phaser.Math.Clamp(a.sprite.y + Phaser.Math.FloatBetween(-ROAM, ROAM) * 0.6, area.top, area.bottom);
            if (this.opts.open(x, y)) return new Phaser.Math.Vector2(x, y);
        }
        return undefined;
    }

    /** Mutter something, or (sometimes) hand work to a teammate of the right role and wait for their answer. */
    private chatter(a: Agent) {
        const handoff = Phaser.Utils.Array.GetRandom(a.role.handoffs);
        const mate = handoff && Math.random() < 0.4
            ? this.agents.find((b) => !b.leaving && b !== a && b.arriving <= 0 && b.role.id === handoff.to)
            : undefined;
        if (!handoff || !mate) {
            this.say(a, Phaser.Utils.Array.GetRandom(a.role.lines));
            return;
        }
        this.say(a, handoff.line);
        a.wait = Math.max(a.wait, 3);
        a.target = undefined;
        mate.replyIn = 1.8;
        mate.replyLine = handoff.reply;
        mate.wait = Math.max(mate.wait, 4);
        mate.target = undefined;
    }

    private say(a: Agent, text: string) {
        const key = `factory-say-${text}`;
        if (!this.scene.textures.exists(key)) addPixels(this.scene, key, speechArt(text));
        a.bubble.setTexture(key).setVisible(true);
        a.bubbleLeft = 3;
    }

    private flash(x: number, y: number) {
        const key = addPixels(this.scene, 'factory-flash', discoGlowArt('cyan', 16));
        const glow = this.scene.add.image(x, y, key).setBlendMode(Phaser.BlendModes.ADD).setDepth(y + 3).setAlpha(0.9);
        this.scene.tweens.add({ targets: glow, alpha: 0, scale: 1.7, duration: 420, onComplete: () => glow.destroy() });
    }

    private publish() {
        setFactoryAgents(this.agents.filter((a) => !a.leaving).map((a) => a.info));
    }

    private destroy() {
        this.stops.splice(0).forEach((stop) => stop());
        setFactoryOpen(false);
        setFactoryAgents([]);
    }
}
