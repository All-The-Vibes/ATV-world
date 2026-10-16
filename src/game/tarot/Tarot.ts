import Phaser from 'phaser';
import { PixelCanvas, addPixels, randomLook, shadowTexture } from '../kit';
import { panelArt, tarotTextures, visitorTextures } from './art';
import { drawThree, resolveReading, type Outcome, type Spread } from './deck';

type State = 'waiting' | 'approaching' | 'revealing' | 'interpreting' | 'transforming' | 'departing';

/**
 * Click once to invite a visitor; the six-state reading then runs entirely on scene time.
 * Owns its visitor so world walkers, dragon targets, and kitten distractions remain unchanged.
 */
export class Tarot {
    readonly parts: { getBounds: () => Phaser.Geom.Rectangle }[] = [];
    readonly area: Phaser.Geom.Rectangle;
    private state: State = 'waiting';
    private elapsed = 0;
    private revealed = 0;
    private spread?: Spread;
    private outcome?: Outcome;
    private visitorNumber = 0;
    private readonly feet = new Phaser.Math.Vector2();
    private readonly table: Phaser.GameObjects.Image;
    private readonly visitor: Phaser.GameObjects.Sprite;
    private readonly shadow: Phaser.GameObjects.Image;
    private readonly cards: Phaser.GameObjects.Image[];
    private readonly panel: Phaser.GameObjects.Image;
    private readonly glow: Phaser.GameObjects.Image;
    private readonly sparks: Phaser.GameObjects.Image[];
    private readonly panelKey: string;

    constructor(private readonly scene: Phaser.Scene, private readonly x: number, private readonly y: number) {
        tarotTextures(scene);
        // A bounded texture pool keeps each visitor's hair/clothes across forms without leaking textures.
        for (let i = 0; i < 6; i++) visitorTextures(scene, i, randomLook(`tarot-visitor-${i}`));
        this.area = new Phaser.Geom.Rectangle(x - 155, y - 125, 310, 225);
        this.parts.push({ getBounds: () => this.area });
        const rug = new PixelCanvas(270, 130);
        rug.rect(0, 0, 270, 130, 'plum').rect(3, 3, 264, 124, 'gold')
            .rect(5, 5, 260, 120, 'violet').rect(10, 10, 250, 110, 'plum');
        for (let i = 15; i < 260; i += 16) rug.set(i, 12, 'gold').set(i, 117, 'gold');
        this.parts.push(scene.add.image(x, y + 20, addPixels(scene, 'tarot-rug', rug)).setDepth(-1e8));
        this.table = scene.add.image(x, y + 18, 'tarot-table').setOrigin(0.5, 1).setDepth(y + 18)
            .setInteractive({ useHandCursor: true });
        this.table.on('pointerup', (pointer: Phaser.Input.Pointer) => {
            if (pointer.getDistance() >= 6) return;
            this.start();
        });
        this.parts.push(this.table);
        this.cards = [-73, 0, 73].map((dx) => scene.add.image(x + dx, y - 2, 'tarot-back')
            .setOrigin(0.5, 1).setDepth(y + 19));
        this.parts.push(...this.cards);
        this.panelKey = `tarot-panel-${x}-${y}`;
        this.panel = scene.add.image(x, y - 103, addPixels(scene, this.panelKey,
            panelArt(['THE TAROT READER', 'CLICK FOR A READING'])))
            .setDepth(y + 150);
        this.parts.push(this.panel);
        const glow = new PixelCanvas(52, 52);
        glow.ellipse(26, 26, 25, 25, 'white').ellipse(26, 26, 18, 18, 'yellow');
        this.glow = scene.add.image(x, y + 14, addPixels(scene, 'tarot-transform', glow))
            .setDepth(y + 100).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
        const spark = new PixelCanvas(7, 7);
        spark.line(0, 3, 6, 3, 'gold').line(3, 0, 3, 6, 'white');
        addPixels(scene, 'tarot-spark', spark);
        this.sparks = Array.from({ length: 12 }, () => scene.add.image(x, y, 'tarot-spark')
            .setDepth(y + 101).setVisible(false));
        this.visitor = scene.add.sprite(x - 135, y + 70, 'tarot-visitor-0', 'side-0')
            .setOrigin(0.5, 1).setVisible(false);
        this.shadow = scene.add.image(x - 135, y + 70, shadowTexture(scene, 14)).setAlpha(0.3).setVisible(false);
    }

    start(): boolean {
        if (this.state !== 'waiting') return false;
        this.visitorNumber = (this.visitorNumber + 1) % 6;
        this.feet.set(this.x - 135, this.y + 70);
        this.visitor.stop();
        this.visitor.setTexture(`tarot-visitor-${this.visitorNumber}`, 'side-0')
            .setFlipX(false).setAngle(0).setAlpha(1).setVisible(true);
        this.shadow.setVisible(true).setAlpha(0.3);
        this.cards.forEach((card) => card.setTexture('tarot-back'));
        this.spread = drawThree();
        this.outcome = undefined;
        this.revealed = 0;
        this.setState('approaching');
        this.table.setAlpha(1);
        this.say(['THE TAROT READER', 'A VISITOR SEEKS THEIR FATE']);
        this.positionCompanions();
        return true;
    }

