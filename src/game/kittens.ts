import Phaser from 'phaser';
import { addCreatorNametag, addPixels, characterSheet, randomLook, shadowTexture, speechArt } from './kit';
import { corralSignArt, fenceArt, kittenArt, TOY_KINDS, toyArt, type ToyKind } from './kit/kittens';
import type { Color } from './kit/palette';
import { sp } from './spread';

interface Point { x: number; y: number }
type Mood = 'toy' | 'play' | 'escape' | 'wander' | 'coin' | 'dragon' | 'carried' | 'chat';

interface Person {
    sprite: Phaser.GameObjects.Sprite;
    shadow: Phaser.GameObjects.Image;
    label?: Phaser.GameObjects.Image;
    nametag?: Phaser.GameObjects.Text;
    anim: string;
    hold: (seconds: number) => void;
}

interface Visitor {
    person: Person;
    homeY: number;
    bubble: Phaser.GameObjects.Image;
    cat?: Kitten;
    stage: 'idle' | 'approach' | 'talk' | 'return';
    timer: number;
    line: number;
}

interface Kitten extends Point {
    hunter: boolean;
    sprite: Phaser.GameObjects.Sprite;
    shadow: Phaser.GameObjects.Image;
    bubble: Phaser.GameObjects.Image;
    mood: Mood;
    target: Point;
    toy: number;
    timer: number;
    cooldown: number;
    jump: number;
    talk: number;
    phase: number;
    joke: number;
    jokeAt: number;
}

interface Options {
    bounds: () => Phaser.Geom.Rectangle;
    include: (object: { getBounds(): Phaser.Geom.Rectangle }) => void;
    open: (x: number, y: number) => boolean;
    coins: () => readonly Point[];
    dragon: () => Point | undefined;
    people: readonly Person[];
    disco: (x: number, y: number) => boolean;
}

/** The corral was laid out around (-215, 370); it moves as a block with the plaza's spread. */
const DX = sp(-215) + 215, DY = sp(370) - 370;

const DISCO_JOKES = [
    'DISCO INFERNO? WHO INVITED THE DRAGON?',
    'THE PM SAID DO THE HUSTLE. I TOOK A NAP.',
    "THESE AREN'T BELL-BOTTOMS. I'M JUST VERY FLUFFY.",
    "STAYIN' ALIVE IS EASIER WITH NINE LIVES.",
    'THAT MIRROR BALL OWES ME A LASER DOT.',
    'I CAME FOR THE FUNK. I STAYED FOR THE CARDBOARD BOX.',
];

/** A playground full of short attention spans, and one PM who really did not sign up for this. */
export class Kittens {
    readonly bounds = new Phaser.Geom.Rectangle(-365 + DX, 285 + DY, 300, 170);
    private readonly meadow = new Phaser.Geom.Rectangle(-411 + DX, 239 + DY, 392, 262);
    private readonly cats: Kitten[] = [];
    private readonly toys: { sprite: Phaser.GameObjects.Image; x: number; y: number; kind: ToyKind }[] = [];
    private readonly manager: Phaser.GameObjects.Sprite;
    private readonly managerNametag?: Phaser.GameObjects.Text;
    private readonly managerShadow: Phaser.GameObjects.Image;
    private readonly managerBubble: Phaser.GameObjects.Image;
    private readonly label: Phaser.GameObjects.Text;
    private readonly status: Phaser.GameObjects.Text;
    private readonly visitors: Visitor[] = [];
    private quarry?: Kitten;
    private carried?: Kitten;
    private attempt = 0;
    private catches = 0;
    private misses = 0;
    private managerRest = 0;
    private managerTalk = 0;
    private clock = 0;
    private readonly detours = new WeakMap<Point, { x: number; y: number; until: number }>();

