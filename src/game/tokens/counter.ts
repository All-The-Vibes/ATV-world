import type Phaser from 'phaser';
import { PALETTE } from '../kit/palette';

/** A token balance above the character's name/marker, readable even in fit view. Shown only while they hold some. */
export function addTokenCounter(sprite: Phaser.GameObjects.Sprite, count: () => number, gap = 2) {
    const scene = sprite.scene;
    const label = scene.add.text(0, 0, '', {
        fontFamily: 'VT323, monospace',
        fontSize: '12px',
        color: PALETTE.gold,
        backgroundColor: PALETTE.ink,
        padding: { x: 3, y: 1 },
        resolution: 2,
    }).setOrigin(0.5, 1).setName('token-count');
    let shown = -1;
    const sync = () => {
        const total = count();
        if (total !== shown) {
            label.setText(`${total.toLocaleString()} ${total === 1 ? 'TOKEN' : 'TOKENS'}`);
            shown = total;
        }
        const head = sprite.getTopCenter();
        const scale = Math.max(1, 1 / scene.cameras.main.zoom);
        label.setPosition(head.x, head.y - gap - 22 * scale).setScale(scale)
            .setDepth(sprite.depth + 0.2).setVisible(sprite.visible && sprite.active && total > 0).setAlpha(sprite.alpha);
    };
    const hide = () => label.setVisible(false);
    const destroy = () => label.destroy();
    scene.events.on('postupdate', sync);
    scene.events.on('sleep', hide);
    scene.events.on('wake', sync);
    sprite.once('destroy', destroy);
    label.once('destroy', () => {
        scene.events.off('postupdate', sync);
        scene.events.off('sleep', hide);
        scene.events.off('wake', sync);
        sprite.off('destroy', destroy);
    });
    void document.fonts.load('12px VT323').then(() => { if (label.scene) label.updateText(); });
    sync();
    return label;
}
