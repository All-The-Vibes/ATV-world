import Phaser from 'phaser';
import {
    PixelCanvas, addCreatorNametag, addPixels, characterSheet, ensurePixels, miniText, miniTextWidth, randomLook, shadowTexture, speechArt,
    stripFrames,
    type Accessory,
} from '../kit';

/** Mark B: orange hair, a jetpack, and a slow lap of the whole map, stopping to say something nerdy about AI. */
const LOOK = randomLook('mark-b', {
    githubUsername: 'markbriggs-ms',
    skin: 'peach', hair: 'orange', hairStyle: 'short', shirt: 'forest', pants: 'navy', shoes: 'white',
});

const QUOTES = [
    'BACKPROPAGATION: BLAMING EVERY LAYER, ONE AT A TIME.',
    'MY CONTEXT WINDOW IS HUGE. YOURS IS A POST-IT.',
    'I FINE-TUNED A MODEL TO FINE-TUNE MODELS.',
    'GRADIENT DESCENT IS JUST HIKING IN REVERSE.',
    'TEMPERATURE 0 MEANS NO FUN.',
    'RAG IS A LIBRARY CARD FOR AI.',
    'TOKENS IN, VIBES OUT.',
    'IT IS NOT A BUG, IT IS A HALLUCINATION.',
    'MY AGENT HAS AN AGENT.',
    'LGTM. THE MODEL SAID SO.',
    'EMBEDDINGS ARE JUST VIBES WITH COORDINATES.',
    'I PROMPT, THEREFORE I AM.',
];

/** Where the action is: the plaza, ATV HQ and the shops around it (world pixels). */
const MIDDLE = { x: 0, y: 125 };
/** Stops near the middle, as offsets from it, so he is almost always on screen. */
const NEAR: [number, number][] = [
    [-260, -120], [-60, -150], [200, -120], [300, 20], [220, 140], [0, 170], [-220, 120], [-320, 0],
];
/** Now and then he swings out to the corners of the map (fractions of the world bounds). */
const FAR: [number, number][] = [[0.08, 0.14], [0.92, 0.14], [0.92, 0.86], [0.08, 0.86]];

interface Stop { x: number; y: number; far: boolean }
const SCARED = [
    'I AM SCARED OF HEIGHTS.',
    'HOW DO I GET DOWN?',
    'DO NOT LOOK DOWN. DO NOT LOOK DOWN.',
    'WHY DID I PUT ON A JETPACK?',
    'THIS WAS A BAD IDEA.',
    'HELLO? CAN SOMEONE PUT ME DOWN?',
];

/** Every fourth stop he remembers how high up he is. */
const SCARED_EVERY = 4;

/** Two stops near the middle, then one far away, round and round. */
const STOPS: Stop[] = NEAR.map(([x, y], i): Stop[] =>
    i % 2 === 1 ? [{ x, y, far: false }, { x: FAR[(i - 1) / 2][0], y: FAR[(i - 1) / 2][1], far: true }] : [{ x, y, far: false }],
).flat();

const ALTITUDE = 50;
const SPEED = 70;
/** Mark is drawn at character size, then blown up so he reads from the fit view. */
const SIZE = 4;
const TALK = 3.6;
const EMOJI = 3;
const FADE = 0.6;

/** The pack sits on his back; frame rows start one pixel down (the body's top row is y=1). */
const jetpack: Accessory = (pc, ox, facing) => {
    const p = (x: number, y: number, c: Parameters<PixelCanvas['set']>[2]) => pc.set(ox + x, y + 1, c);
    const tank = (x: number) => {
        for (let y = 12; y <= 17; y++) { p(x, y, 'cloud'); p(x + 1, y, 'mist'); }
        p(x, 12, 'red'); p(x + 1, 12, 'red');
        p(x, 18, 'slate'); p(x + 1, 18, 'slate');
        p(x, 14, 'white');
    };
    if (facing === 'side') {
        tank(2); p(4, 13, 'slate'); p(4, 14, 'slate'); p(5, 13, 'slate');
    } else if (facing === 'up') {
        tank(4); tank(10); pc.rect(ox + 6, 15, 4, 2, 'steel');
    } else {
        p(4, 13, 'slate'); p(11, 13, 'slate'); p(3, 14, 'cloud'); p(12, 14, 'cloud');
    }
};