    update(dt: number) {
        dt = Math.min(dt, 0.1);
        this.elapsed += dt;
        switch (this.state) {
            case 'waiting':
                this.table.setAlpha(0.88 + Math.sin(this.elapsed * 3) * 0.12);
                break;
            case 'approaching':
                if (this.walkTo(this.x, this.y + 52, 37, dt)) {
                    this.visitor.setFrame('up-0');
                    this.setState('revealing');
                    this.say(['THE TAROT READER', 'THREE CARDS. ONE NEW FATE.']);
                }
                break;
            case 'revealing':
                if (this.elapsed >= 1.8) this.reveal();
                break;
            case 'interpreting':
                if (this.elapsed >= 5 && this.spread) {
                    this.outcome = resolveReading(this.spread);
                    this.setState('transforming');
                    this.say(['THE CARDS HAVE SPOKEN', this.outcome === 'angel'
                        ? 'A BRIGHT FATE: BECOME AN ANGEL!' : 'A DARK FATE: BECOME A ZOMBIE!']);
                    this.glow.setVisible(true).setTint(this.outcome === 'angel' ? 0xffdf72 : 0x85bf55);
                }
                break;
            case 'transforming':
                this.glow.setScale(0.4 + Math.sin(this.elapsed * Math.PI / 2.4) * 1.5);
                this.glow.setAlpha(0.8 * Math.sin(Math.min(1, this.elapsed / 2.4) * Math.PI));
                this.sparks.forEach((spark, i) => {
                    const angle = i * Math.PI / 6 + this.elapsed * 2;
                    const radius = 12 + this.elapsed * 16;
                    spark.setVisible(true).setTint(this.outcome === 'angel' ? 0xffdf72 : 0x85bf55)
                        .setPosition(this.feet.x + Math.cos(angle) * radius, this.feet.y - 24 + Math.sin(angle) * radius)
                        .setAlpha(Math.sin(Math.min(1, this.elapsed / 2.4) * Math.PI));
                });
                if (this.elapsed >= 1 && this.outcome && this.visitor.texture.key.startsWith('tarot-visitor-')) {
                    this.visitor.setTexture(`tarot-${this.outcome}-${this.visitorNumber}`, 0);
                }
                if (this.elapsed >= 2.4 && this.outcome) {
                    this.glow.setVisible(false);
                    this.sparks.forEach((spark) => spark.setVisible(false));
                    this.visitor.play(`tarot-${this.outcome}-${this.visitorNumber}-walk`);
                    this.setState('departing');
                }
                break;
            case 'departing':
                this.visitor.setAngle(this.outcome === 'zombie' ? Math.sin(this.elapsed * 7) * 7 : 0);
                if (this.walkTo(this.x + 135, this.y + 70, this.outcome === 'zombie'
                    ? 14 + 11 * Math.max(0, Math.sin(this.elapsed * 7)) : 43, dt)) {
                    this.visitor.stop().setVisible(false).setAngle(0);
                    this.shadow.setVisible(false);
                    this.setState('waiting');
                    this.say(['THE TAROT READER', 'CLICK FOR A READING']);
                }
                break;
        }
        this.positionCompanions();
    }

    private reveal() {
        if (this.state !== 'revealing' || !this.spread) return;
        const card = this.spread[this.revealed];
        this.cards[this.revealed].setTexture(`tarot-card-${card.symbol}`);
        this.revealed++;
        this.elapsed = 0;
        if (this.revealed === 3) {
            this.setState('interpreting');
            this.say(['YOUR THREE-CARD READING', ...this.spread.map((item) => `${item.name}: ${item.reading}`)]);
        } else {
            this.say([`CARD ${this.revealed} OF 3: ${card.name}`, card.reading]);
        }
    }

    private setState(state: State) {
        this.state = state;
        this.elapsed = 0;
    }

    private say(lines: string[]) {
        addPixels(this.scene, this.panelKey, panelArt(lines), [], true);
        this.panel.setTexture(this.panelKey);
    }

    private walkTo(x: number, y: number, speed: number, dt: number): boolean {
        const dx = x - this.feet.x, dy = y - this.feet.y;
        const distance = Math.hypot(dx, dy);
        const step = Math.min(distance, speed * dt);
        if (distance > 0) {
            this.feet.x += dx / distance * step;
            this.feet.y += dy / distance * step;
        }
        if (this.state === 'approaching') {
            const frame = [1, 0, 2, 0][Math.floor(this.elapsed * 8) % 4];
            this.visitor.setFrame(`side-${frame}`);
        }
        return distance <= step;
    }

    private positionCompanions() {
        const bounce = this.state === 'departing' && this.outcome === 'angel' ? 2 + Math.sin(this.elapsed * 10) * 2 : 0;
        this.visitor.setPosition(this.feet.x, this.feet.y - bounce).setDepth(this.feet.y);
        this.shadow.setPosition(this.feet.x, this.feet.y).setDepth(this.feet.y - 1);
        this.glow.setPosition(this.feet.x, this.feet.y - 18);
    }
}
