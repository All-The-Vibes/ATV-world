import Phaser from 'phaser';
import { isTyping } from '../commands';
import { sp } from '../spread';
import {
    HEX, PixelCanvas, addCreatorNametag, addPixels, characterSheet, flameArt, miniText, miniTextWidth, randomLook, shadowTexture,
} from '../kit';

const INCIDENTS = [
    { name: 'BUILDING FIRE', action: 'Extinguishing the hotfix' },
    { name: 'POWER OUTAGE', action: 'Restarting production' },
    { name: 'ALIEN INVASION', action: 'Negotiating first contact' },
    { name: 'NETWORK FAILURE', action: 'Reconnecting the network' },
] as const;
type Phase = 'idle' | 'detecting' | 'responding' | 'resolving' | 'resolved' | 'returning';
const AUTO_INTERVAL = 30;
/** The station was laid out around (-290, 45); it moves as a block with the plaza's spread. */
const DX = sp(-290) + 290, DY = sp(45) - 45;
type Agent = {
    sprite: Phaser.GameObjects.Sprite;
    shadow: Phaser.GameObjects.Image;
    label: Phaser.GameObjects.Image;
    home: Phaser.Math.Vector2;
    work: Phaser.Math.Vector2;
    anim: string;
};

/** A self-contained, harmless production drill. Its clock pauses with the world scene. */
export class Incidents {
    readonly parts: Phaser.GameObjects.Image[] = [];
    readonly button: Phaser.GameObjects.Image;
    readonly station: Phaser.GameObjects.Image;
    readonly autoButton: Phaser.GameObjects.Image;
    private readonly board: Phaser.GameObjects.Image;
    private readonly effects: Phaser.GameObjects.Graphics;
    private readonly tools: Phaser.GameObjects.Graphics;
    private readonly progressBar: Phaser.GameObjects.Graphics;
    private readonly agents: Agent[] = [];
    private readonly flames: Phaser.GameObjects.Sprite[] = [];
    private readonly aliens: Phaser.GameObjects.Image[] = [];
    private phase: Phase = 'idle';
    private kind = -1;
    private elapsed = 0;
    private progress = 0;
    private completed = 0;
    private clock = 0;
    private autoEnabled = true;
    private standby = 0;