function smileyArt(): PixelCanvas {
    const pc = new PixelCanvas(13, 13);
    pc.ellipse(6, 6, 6, 6, 'ink').ellipse(6, 6, 5, 5, 'yellow');
    pc.rect(4, 4, 1, 2, 'ink').rect(8, 4, 1, 2, 'ink');
    pc.set(3, 7, 'ink').set(9, 7, 'ink').rect(4, 8, 5, 1, 'ink').rect(5, 9, 3, 1, 'ink');
    return pc;
}

/** Wide eyes, a wobbly mouth and a cold sweat. */
function scaredArt(): PixelCanvas {
    const pc = new PixelCanvas(13, 13);
    pc.ellipse(6, 6, 6, 6, 'ink').ellipse(6, 6, 5, 5, 'yellow');
    pc.rect(3, 3, 3, 3, 'white').rect(7, 3, 3, 3, 'white').set(4, 4, 'ink').set(8, 4, 'ink');
    pc.set(4, 9, 'ink').set(5, 8, 'ink').set(6, 9, 'ink').set(7, 8, 'ink').set(8, 9, 'ink');
    pc.rect(11, 2, 1, 2, 'cyan').set(11, 4, 'sky');
    return pc;
}

function flameArt() {
    const canvas = new PixelCanvas(10, 9);
    [7, 9].forEach((h, f) => {
        const x = f * 5;
        canvas.rect(x + 1, 0, 3, h - 3, 'orange').rect(x + 2, h - 3, 1, 2, 'orange').rect(x + 2, h - 1, 1, 1, 'red');
        canvas.rect(x + 2, 0, 1, h - 4, 'yellow').rect(x + 1, 0, 3, 2, 'yellow');
    });
    return { canvas, frames: stripFrames(2, 5, 9) };
}

export class MarkB {
    private readonly sprite: Phaser.GameObjects.Sprite;
    private readonly flame: Phaser.GameObjects.Sprite;
    private readonly shadow: Phaser.GameObjects.Image;
    private readonly name: Phaser.GameObjects.Image;
    private readonly bubble: Phaser.GameObjects.Image;
    private mode: 'fly' | 'talk' | 'emoji' = 'fly';
    private stop = 1;
    private timer = 0;
    private clock = 0;
    private quote = 0;
    private scaredQuote = 0;
    private visits = 0;
    private scared = false;
    private x: number;
    private y: number;

    constructor(scene: Phaser.Scene, private readonly bounds: () => Phaser.Geom.Rectangle) {
        ensurePixels(scene, 'mark-b', () => characterSheet(LOOK, jetpack));
        ensurePixels(scene, 'mark-b-flame', flameArt);
        ensurePixels(scene, 'mark-b-smile', smileyArt);
        ensurePixels(scene, 'mark-b-scared', scaredArt);
        QUOTES.forEach((quote, i) => addPixels(scene, `mark-b-quote-${i}`, speechArt(quote, 22)));
        SCARED.forEach((quote, i) => addPixels(scene, `mark-b-scared-${i}`, speechArt(quote, 22)));

        const label = new PixelCanvas(miniTextWidth('MARK B') + 6, 9);
        label.rect(0, 0, label.width, 9, 'ink');
        miniText(label, 3, 2, 'MARK B', 'cream');
        addPixels(scene, 'mark-b-label', label);

        const start = this.stopPoint(0);
        this.x = start.x;
        this.y = start.y;
        this.shadow = scene.add.image(0, 0, shadowTexture(scene, 12)).setAlpha(0.25).setDepth(-1e8).setScale(SIZE);
        this.flame = scene.add.sprite(0, 0, 'mark-b-flame', 0).setOrigin(0.5, 0).setDepth(1e6 + 2);
        this.sprite = scene.add.sprite(0, 0, 'mark-b', 'side-0').setName('Mark B').setOrigin(0.5, 1).setDepth(1e6 + 3).setScale(SIZE);
        this.name = scene.add.image(0, 0, 'mark-b-label').setOrigin(0.5, 1).setDepth(1e6 + 4);
        this.bubble = scene.add.image(0, 0, 'mark-b-smile').setOrigin(0.5, 1).setDepth(1e6 + 5).setVisible(false);
        addCreatorNametag(this.sprite, LOOK, { gap: 14, speech: () => this.bubble });
        this.update(0);
        scene.events.once('shutdown', () => this.destroy());
    }