    constructor(private readonly scene: Phaser.Scene, private readonly opts: Options) {
        const b = this.bounds;
        scene.add.rectangle(b.centerX, b.centerY, b.width, b.height, 0xb4e05a, 0.45).setDepth(-1e8 - 3);
        const back = addPixels(scene, 'kittens-fence-back', fenceArt(b.width));
        const side = addPixels(scene, 'kittens-fence-side', fenceArt(18));
        scene.add.image(b.centerX, b.top, back).setOrigin(0.5, 1).setDepth(b.top);
        // Three kitten-sized gaps: both sides and the front. People can use the front too.
        for (const x of [b.left, b.right]) {
            for (let y = b.top + 18; y <= b.bottom; y += 16) {
                if (Math.abs(y - b.centerY) < 18) continue;
                scene.add.image(x, y, side).setOrigin(0.5, 1).setDepth(y);
            }
        }
        const front = addPixels(scene, 'kittens-fence-front', fenceArt(128));
        for (const x of [b.left + 64, b.right - 64]) {
            scene.add.image(x, b.bottom, front).setOrigin(0.5, 1).setDepth(b.bottom);
        }
        const sign = scene.add.image(b.centerX, b.top - 18, addPixels(scene, 'kittens-sign', corralSignArt())).setDepth(b.top + 1);
        opts.include(sign);
        opts.include({ getBounds: () => this.meadow });

        const colors: Color[] = ['pink', 'sky', 'gold', 'violet'];
        for (let i = 0; i < 24; i++) {
            const kind = TOY_KINDS[i % TOY_KINDS.length];
            const x = b.left + 30 + i % 8 * 34;
            const y = b.top + 40 + Math.floor(i / 8) * 46;
            const key = addPixels(scene, `kittens-toy-${i}`, toyArt(kind, colors[i % colors.length]));
            const sprite = scene.add.image(x, y, key).setOrigin(0.5, 1).setDepth(y);
            this.toys.push({ sprite, x, y, kind });
        }

        const coats: [Color, Color][] = [
            ['orange', 'cream'], ['cloud', 'steel'], ['white', 'orange'], ['night', 'cloud'],
            ['sand', 'wood'], ['white', 'night'], ['wood', 'cream'], ['slate', 'white'],
        ];
        coats.forEach(([coat, patches], i) => {
            const toy = i * 3;
            const at = this.toys[toy];
            const key = addPixels(scene, `kitten-${i}`, kittenArt(coat, patches));
            const sprite = scene.add.sprite(at.x - 9, at.y + 6, key).setOrigin(0.5, 1).setDepth(at.y);
            const shadow = scene.add.image(sprite.x, sprite.y, shadowTexture(scene, 14)).setDepth(-1e6).setAlpha(0.22);
            const bubble = scene.add.image(0, 0, this.bubble('TOYS!')).setOrigin(0.5, 1).setVisible(false);
            addCreatorNametag(sprite, { githubUsername: 'DeaderestPool' }, { speech: () => bubble });
            this.cats.push({
                x: sprite.x, y: sprite.y, hunter: i < 2, sprite, shadow, bubble, mood: 'play', target: at,
                toy, timer: 2 + i * 0.65, cooldown: 0, jump: 0, talk: 0, phase: i * 1.7,
                joke: i % DISCO_JOKES.length, jokeAt: 5 + i * 1.2,
            });
        });

        // Creator verified at introduction, commit bee1685.
        const look = randomLook('kitten-project-manager', { githubUsername: 'DeaderestPool', shirt: 'pink', pants: 'navy', hair: 'wood', hairStyle: 'short' });
        const sheet = characterSheet(look);
        addPixels(scene, 'kitten-pm', sheet.canvas, sheet.frames);
        if (!scene.anims.exists('kitten-pm-walk')) {
            scene.anims.create({
                key: 'kitten-pm-walk',
                frames: ['side-1', 'side-0', 'side-2', 'side-0'].map((frame) => ({ key: 'kitten-pm', frame })),
                frameRate: 10, repeat: -1,
            });
        }
        this.manager = scene.add.sprite(b.centerX, b.bottom + 18, 'kitten-pm', 'side-0').setOrigin(0.5, 1);
        this.managerNametag = addCreatorNametag(this.manager, look, { gap: 30 });
        this.managerShadow = scene.add.image(this.manager.x, this.manager.y, shadowTexture(scene, 12)).setAlpha(0.3);
        this.managerBubble = scene.add.image(0, 0, this.bubble('HERDING CATS')).setOrigin(0.5, 1).setVisible(false);
        this.label = scene.add.text(0, 0, 'PROJECT MANAGER', {
            fontFamily: 'VT323, monospace', fontSize: '12px', color: '#f6e6b8',
            backgroundColor: '#4a2a6b', padding: { x: 3, y: 1 },
        }).setOrigin(0.5, 1);
        this.status = scene.add.text(b.centerX, b.bottom + 39, '', {
            fontFamily: 'VT323, monospace', fontSize: '13px', color: '#f6e6b8',
            backgroundColor: '#2a2445', padding: { x: 4, y: 2 },
        }).setOrigin(0.5, 0);
        opts.people.forEach((person, i) => {
            this.visitors.push({
                person, homeY: person.sprite.y, stage: 'idle', timer: 4 + i * 2, line: -1,
                bubble: scene.add.image(0, 0, this.bubble('MEOW?')).setOrigin(0.5, 1).setVisible(false),
            });
        });
    }

