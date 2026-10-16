import type Phaser from 'phaser';
import { PixelCanvas, addPixels, miniText, miniTextWidth, shadowTexture, type ColorName } from '../kit';

type State = 'green' | 'yellow' | 'red' | 'unknown';
const states: State[] = ['green', 'yellow', 'red', 'unknown'];
const messages = ['MAIN IS HEALTHY', 'CHECKS FAILING', 'MAIN IS BROKEN', 'AWAITING CI', 'CHECKS RUNNING', 'CI UNAVAILABLE'];

export class TrafficLight {
    readonly sprite: Phaser.GameObjects.Image;
    readonly label: Phaser.GameObjects.Image;

    constructor(scene: Phaser.Scene, x: number, y: number) {
        for (const state of states) {
            const pc = new PixelCanvas(76, 140);
            pc.ellipse(38, 134, 30, 5, 'ink')
                .rect(17, 125, 42, 9, 'steel').rect(21, 125, 34, 3, 'cloud')
                .rect(33, 92, 10, 34, 'ink').rect(36, 92, 4, 34, 'steel')
                .rect(13, 10, 50, 86, 'ink').rect(16, 13, 44, 80, 'gold')
                .rect(20, 16, 36, 74, 'night');
            const lamps: { state: State; y: number; color: ColorName; shine: ColorName }[] = [
                { state: 'red', y: 29, color: 'red', shine: 'peach' },
                { state: 'yellow', y: 53, color: 'gold', shine: 'yellow' },
                { state: 'green', y: 77, color: 'leaf', shine: 'lime' },
            ];
            for (const lamp of lamps) {
                const on = state === lamp.state;
                pc.ellipse(38, lamp.y - 2, 17, 12, 'ink')
                    .ellipse(38, lamp.y, 12, 10, on ? lamp.color : 'slate');
                if (on) pc.ellipse(35, lamp.y - 3, 6, 4, lamp.shine).rect(28, lamp.y + 5, 20, 1, lamp.shine);
            }
            pc.rect(0, 0, 76, 10, 'ink');
            miniText(pc, 2, 3, 'CI/CD MAIN', 'white');
            addPixels(scene, `ci-light-${state}`, pc);
        }
        for (const message of messages) {
            const pc = new PixelCanvas(miniTextWidth(message) + 8, 13);
            pc.rect(0, 0, pc.width, pc.height, 'ink');
            miniText(pc, 4, 4, message, 'white');
            addPixels(scene, `ci-label-${message}`, pc);
        }
        scene.add.image(x, y, shadowTexture(scene, 66)).setAlpha(0.35).setDepth(-1e8);
        this.sprite = scene.add.image(x, y, 'ci-light-unknown').setOrigin(0.5, 1).setDepth(y);
        this.label = scene.add.image(x, y + 9, 'ci-label-AWAITING CI').setDepth(y + 1);
        this.sprite.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
            window.open('https://github.com/All-The-Vibes/ATV-world/actions', '_blank', 'noopener,noreferrer');
        });
        let stopped = false;
        let controller: AbortController | undefined;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const refresh = async () => {
            controller = new AbortController();
            const timeout = setTimeout(() => controller?.abort(), 10_000);
            try {
                const response = await fetch('/api/health', { signal: controller.signal, cache: 'no-store' });
                if (!response.ok) throw new Error(`CI health returned ${response.status}`);
                const data: unknown = await response.json();
                if (!data || typeof data !== 'object' || !('state' in data) || !('message' in data) ||
                    !states.some(state => state === data.state) ||
                    !messages.some(message => message === data.message)) throw new Error('Invalid CI health response');
                if (!stopped) {
                    this.sprite.setTexture(`ci-light-${data.state}`);
                    this.label.setTexture(`ci-label-${data.message}`);
                }
            } catch (error) {
                if (!stopped) {
                    console.warn('[ATV] CI health unavailable:', error);
                    this.sprite.setTexture('ci-light-unknown');
                    this.label.setTexture('ci-label-CI UNAVAILABLE');
                }
            } finally {
                clearTimeout(timeout);
                if (!stopped) timer = setTimeout(refresh, 60_000);
            }
        };
        const stop = () => {
            stopped = true;
            clearTimeout(timer);
            controller?.abort();
        };
        scene.events.once('shutdown', stop);
        scene.events.once('destroy', stop);
        void refresh();
    }
}