    private stopPoint(i: number) {
        const stop = STOPS[i];
        if (!stop.far) return { x: MIDDLE.x + stop.x, y: MIDDLE.y + stop.y };
        const b = this.bounds();
        return { x: Math.round(b.left + b.width * stop.x), y: Math.round(b.top + b.height * stop.y) };
    }

    update(dt: number) {
        dt = Math.min(dt, 0.1);
        this.clock += dt;
        const target = this.stopPoint(this.stop);

        if (this.mode === 'fly') {
            const dx = target.x - this.x, dy = target.y - this.y;
            const dist = Math.hypot(dx, dy), step = SPEED * dt;
            if (Math.abs(dx) > 0.5) this.sprite.setFlipX(dx < 0);
            if (dist <= step) {
                this.x = target.x;
                this.y = target.y;
                this.mode = 'talk';
                this.timer = 0;
                this.visits++;
                this.scared = this.visits % SCARED_EVERY === 0;
                this.bubble.setTexture(this.scared ? `mark-b-scared-${this.scaredQuote}` : `mark-b-quote-${this.quote}`);
            } else {
                this.x += (dx / dist) * step;
                this.y += (dy / dist) * step;
            }
        } else {
            this.timer += dt;
            if (this.mode === 'talk' && this.timer >= TALK) {
                this.mode = 'emoji';
                this.timer = 0;
                this.bubble.setTexture(this.scared ? 'mark-b-scared' : 'mark-b-smile');
            } else if (this.mode === 'emoji' && this.timer >= EMOJI) {
                this.mode = 'fly';
                if (this.scared) this.scaredQuote = (this.scaredQuote + 1) % SCARED.length;
                else this.quote = (this.quote + 1) % QUOTES.length;
                this.scared = false;
                this.stop = (this.stop + 1) % STOPS.length;
                this.bubble.setVisible(false);
            }
        }

        const hovering = this.mode !== 'fly';
        const bob = Math.sin(this.clock * (hovering ? 3 : 6)) * (hovering ? 2.5 : 1);
        const shake = this.scared && hovering ? Math.round(Math.sin(this.clock * 40) * 2) : 0;
        const gx = Math.round(this.x) + shake, top = Math.round(this.y - ALTITUDE + bob);
        const side = this.sprite.flipX ? 1 : -1;
        this.sprite.setPosition(gx, top);
        this.flame.setPosition(gx + 5 * SIZE * side, top - 3 * SIZE).setFrame(Math.floor(this.clock * 14) % 2).setScale(SIZE, SIZE * (hovering ? 0.7 : 1));
        this.shadow.setPosition(gx, Math.round(this.y));
        this.name.setPosition(gx, top - this.sprite.displayHeight - 2);

        if (hovering) {
            const emoji = this.mode === 'emoji';
            const alpha = emoji ? Phaser.Math.Clamp((EMOJI - this.timer) / FADE, 0, 1) : 1;
            const scale = emoji ? 3 + Math.max(0, 0.3 - this.timer) : 1.5;
            this.bubble.setVisible(true).setAlpha(alpha).setScale(scale).setPosition(gx, top - this.sprite.displayHeight - 12);
        }
    }

    destroy() {
        [this.sprite, this.flame, this.shadow, this.name, this.bubble].forEach((o) => o.destroy());
    }
}