    private bubble(text: string) {
        return addPixels(this.scene, `kittens-say-${text}`, speechArt(text, 18));
    }

    private say(cat: Kitten, text: string) {
        cat.bubble.setTexture(this.bubble(text)).setVisible(true);
        cat.talk = 1.6;
    }

    private pmSays(text: string) {
        this.managerBubble.setTexture(this.bubble(text)).setVisible(true);
        this.managerTalk = 2;
    }

    private exit(cat: Kitten) {
        const b = this.bounds;
        const gaps = [
            { x: b.left - 16, y: b.centerY + 3 },
            { x: b.right + 16, y: b.centerY + 3 },
            { x: b.centerX, y: b.bottom + 18 },
        ];
        cat.mood = 'escape';
        cat.target = gaps.reduce((near, gap) => this.distance(cat, gap) < this.distance(cat, near) ? gap : near);
    }

    private distance(a: Point, b: Point) {
        return Math.hypot(a.x - b.x, a.y - b.y);
    }

    private stroll(cat: Kitten) {
        cat.mood = 'wander';
        cat.timer = cat.hunter ? 45 + Math.random() * 20 : 6 + Math.random() * 5;
        cat.target = this.wanderPoint(cat);
    }

    private wanderPoint(cat: Kitten): Point {
        const area = cat.hunter ? this.opts.bounds() : this.meadow;
        for (let i = 0; i < 12; i++) {
            const angle = Math.random() * Math.PI * 2;
            const reach = cat.hunter ? Phaser.Math.FloatBetween(240, 420) : Phaser.Math.FloatBetween(25, 65);
            const x = Phaser.Math.Clamp(cat.x + Math.cos(angle) * reach, area.left + 18, area.right - 18);
            const y = Phaser.Math.Clamp(cat.y + Math.sin(angle) * reach, area.top + 18, area.bottom - 18);
            if (!this.bounds.contains(x, y) && this.opts.open(x, y)) return { x, y };
        }
        return { x: this.bounds.centerX, y: this.bounds.bottom + 24 };
    }

    private newToy(cat: Kitten) {
        cat.toy = (cat.toy + 1 + Math.floor(Math.random() * (this.toys.length - 1))) % this.toys.length;
        cat.target = this.toys[cat.toy];
        cat.mood = 'toy';
        cat.timer = 8;
    }

    private move(who: Point, to: Point, speed: number, dt: number) {
        const d = this.distance(who, to);
        if (d < 1) return true;
        const step = Math.min(d, speed * dt);
        const dx = (to.x - who.x) / d;
        const dy = (to.y - who.y) / d;
        const detour = this.detours.get(who);
        const directions = detour && detour.until > this.clock
            ? [detour, { x: dx, y: dy }, { x: -detour.x, y: -detour.y }]
            : [{ x: dx, y: dy }, { x: -dy, y: dx }, { x: dy, y: -dx }];
        for (const direction of directions) {
            const x = who.x + direction.x * step;
            const y = who.y + direction.y * step;
            if (!this.opts.bounds().contains(x, y) || !this.opts.open(x, y)) continue;
            who.x = x;
            who.y = y;
            if (direction.x !== dx || direction.y !== dy) {
                if (direction !== detour) this.detours.set(who, { ...direction, until: this.clock + 2 });
            } else this.detours.delete(who);
            break;
        }
        return this.distance(who, to) < 1;
    }

