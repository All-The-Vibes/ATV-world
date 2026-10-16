import Phaser from 'phaser';
import { Speaker, pick, still, type Feature } from './talk';

const SEATS = [16, 40, 68, 94];
const HATTER_LINES = [
    'Why is a raven like a writing-desk?',
    'Your hair wants cutting.',
    "It's always six o'clock now!",
    'Twinkle, twinkle, little bat!',
    'I want a clean cup!',
    "No, I haven't the slightest idea.",
];
const HARE_LINES = [
    'Have some wine. There is none.',
    'It was the BEST butter!',
    'Then say what you mean!',
    "Take some more tea. You've had none.",
    'Not the same thing a bit!',
];
const DORMOUSE_LINES = ['...twinkle... twinkle...', '...a treacle well...', '...I breathe when I sleep...'];

interface Guest {
    sprite: Phaser.GameObjects.Sprite;
    speaker: Speaker;
    seat: number;
    lines: string[];
    lift: number;
}

/**
 * The Mad Tea Party: the Hatter, the March Hare and the sleepy Dormouse at a long table. Every so often someone
 * cries "Move down!" and they all hop along a seat. Come too close and they insist there's no room.
 */
export class TeaParty implements Feature {
    private readonly guests: Guest[];
    private shuffleIn = 6;
    private chatIn = 2;
    private zIn = 1;
    private shooed = 0;
    private sipFor = 0;

    constructor(private readonly scene: Phaser.Scene, readonly x: number, readonly y: number) {
        scene.add.image(x, y, 'wl-tea').setOrigin(0.5, 1).setDepth(y);
        scene.add.image(x - 70, y + 22, 'wl-tag-tea').setOrigin(0.5, 1).setDepth(y + 22);
        const guest = (key: string, seat: number, lines: string[], lift: number): Guest => {
            const sprite = scene.add.sprite(this.seatX(seat), y - 27 + lift, key, 0).setOrigin(0.5, 1).setDepth(y + 1);
            return { sprite, seat, lines, lift, speaker: new Speaker(scene, () => ({ x: sprite.x, y: sprite.y - sprite.height })) };
        };
        this.guests = [
            guest('wl-hatter', 0, HATTER_LINES, 0),
            guest('wl-hare', 1, HARE_LINES, 0),
            guest('wl-dormouse', 2, DORMOUSE_LINES, 1),
        ];
        this.guests[2].sprite.play('wl-dormouse');
    }

    private seatX(seat: number) {
        return this.x - 54 + SEATS[seat];
    }

    update(dt: number, player: Phaser.GameObjects.Sprite) {
        const [hatter, hare, dormouse] = this.guests;
        if ((this.shuffleIn -= dt) <= 0) {
            this.shuffleIn = Phaser.Math.FloatBetween(7, 11);
            this.moveDown();
        }
        if ((this.chatIn -= dt) <= 0) {
            this.chatIn = Phaser.Math.FloatBetween(2.5, 4.5);
            const g = pick([hatter, hatter, hare, hare, dormouse]);
            if (!this.guests.some((o) => o.speaker.talking)) g.speaker.say(pick(g.lines), 2.6);
        }
        if ((this.zIn -= dt) <= 0) {
            this.zIn = 1.4;
            this.snore(dormouse.sprite);
        }
        if (this.sipFor > 0 && (this.sipFor -= dt) <= 0) hatter.sprite.setFrame(0);
        else if (this.sipFor <= 0 && Math.random() < dt * 0.15) {
            hatter.sprite.setFrame(1);
            this.sipFor = 1.6;
        }
        hare.sprite.setFrame(hare.speaker.talking ? 1 : 0);

        const near = Phaser.Math.Distance.Between(player.x, player.y, this.x, this.y + 6) < 72;
        if (near && this.scene.time.now > this.shooed) {
            this.shooed = this.scene.time.now + 12000;
            hare.speaker.say('No room! No room!', 2.2);
            this.scene.time.delayedCall(1200, () => hatter.speaker.say("There's PLENTY of room. Sit!", 2.4));
        }
    }

    /** "Clean cup! Move down!" Everyone hops along to the next seat (the last one leaps back round to the first). */
    private moveDown() {
        this.guests[0].speaker.say('Clean cup! Move down!', 2);
        for (const g of this.guests) {
            const from = this.seatX(g.seat);
            g.seat = (g.seat + 1) % SEATS.length;
            const to = this.seatX(g.seat);
            const baseY = this.y - 27 + g.lift;
            const arc = Math.abs(to - from) > 40 ? 28 : 12;
            if (still()) {
                g.sprite.x = to;
                continue;
            }
            const hop = { t: 0 };
            this.scene.tweens.add({
                targets: hop,
                t: 1,
                duration: arc > 20 ? 700 : 420,
                ease: 'Sine.easeInOut',
                onUpdate: () => g.sprite.setPosition(from + (to - from) * hop.t, baseY - Math.sin(Math.PI * hop.t) * arc),
            });
        }
    }

    private snore(sprite: Phaser.GameObjects.Sprite) {
        if (still()) return;
        const z = this.scene.add.image(sprite.x + 4, sprite.y - 12, 'wl-zed').setDepth(1e4).setAlpha(0.9);
        this.scene.tweens.add({ targets: z, x: z.x + 8, y: z.y - 18, alpha: 0, scale: 1.6, duration: 2000, onComplete: () => z.destroy() });
    }
}