    constructor(private readonly scene: Phaser.Scene, private readonly available: () => boolean) {
        this.drawArt();
        this.station = scene.add.image(DX - 290, DY + 45, 'incident-station-on').setOrigin(0.5, 1).setDepth(DY + 45);
        this.button = scene.add.image(DX - 205, DY + 95, 'incident-button-ready')
            .setOrigin(0.5, 1).setDepth(DY + 95).setInteractive({ useHandCursor: true }).setName('Chaos / Incident Button');
        this.button.on('pointerdown', () => this.trigger());
        this.board = scene.add.image(DX - 245, DY + 164, 'incident-status-idle').setDepth(DY + 165);
        this.autoButton = scene.add.image(DX - 245, DY + 215, 'incident-auto-on').setDepth(DY + 216)
            .setInteractive({ useHandCursor: true }).setName('Self-Healing Repair Crew: toggle automatic drills');
        this.autoButton.on('pointerdown', () => this.toggleAuto());
        this.parts.push(this.station, this.button, this.board, this.autoButton);
        this.effects = scene.add.graphics().setPosition(DX, DY).setDepth(DY + 46);
        this.tools = scene.add.graphics().setDepth(DY + 130);
        this.progressBar = scene.add.graphics().setPosition(DX, DY).setDepth(DY + 166);

        const fire = flameArt();
        addPixels(scene, 'incident-fire', fire.canvas, fire.frames);
        if (!scene.anims.exists('incident-fire')) {
            scene.anims.create({
                key: 'incident-fire', frames: fire.frames.map(({ name }) => ({ key: 'incident-fire', frame: name })),
                frameRate: 12, repeat: -1,
            });
        }
        for (let i = 0; i < 3; i++) {
            this.flames.push(scene.add.sprite(DX - 307 + i * 17, DY, 'incident-fire')
                .setOrigin(0.5, 1).setScale(2).setDepth(DY + 47).play('incident-fire').setVisible(false));
            this.aliens.push(scene.add.image(DX - 314 + i * 24, DY - 15, 'incident-alien').setDepth(DY + 48).setVisible(false));
        }
        ['WATCH', 'PATCH', 'ROLLBACK'].forEach((name, i) => {
            const key = `incident-agent-${i}`;
            const look = randomLook(key, {
                githubUsername: 'aifateen',
                hairStyle: 'cap', hat: 'red', shirt: 'gold', pants: 'navy',
            });
            const sheet = characterSheet(look);
            addPixels(scene, key, sheet.canvas, sheet.frames);
            const anim = `${key}-walk`;
            if (!scene.anims.exists(anim)) {
                scene.anims.create({
                    key: anim, frames: ['side-1', 'side-0', 'side-2', 'side-0'].map(frame => ({ key, frame })),
                    frameRate: 10, repeat: -1,
                });
            }
            const home = new Phaser.Math.Vector2(DX - 345 + i * 37, DY + 110 + i % 2 * 15);
            const sprite = scene.add.sprite(home.x, home.y, key, 'down-0').setOrigin(0.5, 1).setDepth(home.y);
            addCreatorNametag(sprite, look, { gap: 18 });
            const shadow = scene.add.image(home.x, home.y, shadowTexture(scene, 10)).setAlpha(0.25).setDepth(home.y - 1);
            const labelKey = `incident-agent-label-${i}`;
            this.text(labelKey, [name]);
            const label = scene.add.image(home.x, home.y - 28, labelKey).setDepth(home.y + 1);
            this.agents.push({ sprite, shadow, label, anim, home, work: new Phaser.Math.Vector2(DX - 315 + i * 25, DY + 65) });
            this.parts.push(sprite, label);
        });
    }

    near(x: number, y: number) {
        return Phaser.Math.Distance.Between(x, y, this.button.x, this.button.y) <= 65;
    }

    trigger() {
        if (!this.available() || isTyping() || this.phase !== 'idle') return;
        this.kind = this.kind < 0 ? Phaser.Math.Between(0, INCIDENTS.length - 1)
            : (this.kind + Phaser.Math.Between(1, INCIDENTS.length - 1)) % INCIDENTS.length;
        this.progress = 0;
        this.button.setTexture('incident-button-busy');
        this.station.setTexture(this.kind === 1 ? 'incident-station-off' : 'incident-station-on');
        this.flames.forEach(flame => flame.setVisible(this.kind === 0));
        this.aliens.forEach(alien => alien.setVisible(this.kind === 2));
        this.setPhase('detecting');
    }

    toggleAuto() {
        if (!this.available() || isTyping()) return;
        this.autoEnabled = !this.autoEnabled;
        this.standby = 0;
        this.autoButton.setTexture(`incident-auto-${this.autoEnabled ? 'on' : 'off'}`);
    }

    update(dt: number) {
        dt = Math.min(dt, 0.1);
        this.clock += dt;
        this.elapsed += dt;
        if (this.phase === 'idle' && this.autoEnabled && this.available() && !isTyping()) {
            this.standby += dt;
            if (this.standby >= AUTO_INTERVAL) this.trigger();
        }
        if (this.phase === 'detecting' && this.elapsed >= 1.5) this.setPhase('responding');
        if (this.phase === 'responding') {
            const arrived = this.agents.map(agent => this.move(agent, agent.work, dt));
            if (arrived.every(Boolean)) this.setPhase('resolving');
        } else if (this.phase === 'resolving') {
            this.progress = Math.min(1, this.elapsed / 5);
            if (this.progress >= 1) {
                this.completed++;
                this.flames.forEach(flame => flame.setVisible(false));
                this.aliens.forEach(alien => alien.setVisible(false));
                this.station.setTexture('incident-station-on');
                this.setPhase('resolved');
            }
        } else if (this.phase === 'resolved' && this.elapsed >= 3) {
            this.setPhase('returning');
        } else if (this.phase === 'returning') {
            const arrived = this.agents.map(agent => this.move(agent, agent.home, dt));
            if (arrived.every(Boolean)) {
                this.agents.forEach(agent => agent.sprite.stop().setFrame('down-0').setFlipX(false));
                this.button.setTexture('incident-button-ready');
                this.setPhase('idle');
            }
        }
        this.drawEffects();
    }

