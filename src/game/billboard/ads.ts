import type { ColorName } from '../kit';

export interface AIAd {
    id: string;
    brand: string;
    badge: string;
    headline: string;
    tagline: string;
    offer: string;
    accentColor: ColorName;
    badgeColor: ColorName;
    icon: 'server-fire' | 'wizard-pc' | 'token-leaf' | 'gpu-flame' | 'energy-can' | 'crying-robot' | 'brain-glitch' | 'sleeping-bot';
    quip: string;
}

/**
 * Rotating advertisements for absurd, humorous AI products and services.
 */
export const AI_ADS: readonly AIAd[] = [
    {
        id: 'vibe-insurance',
        brand: 'VIBE INSURANCE',
        badge: 'SPONSORED',
        headline: 'PROD DOWN AT 5PM?',
        tagline: 'WE BLAME THE MODEL!',
        offer: '$0 DEDUCTIBLE',
        accentColor: 'gold',
        badgeColor: 'red',
        icon: 'server-fire',
        quip: 'We cover accidental git push --force on Fridays!',
    },
    {
        id: 'prompt-o-matic',
        brand: 'PROMPT-O-MATIC',
        badge: 'TOP TECH',
        headline: 'SAYS PLEASE/THANX',
        tagline: '+15% POLITENESS!',
        offer: 'ONLY 49 TOKENS',
        accentColor: 'cyan',
        badgeColor: 'violet',
        icon: 'wizard-pc',
        quip: 'Being polite saves 0.001% compute and warms the AI heart.',
    },
    {
        id: 'organic-tokens',
        brand: 'ORGANIC TOKENS',
        badge: 'ECO AI',
        headline: '100% NON-SYNTHETIC',
        tagline: 'FREE-RANGE HUMAN TEXT',
        offer: 'NEVER FROM REDDIT',
        accentColor: 'lime',
        badgeColor: 'forest',
        icon: 'token-leaf',
        quip: 'Freshly harvested from artisanal caffeinated developers.',
    },
    {
        id: 'gpu-heater',
        brand: 'GPU SPACE HEATER',
        badge: 'HARDWARE',
        headline: 'RUN 70B LOCALLY!',
        tagline: 'WARMS WHOLE HOUSE',
        offer: '$99/MS + ICE PACK',
        accentColor: 'orange',
        badgeColor: 'wine',
        icon: 'gpu-flame',
        quip: 'Heats your living room while debating philosophy with itself.',
    },
    {
        id: 'agi-soon',
        brand: 'AGI SOON (TM)',
        badge: 'HOPIUM',
        headline: 'SHIPS NEXT TUESDAY',
        tagline: '999% DAILY HOPIUM',
        offer: 'JUST 1 MORE PAPER',
        accentColor: 'yellow',
        badgeColor: 'gold',
        icon: 'energy-can',
        quip: 'Arriving next week, guaranteed recursively until the end of time.',
    },
    {
        id: 'ai-apologizer',
        brand: 'AI APOLOGIZER',
        badge: 'ENTERPRISE',
        headline: 'AS A LARGE MODEL.',
        tagline: '5,000 WORDS OF NO',
        offer: 'DOWNLOAD APOLOGY',
        accentColor: 'ice',
        badgeColor: 'blue',
        icon: 'crying-robot',
        quip: 'I apologize for apologizing about my previous apology.',
    },
    {
        id: 'quantum-guesser',
        brand: 'QUANTUM GUESS',
        badge: 'RESEARCH',
        headline: 'WRONG IN 12 WAYS!',
        tagline: 'NEW FAKE CITATIONS',
        offer: 'DR. BOT APPROVED',
        accentColor: 'pink',
        badgeColor: 'plum',
        icon: 'brain-glitch',
        quip: 'Invented three fake Nobel laureates to back up your thesis.',
    },
    {
        id: 'agent-sleep',
        brand: 'AGENT LOOP-PRO',
        badge: 'STARTUP',
        headline: 'STUCK IN A LOOP?',
        tagline: 'BURNS SEED MONEY',
        offer: 'BILL INVESTORS',
        accentColor: 'gold',
        badgeColor: 'navy',
        icon: 'sleeping-bot',
        quip: 'I delegated the task to another agent who delegated it back to me!',
    },
];