    update(dt: number) {
        dt = Math.min(Math.max(dt, 0), 0.1);
        this.clock += dt;
        const dragon = this.opts.dragon();
        const coins = this.opts.coins();
        for (const cat of this.cats) {
            cat.timer -= dt;
            cat.cooldown -= dt;
            cat.jump = Math.max(0, cat.jump - dt);
            cat.talk -= dt;
            if (cat.mood === 'carried') continue;

            if (cat.cooldown <= 0 && !['escape', 'dragon', 'coin', 'chat'].includes(cat.mood)) {
                const area = cat.hunter ? this.opts.bounds() : this.meadow;
                if (dragon && area.contains(dragon.x, dragon.y) && this.distance(cat, dragon) < (cat.hunter ? 420 : 125)) {
                    if (this.bounds.contains(cat.x, cat.y) && !this.bounds.contains(dragon.x, dragon.y)) {
                        this.exit(cat);
                    } else {
                        cat.mood = 'dragon';
                        cat.timer = cat.hunter ? 30 : 4;
                    }
                    this.say(cat, cat.hunter ? 'DRAGON HUNT! MEOW!' : 'BIG FLYING TOY!');
                } else {
                    const coin = coins.find((c) => this.meadow.contains(c.x, c.y) && this.distance(cat, c) < 76);
                    if (coin) {
                        if (this.bounds.contains(cat.x, cat.y) && !this.bounds.contains(coin.x, coin.y)) this.exit(cat);
                        else {
                            cat.mood = 'coin';
                            cat.target = { ...coin };
                            cat.timer = 3;
                        }
                        this.say(cat, 'SHINY!');
                    }
                }
            }

            switch (cat.mood) {
                case 'chat':
                    break;
                case 'toy':
                    if (this.move(cat, cat.target, 36, dt)) {
                        cat.mood = 'play';
                        cat.timer = 3 + Math.random() * 4;
                        this.say(cat, 'MINE!');
                    } else if (cat.timer <= 0) this.exit(cat);
                    break;
                case 'play':
                    if (cat.timer <= 0) {
                        this.say(cat, 'BORED. BYE!');
                        this.exit(cat);
                    }
                    break;
                case 'escape':
                    if (this.move(cat, cat.target, 58, dt)) {
                        this.stroll(cat);
                        this.say(cat, 'FREEDOM!');
                    }
                    break;
                case 'wander':
                    if (cat.timer <= 0) this.newToy(cat);
                    else if (this.move(cat, cat.target, cat.hunter ? 74 : 27, dt)) cat.target = this.wanderPoint(cat);
                    break;
                case 'coin':
                case 'dragon': {
                    const target = cat.mood === 'dragon' ? dragon : coins.find((c) => this.distance(c, cat.target) < 1);
                    const area = cat.hunter && cat.mood === 'dragon' ? this.opts.bounds() : this.meadow;
                    if (!target || !area.contains(target.x, target.y) || cat.timer <= 0) {
                        cat.cooldown = 5;
                        this.stroll(cat);
                        break;
                    }
                    const near = this.distance(cat, target);
                    this.move(cat, target, cat.mood === 'dragon' ? (cat.hunter ? 98 : 76) : 48, dt);
                    if (near < 30 && cat.jump <= 0) cat.jump = 0.65;
                    break;
                }
            }
            if (cat.mood !== 'chat' && cat.talk <= 0 && this.clock >= cat.jokeAt && this.opts.disco(cat.x, cat.y)) {
                this.say(cat, DISCO_JOKES[cat.joke++ % DISCO_JOKES.length]);
                cat.jokeAt = this.clock + 9;
            }
        }
        this.updateVisitors(dt);
        this.updateManager(dt);
        for (const cat of this.cats) this.drawCat(cat);
        for (let i = 0; i < this.toys.length; i++) {
            const toy = this.toys[i];
            const playing = this.cats.some((cat) => cat.toy === i && cat.mood === 'play');
            toy.sprite.setAngle(playing ? Math.sin(this.clock * 12 + i) * 9 : 0);
        }
        const outside = this.cats.filter((cat) => cat.mood !== 'carried' && !this.bounds.contains(cat.x, cat.y)).length;
        this.status.setText(`8 KITTENS / ${outside} OUT / ${this.catches} CAUGHT / ${this.misses} MISSED`);
    }