    private setPhase(phase: Phase) {
        this.phase = phase;
        this.elapsed = 0;
        this.standby = 0;
        this.board.setTexture(phase === 'idle' ? 'incident-status-idle' : `incident-status-${this.kind}-${phase}`);
    }

    private move(agent: Agent, target: Phaser.Math.Vector2, dt: number) {
        const { sprite, shadow, label } = agent;
        const dx = target.x - sprite.x, dy = target.y - sprite.y;
        const distance = Math.hypot(dx, dy);
        const step = Math.min(distance, 70 * dt);
        if (distance > 0) {
            sprite.x += dx / distance * step;
            sprite.y += dy / distance * step;
            sprite.setFlipX(dx < 0);
        }
        if (distance <= step) sprite.stop().setFrame('up-0').setFlipX(false);
        else if (!sprite.anims.isPlaying) sprite.play(agent.anim);
        sprite.setDepth(sprite.y);
        shadow.setPosition(sprite.x, sprite.y).setDepth(sprite.y - 1);
        label.setPosition(sprite.x, sprite.y - 28).setDepth(sprite.y + 1);
        return distance <= step;
    }

    private drawEffects() {
        const g = this.effects.clear();
        const tools = this.tools.clear();
        const active = ['detecting', 'responding', 'resolving'].includes(this.phase);
        if (active) {
            g.lineStyle(2, Math.sin(this.clock * 8) > 0 ? HEX.red : HEX.gold);
            g.strokeEllipse(-290, 39, 82, 22);
            if (this.kind === 1) {
                g.lineStyle(2, HEX.yellow);
                for (let i = 0; i < 3; i++) {
                    const x = -310 + i * 20;
                    g.lineBetween(x, -10, x + 6, -18 + Math.sin(this.clock * 10 + i) * 4);
                }
            } else if (this.kind === 3) {
                g.lineStyle(2, HEX.red);
                g.lineBetween(-320, 32, -296, 32);
                g.lineBetween(-284, 32, -260, 32);
                g.lineBetween(-295, 26, -285, 38);
                g.lineBetween(-285, 26, -295, 38);
            }
            this.aliens.forEach((alien, i) => { alien.y = DY - 15 + Math.round(Math.sin(this.clock * 4 + i) * 4); });
            if (this.phase === 'resolving') {
                g.lineStyle(2, this.kind === 0 ? HEX.cyan : HEX.lime, 0.8);
                this.agents.forEach((agent, i) => {
                    g.lineBetween(agent.sprite.x - DX, agent.sprite.y - DY - 10, -305 + i * 15, 10 + Math.sin(this.clock * 12 + i) * 7);
                    const angle = -Math.PI / 2 + Math.sin(this.clock * 9 + i) * 0.7;
                    const x = agent.sprite.x + 8, y = agent.sprite.y - 11;
                    const tipX = x + Math.cos(angle) * 11, tipY = y + Math.sin(angle) * 11;
                    tools.lineStyle(2, HEX.steel).lineBetween(x, y, tipX, tipY);
                    tools.lineStyle(2, HEX.cream).strokeCircle(tipX, tipY, 3);
                    if (Math.sin(this.clock * 16 + i) > 0.5) {
                        tools.lineStyle(1, HEX.gold);
                        tools.lineBetween(tipX + 5, tipY - 4, tipX + 8, tipY - 7);
                        tools.lineBetween(tipX - 4, tipY - 5, tipX - 6, tipY - 8);
                    }
                });
            }
        }
        const bar = this.progressBar.clear();
        if (this.phase !== 'idle') {
            bar.fillStyle(HEX.slate).fillRect(-325, 187, 160, 4);
            bar.fillStyle(HEX.lime).fillRect(-325, 187, Math.round(160 * this.progress), 4);
        }
    }

