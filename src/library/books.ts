import type { ColorName } from '../game/kit/palette';

export type ShelfId = 'classics' | 'adventure' | 'mystery';
export type Emblem = 'quill' | 'candle' | 'ribbon' | 'holly' | 'teacup' | 'compass' | 'emerald' | 'star' | 'magnifier' | 'lightning' | 'bat' | 'hourglass';

export const shelves: { id: ShelfId; name: string; plaque: string; note: string }[] = [
    { id: 'classics', name: 'Classics', plaque: 'CLASSICS', note: 'Novels that never left the shelf.' },
    { id: 'adventure', name: 'Adventure & Fantasy', plaque: 'ADVENTURE', note: 'Rabbit-holes, treasure maps, and yellow brick roads.' },
    { id: 'mystery', name: 'Mystery & SF', plaque: 'MYSTERY & SF', note: 'Detectives, monsters, and a machine that travels in time.' },
];

export type FeaturedBook = {
    /** Project Gutenberg eBook number. */
    id: string;
    title: string;
    author: string;
    /** Title and Author exactly as they appear in the Gutenberg header. */
    gutenbergTitle: string;
    gutenbergAuthor: string;
    /** Year of first publication. */
    year: number;
    shelf: ShelfId;
    cloth: ColorName;
    ink: ColorName;
    spine: string[];
    emblem: Emblem;
    blurb: string;
    file: string;
};

