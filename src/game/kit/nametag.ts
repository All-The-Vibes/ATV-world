import type Phaser from 'phaser';
import type { CharacterLook } from './characters';
import { PALETTE } from './palette';
import { githubLabelsVisible, onGithubLabels } from '../commands';

/** Separate text follows the sprite, so turning never mirrors the creator's name. */
export function addCreatorNametag(
    sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image,
    { githubUsername }: Pick<CharacterLook, 'githubUsername'>,
    { gap = 2, headOffsetX = 0, speech }: {
        gap?: number;
        headOffsetX?: number;
        speech?: () => Phaser.GameObjects.Image | undefined;
    } = {},
): Phaser.GameObjects.Text | undefined {
    if (!githubUsername) return;
    const scene = sprite.scene;
    const label = scene.add.text(0, 0, `@${githubUsername}`, {
        fontFamily: 'VT323, monospace',
        fontSize: '12px',
        color: PALETTE.cream,
        backgroundColor: PALETTE.ink,
        padding: { x: 2, y: 1 },
        resolution: 2,
    }).setOrigin(0.5, 1).setName('creator-nametag').setData('gap', gap);
    sprite.setData('creatorNametag', label);
    const sync = () => {
        const head = sprite.getTopCenter();
        label.setPosition(head.x + (sprite.flipX ? -headOffsetX : headOffsetX) * sprite.scaleX, head.y - gap)
            // shortcut: crowded overview tags can overlap; zoom in, add collision layout only if needed.
            .setScale(1 / scene.cameras.main.zoom)
            .setDepth(sprite.depth + 0.1)
            .setVisible(githubLabelsVisible() && scene.sys.isVisible() && sprite.visible && sprite.active)
            .setAlpha(sprite.alpha);
        const bubble = speech?.();
        if (label.visible && bubble?.visible) {
            bubble.y = Math.min(bubble.y, label.y - label.displayHeight - 4);
        }
    };
    const hide = () => label.setVisible(false);
    const destroy = () => label.destroy();
    const off = onGithubLabels(sync);
    scene.events.on('postupdate', sync);
    scene.events.on('sleep', hide);
    scene.events.on('wake', sync);
    sprite.once('destroy', destroy);
    label.once('destroy', () => {
        off();
        if (sprite.getData('creatorNametag') === label) sprite.data?.remove('creatorNametag');
        scene.events.off('postupdate', sync);
        scene.events.off('sleep', hide);
        scene.events.off('wake', sync);
        sprite.off('destroy', destroy);
    });
    // Text caches its canvas; repaint if the existing pixel font finishes loading after scene creation.
    void document.fonts.load('12px VT323').then(
        () => { if (label.scene) label.updateText(); },
        () => { /* Keep the monospace fallback if the pixel font cannot load. */ },
    );
    sync();
    return label;
}