    private text(key: string, lines: string[]) {
        const width = Math.max(...lines.map(miniTextWidth)) + 10;
        const pc = new PixelCanvas(width, lines.length * 9 + 6);
        pc.rect(0, 0, width, pc.height, 'ink');
        lines.forEach((line, i) => miniText(pc, Math.floor((width - miniTextWidth(line)) / 2), 4 + i * 9, line, 'cream'));
        addPixels(this.scene, key, pc);
    }

    private drawArt() {
        for (const busy of [false, true]) {
            const pc = new PixelCanvas(56, 49);
            pc.rect(5, 32, 46, 14, 'slate').rect(8, 34, 40, 3, 'gold');
            for (let x = 9; x < 48; x += 9) pc.rect(x, 34, 4, 3, 'ink');
            pc.ellipse(28, 28, 23, 12, 'ink').ellipse(28, 25, 21, 11, 'wine')
                .ellipse(28, busy ? 25 : 20, 21, 11, busy ? 'wine' : 'red');
            if (!busy) pc.ellipse(22, 16, 9, 3, 'peach');
            miniText(pc, 18, busy ? 23 : 18, '!!!', 'white');
            addPixels(this.scene, `incident-button-${busy ? 'busy' : 'ready'}`, pc);
        }
        for (const on of [false, true]) {
            const pc = new PixelCanvas(62, 65);
            pc.rect(3, 10, 56, 52, 'ink').rect(5, 12, 52, 48, 'steel')
                .rect(6, 3, 50, 9, 'ink');
            miniText(pc, 8, 5, 'PRODUCTION', 'white');
            for (let i = 0; i < 3; i++) {
                pc.rect(10, 17 + i * 13, 42, 11, 'night')
                    .rect(13, 20 + i * 13, 5, 4, on ? 'lime' : 'wine')
                    .rect(23, 20 + i * 13, 25, 2, on ? 'cyan' : 'slate');
            }
            addPixels(this.scene, `incident-station-${on ? 'on' : 'off'}`, pc);
        }
        const alien = new PixelCanvas(22, 22);
        alien.line(6, 6, 3, 1, 'lime').line(16, 6, 19, 1, 'lime')
            .ellipse(11, 10, 9, 7, 'leaf').ellipse(7, 9, 3, 4, 'ink').ellipse(15, 9, 3, 4, 'ink')
            .rect(7, 16, 8, 3, 'violet').rect(4, 19, 5, 2, 'lime').rect(13, 19, 5, 2, 'lime').outline('ink');
        addPixels(this.scene, 'incident-alien', alien);
        for (const enabled of [false, true]) {
            this.text(`incident-auto-${enabled ? 'on' : 'off'}`, [
                'SELF-HEALING REPAIR CREW',
                enabled ? 'AUTO ON - click to pause' : 'AUTO OFF - click to enable',
            ]);
        }
        this.text('incident-status-idle', ['CHAOS / INCIDENT BUTTON', 'Click red button or nearby C', 'On-call agents standing by']);
        INCIDENTS.forEach((incident, i) => {
            const messages: Record<Exclude<Phase, 'idle'>, string> = {
                detecting: 'ALERT! Watch detected trouble',
                responding: 'On-call agents responding',
                resolving: incident.action,
                resolved: 'RESOLVED! Production healthy',
                returning: 'Agents returning to standby',
            };
            for (const [phase, message] of Object.entries(messages)) {
                this.text(`incident-status-${i}-${phase}`, [incident.name, message,
                    phase === 'resolved' ? 'Self-healing complete!' : 'Please wait for recovery']);
            }
        });
    }
}