export const books: FeaturedBook[] = [
    {
        id: '1342', title: 'Pride and Prejudice', author: 'Jane Austen', gutenbergTitle: 'Pride and Prejudice', gutenbergAuthor: 'Jane Austen',
        year: 1813, shelf: 'classics', cloth: 'forest', ink: 'cream', spine: ['PRIDE AND', 'PREJUDICE'], emblem: 'quill',
        blurb: 'Elizabeth Bennet, Mr. Darcy, and five sisters in search of good marriages.', file: 'pride-and-prejudice.txt',
    },
    {
        id: '1260', title: 'Jane Eyre', author: 'Charlotte Brontë', gutenbergTitle: 'Jane Eyre: An Autobiography', gutenbergAuthor: 'Charlotte Brontë',
        year: 1847, shelf: 'classics', cloth: 'wine', ink: 'gold', spine: ['JANE EYRE'], emblem: 'candle',
        blurb: 'An orphan becomes governess at Thornfield Hall and tells her own story.', file: 'jane-eyre.txt',
    },
    {
        id: '514', title: 'Little Women', author: 'Louisa May Alcott', gutenbergTitle: 'Little Women', gutenbergAuthor: 'Louisa May Alcott',
        year: 1868, shelf: 'classics', cloth: 'plum', ink: 'peach', spine: ['LITTLE', 'WOMEN'], emblem: 'ribbon',
        blurb: 'Meg, Jo, Beth, and Amy March grow up in New England.', file: 'little-women.txt',
    },
    {
        id: '46', title: 'A Christmas Carol', author: 'Charles Dickens', gutenbergTitle: 'A Christmas Carol in Prose; Being a Ghost Story of Christmas', gutenbergAuthor: 'Charles Dickens',
        year: 1843, shelf: 'classics', cloth: 'red', ink: 'white', spine: ['CHRISTMAS', 'CAROL'], emblem: 'holly',
        blurb: 'Ebenezer Scrooge is visited by Marley’s ghost and three spirits.', file: 'a-christmas-carol.txt',
    },
    {
        id: '11', title: 'Alice’s Adventures in Wonderland', author: 'Lewis Carroll', gutenbergTitle: "Alice's Adventures in Wonderland", gutenbergAuthor: 'Lewis Carroll',
        year: 1865, shelf: 'adventure', cloth: 'blue', ink: 'yellow', spine: ['ALICE IN', 'WONDERLAND'], emblem: 'teacup',
        blurb: 'Alice follows a White Rabbit down the rabbit-hole.', file: 'alice.txt',
    },
    {
        id: '120', title: 'Treasure Island', author: 'Robert Louis Stevenson', gutenbergTitle: 'Treasure Island', gutenbergAuthor: 'Robert Louis Stevenson',
        year: 1883, shelf: 'adventure', cloth: 'earth', ink: 'sand', spine: ['TREASURE', 'ISLAND'], emblem: 'compass',
        blurb: 'Jim Hawkins sails for Captain Flint’s buried treasure, with Long John Silver aboard.', file: 'treasure-island.txt',
    },
    {
        id: '55', title: 'The Wonderful Wizard of Oz', author: 'L. Frank Baum', gutenbergTitle: 'The Wonderful Wizard of Oz', gutenbergAuthor: 'L. Frank Baum',
        year: 1900, shelf: 'adventure', cloth: 'pine', ink: 'lime', spine: ['WIZARD', 'OF OZ'], emblem: 'emerald',
        blurb: 'A cyclone carries Dorothy and Toto from Kansas to the Land of Oz.', file: 'wonderful-wizard-of-oz.txt',
    },
    {
        id: '16', title: 'Peter Pan', author: 'J. M. Barrie', gutenbergTitle: 'Peter Pan', gutenbergAuthor: 'J. M. Barrie',
        year: 1911, shelf: 'adventure', cloth: 'navy', ink: 'ice', spine: ['PETER PAN'], emblem: 'star',
        blurb: 'Wendy, John, and Michael fly with Peter Pan to the Neverland.', file: 'peter-pan.txt',
    },
    {
        id: '1661', title: 'The Adventures of Sherlock Holmes', author: 'Arthur Conan Doyle', gutenbergTitle: 'The Adventures of Sherlock Holmes', gutenbergAuthor: 'Arthur Conan Doyle',
        year: 1892, shelf: 'mystery', cloth: 'steel', ink: 'white', spine: ['SHERLOCK', 'HOLMES'], emblem: 'magnifier',
        blurb: 'Twelve cases of Sherlock Holmes, as told by Dr. Watson.', file: 'sherlock-holmes.txt',
    },
    {
        id: '84', title: 'Frankenstein', author: 'Mary Shelley', gutenbergTitle: 'Frankenstein; or, the modern prometheus', gutenbergAuthor: 'Mary Wollstonecraft Shelley',
        year: 1818, shelf: 'mystery', cloth: 'slate', ink: 'lime', spine: ['FRANKEN-', 'STEIN'], emblem: 'lightning',
        blurb: 'Victor Frankenstein gives life to a creature, then abandons it.', file: 'frankenstein.txt',
    },
    {
        id: '345', title: 'Dracula', author: 'Bram Stoker', gutenbergTitle: 'Dracula', gutenbergAuthor: 'Bram Stoker',
        year: 1897, shelf: 'mystery', cloth: 'gold', ink: 'wine', spine: ['DRACULA'], emblem: 'bat',
        blurb: 'Journals and letters track a Transylvanian count to England.', file: 'dracula.txt',
    },
    {
        id: '35', title: 'The Time Machine', author: 'H. G. Wells', gutenbergTitle: 'The Time Machine', gutenbergAuthor: 'H. G. Wells',
        year: 1895, shelf: 'mystery', cloth: 'orange', ink: 'ink', spine: ['THE TIME', 'MACHINE'], emblem: 'hourglass',
        blurb: 'A Victorian inventor travels to the year 802,701 and beyond.', file: 'the-time-machine.txt',
    },
];

export const booksOn = (shelf: ShelfId) => books.filter(book => book.shelf === shelf);
export const bookById = (id: string) => books.find(book => book.id === id);
export const bookUrl = (book: FeaturedBook) => `${import.meta.env.BASE_URL}books/${book.file}`;
export const gutenbergPage = (id: string | number) => `https://www.gutenberg.org/ebooks/${id}`;
export const GUTENBERG_LICENSE = 'https://www.gutenberg.org/policy/license.html';
/** Section 1.E.1 of the Project Gutenberg License, shown with every Gutenberg text. */
export const GUTENBERG_NOTICE = 'This eBook is for the use of anyone anywhere in the United States and most other parts of the world at no cost and with almost no restrictions whatsoever. You may copy it, give it away or re-use it under the terms of the Project Gutenberg License included with this eBook or online at www.gutenberg.org. If you are not located in the United States, you will have to check the laws of the country where you are located before using this eBook.';