    private updateManager(dt: number) {
        const pm = this.manager;
        const before = { x: pm.x, y: pm.y };
        this.managerRest -= dt;
        this.managerTalk -= dt;
        if (this.carried) {
            const home = { x: this.bounds.centerX, y: this.bounds.bottom - 26 };
            if (this.move(pm, home, 47, dt)) {
                const cat = this.carried;
                cat.x = pm.x + 12;
                cat.y = pm.y;
                this.newToy(cat);
                cat.cooldown = 6;
                this.say(cat, 'FINE. ONE TOY.');
                this.carried = undefined;
                this.managerRest = 1;
            } else {
                this.carried.x = pm.x + (pm.flipX ? -6 : 6);
                this.carried.y = pm.y;
            }
        } else if (this.managerRest <= 0) {
            if (!this.quarry || this.quarry.mood === 'chat' || this.bounds.contains(this.quarry.x, this.quarry.y)) {
                this.quarry = this.cats
                    .filter((cat) => cat.mood !== 'carried' && cat.mood !== 'chat' && !this.bounds.contains(cat.x, cat.y))
                    .sort((a, b) => this.distance(pm, a) - this.distance(pm, b))[0];
                if (this.quarry) this.pmSays('BACK TO THE SPRINT!');
            }
            const cat = this.quarry;
            if (cat) {
                this.move(pm, cat, 62, dt);
                if (this.distance(pm, cat) < 13) {
                    // A predictable mix guarantees both outcomes instead of a streak of bad luck.
                    const caught = this.attempt++ % 3 !== 0;
                    if (caught) {
                        this.catches++;
                        this.carried = cat;
                        cat.mood = 'carried';
                        cat.talk = 0;
                        this.pmSays('GOT ONE! SCOPE REDUCED.');
                    } else {
                        this.misses++;
                        cat.target = this.wanderPoint(cat);
                        cat.mood = 'wander';
                        cat.timer = 4;
                        cat.cooldown = 2;
                        cat.jump = 0.65;
                        this.say(cat, 'NICE TRY!');
                        this.pmSays('THAT WAS NOT IN JIRA.');
                        this.managerRest = 1.6;
                    }
                    this.quarry = undefined;
                }
            } else {
                this.move(pm, { x: this.bounds.centerX, y: this.bounds.bottom + 18 }, 30, dt);
            }
        }
        const moving = this.distance(pm, before) > 0.01;
        if (moving) {
            pm.setFlipX(pm.x < before.x);
            pm.play('kitten-pm-walk', true);
        } else pm.stop().setFrame('side-0');
        pm.setDepth(pm.y);
        this.managerShadow.setPosition(pm.x, pm.y).setDepth(pm.y - 1);
        this.label.setPosition(pm.x, pm.y - 31).setDepth(pm.y + 2);
        const headroom = this.managerNametag ? 58 + this.managerNametag.height / this.scene.cameras.main.zoom : 48;
        this.managerBubble.setPosition(pm.x, pm.y - headroom).setDepth(pm.y + 1000).setVisible(this.managerTalk > 0);
    }

    private updateVisitors(dt: number) {
        const lines = ['MEOW?', 'I HAVE TO GET BACK TO WORK NOW..', 'ERR... MEOW, MEOW.'];
        const replies = ['MRRP?', 'MEOW MEOW!', 'PURRR. SAME TIME TOMORROW?'];
        for (const visitor of this.visitors) {
            const { person } = visitor;
            const s = person.sprite;
            visitor.timer -= dt;
            if (visitor.stage === 'idle') {
                if (visitor.timer > 0 || this.visitors.some((v) => v.stage !== 'idle')) continue;
                visitor.cat = this.cats.find((cat) => cat.mood !== 'carried' && cat.mood !== 'escape'
                    && this.distance(s, cat) < sp(180));
                if (!visitor.cat) continue;
                visitor.stage = 'approach';
                visitor.timer = 7;
            }
            person.hold(0.25);
            const before = { x: s.x, y: s.y };
            const cat = visitor.cat;
            if (visitor.stage === 'approach' && cat) {
                if (cat.mood === 'carried' || visitor.timer <= 0) {
                    visitor.stage = 'return';
                    visitor.timer = 1.5;
                } else if (this.distance(s, cat) < 30) {
                    visitor.stage = 'talk';
                    visitor.timer = 6;
                    visitor.line = -1;
                    cat.mood = 'chat';
                } else this.move(s, cat, 44, dt);
            }
            if (visitor.stage === 'talk' && cat) {
                const line = Math.min(2, Math.floor((6 - visitor.timer) / 2));
                if (line !== visitor.line) {
                    visitor.line = line;
                    const text = line === 0 && this.opts.disco(s.x, s.y) ? 'DISCO INFERNO? WHO INVITED THE DRAGON?' : lines[line];
                    visitor.bubble.setTexture(this.bubble(text)).setVisible(true);
                    this.say(cat, replies[line]);
                    cat.talk = 2;
                }
                s.setFlipX(cat.x < s.x);
                cat.target = s;
                if (visitor.timer <= 0) {
                    visitor.stage = 'return';
                    visitor.timer = 1.5;
                    cat.cooldown = 5;
                    if (this.bounds.contains(cat.x, cat.y)) this.newToy(cat);
                    else this.stroll(cat);
                }
            }
            if (visitor.stage === 'return') {
                if (visitor.timer <= 0) visitor.bubble.setVisible(false);
                if (this.move(s, { x: s.x, y: visitor.homeY }, 40, dt)) {
                    visitor.stage = 'idle';
                    visitor.timer = 18;
                    visitor.cat = undefined;
                    visitor.bubble.setVisible(false);
                }
            }
            if (this.distance(s, before) > 0.01) {
                s.setFlipX(s.x < before.x).play(person.anim, true);
            } else s.stop().setFrame('side-0');
            s.setDepth(s.y);
            person.shadow.setPosition(s.x, s.y);
            person.label?.setPosition(s.x, s.y - s.displayHeight - 4);
            const headroom = s.displayHeight + (person.label ? 16 : 2)
                + (person.nametag ? person.nametag.height / this.scene.cameras.main.zoom + 6 : 5);
            visitor.bubble.setPosition(s.x, s.y - headroom).setDepth(s.y + 1000);
        }
    }

    private drawCat(cat: Kitten) {
        const playing = cat.mood === 'play';
        const hop = cat.jump > 0 ? Math.sin((1 - cat.jump / 0.65) * Math.PI) * 25
            : playing ? Math.max(0, Math.sin(this.clock * 8 + cat.phase)) * 5 : 0;
        const carried = cat.mood === 'carried';
        const dancing = !carried && this.opts.disco(cat.x, cat.y);
        const step = ['toy', 'escape', 'wander', 'dragon', 'coin'].includes(cat.mood)
            ? Math.abs(Math.sin(this.clock * 15 + cat.phase)) * 2 : 0;
        const facing = cat.mood === 'dragon' ? this.opts.dragon() : cat.target;
        if (facing) cat.sprite.setFlipX(facing.x < cat.x);
        cat.sprite.setPosition(Math.round(cat.x), Math.round(cat.y - hop - step - (carried ? 18 : 0)))
            .setDepth(cat.y + (carried ? 2 : 0))
            .setAngle(dancing ? Math.sin(this.clock * 8 + cat.phase) * 8 : 0)
            .setScale(carried ? 0.9 : 1, playing ? 0.95 + Math.sin(this.clock * 8 + cat.phase) * 0.05 : 1);
        cat.shadow.setPosition(cat.x, cat.y).setVisible(!carried).setScale(1 - hop / 65);
        cat.bubble.setPosition(cat.x, cat.sprite.y - 22).setDepth(cat.y + 1000).setVisible(cat.talk > 0 && !carried);
    }
}
