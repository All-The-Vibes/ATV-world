/** The faces of a bound book: cloth cover, marbled endpapers, title page, colophon, and typeset pages of text. */
import { Fragment, memo, useState, type CSSProperties } from 'react';
import { emblem, fleuron } from './art';
import { coverUrl } from './catalog';
import type { Binding, Edition } from './edition';
import { segments, type Page, type Paged, type Row } from './paginate';
import type { Geometry } from './typeset';

/** What lies on one face: a page by index, a board, or nothing. */
export type FaceContent = 'none' | 'cover' | 'inside' | 'end' | 'paper' | number;
/** Left-hand or right-hand page. */
export type Side = 'verso' | 'recto';

export type Volume = {
    binding: Binding;
    edition?: Edition;
    paged?: Paged;
    geometry: Geometry;
    spreads: boolean;
    /** Turn to the opening that holds this page. */
    jump: (page: number) => void;
};

type FaceProps = {
    volume: Volume;
    content: FaceContent;
    side: Side;
    /** Paste the face onto the board, for the inside of the front cover as it turns. */
    board?: boolean;
};

export const Face = memo(function Face({ volume, content, side, board }: FaceProps) {
    if (content === 'none') return null;
    if (content === 'cover') return <Cover binding={volume.binding} />;
    const face = content === 'inside' ? <Endpaper plate />
        : content === 'end' ? <Endpaper />
            : content === 'paper' ? <div className={`page page-${side}`} />
                : <PageView volume={volume} index={content} side={side} />;
    return board ? <div className={`board-face board-${side}`}>{face}</div> : face;
});

const titleSize = (title: string) => (title.length <= 14 ? 18 : title.length <= 40 ? 14 : title.length <= 72 ? 11 : 9);

function Cover({ binding }: { binding: Binding }) {
    const [failed, setFailed] = useState(false);
    const initial = /[\p{L}\p{N}]/u.exec(binding.title)?.[0] ?? '?';
    return (
        <div className="cover">
            <div className="cover-frame">
                <p className="cover-title" style={{ fontSize: titleSize(binding.title) }}>{binding.title}</p>
                <img className="cover-rule" src={fleuron(binding.ink).url} width={50} height={10} alt="" />
                <div className="cover-art">
                    {binding.cover && !failed ? (
                        <img className="cover-plate" src={coverUrl(binding.cover, 'M')} alt="" onError={() => setFailed(true)} />
                    ) : binding.emblem ? (
                        <img className="cover-emblem" src={emblem(binding.emblem, binding.ink).url} width={44} height={44} alt="" />
                    ) : (
                        <span className="cover-initial" aria-hidden="true">{initial}</span>
                    )}
                </div>
                <p className="cover-author">{binding.author}</p>
                <p className="cover-foot">The Tower Library</p>
            </div>
        </div>
    );
}

function Endpaper({ plate }: { plate?: boolean }) {
    return (
        <div className="page endpaper">
            {plate && (
                <div className="bookplate">
                    <p className="bookplate-ex">Ex libris</p>
                    <img src={fleuron('wine').url} width={50} height={10} alt="" />
                    <p className="bookplate-name">The Tower Library</p>
                    <p className="bookplate-place">ATV World</p>
                </div>
            )}
        </div>
    );
}

function PageView({ volume, index, side }: { volume: Volume; index: number; side: Side }) {
    const page = volume.paged?.pages[index];
    if (!page) return <Endpaper />;
    switch (page.kind) {
        case 'endpaper': return <Endpaper plate />;
        case 'title': return <TitlePage volume={volume} side={side} />;
        case 'colophon': return <Colophon volume={volume} side={side} />;
        case 'blank': return <div className={`page page-${side}`} />;
        default: return <TextPage volume={volume} page={page} side={side} />;
    }
}

const boxStyle = (geometry: Geometry, side: Side): CSSProperties => ({
    left: geometry.left[side],
    top: geometry.top,
    width: geometry.box.w,
    height: geometry.box.h,
});

function TitlePage({ volume, side }: { volume: Volume; side: Side }) {
    const { binding, edition, geometry } = volume;
    return (
        <div className={`page page-${side}`}>
            <div className="title-page" style={boxStyle(geometry, side)}>
                <p className="title-page-title">{binding.title}</p>
                <p className="title-page-by">by {binding.author}</p>
                <img src={fleuron(binding.accent).url} width={75} height={15} alt="" />
                {binding.year ? <p className="title-page-year">First published {binding.year}</p> : null}
                <div className="title-page-imprint">
                    {edition && <p>{edition.imprint}</p>}
                    <p>The Tower Library</p>
                </div>
            </div>
        </div>
    );
}

function Colophon({ volume, side }: { volume: Volume; side: Side }) {
    const colophon = volume.edition?.colophon;
    return (
        <div className={`page page-${side}`}>
            <div className="colophon" style={boxStyle(volume.geometry, side)}>
                {colophon?.lines.map(line => <p key={line}>{line}</p>)}
                {colophon?.notice && <p>{colophon.notice}</p>}
                {colophon?.links.map(link => (
                    <p key={link.href}><a href={link.href} target="_blank" rel="noopener noreferrer">{link.text}</a></p>
                ))}
            </div>
        </div>
    );
}

function TextPage({ volume, page, side }: { volume: Volume; page: Page; side: Side }) {
    const { geometry, binding } = volume;
    const head = volume.spreads && side === 'verso' ? binding.title : page.head;
    const band: CSSProperties = { left: geometry.left[side], width: geometry.box.w };
    return (
        <div className={`page page-${side}`}>
            {!page.opener && head && <div className="page-head" style={band}>{head}</div>}
            <div className="page-box" style={boxStyle(geometry, side)}>
                {page.rows.map((row, index) => <RowView key={index} row={row} volume={volume} />)}
            </div>
            {page.folio && <div className="page-folio" style={band}>{page.folio}</div>}
        </div>
    );
}

/** One line of text: italic runs become <i>, and justified lines spread their words across the measure. */
function Words({ text, spread }: { text: string; spread?: boolean }) {
    return (
        <>
            {segments(text).map((parts, index) => {
                const word = parts.map((part, j) => (part.italic ? <i key={j}>{part.text}</i> : <Fragment key={j}>{part.text}</Fragment>));
                return spread ? <span key={index}>{word}</span> : <Fragment key={index}>{index ? ' ' : null}{word}</Fragment>;
            })}
        </>
    );
}

const Lines = ({ lines }: { lines?: string[] }) => <>{lines?.map((line, index) => <span key={index} className="row-line"><Words text={line} /></span>)}</>;

function RowView({ row, volume }: { row: Row; volume: Volume }) {
    const style: CSSProperties = { left: row.x, top: row.y, width: row.w, height: row.h };
    const lineHeight = `${row.h / Math.max(1, row.lines?.length ?? 1)}px`;
    switch (row.kind) {
        case 'line':
            return (
                <div className={`row row-text${row.small ? ' row-small' : ''}${row.justify ? ' row-justify' : ''}`} style={{ ...style, lineHeight: `${row.h}px` }}>
                    <Words text={row.text ?? ''} spread={row.justify} />
                </div>
            );
        case 'cap':
            return <div className="row row-cap" style={style}>{row.text}</div>;
        case 'label':
            return <div className="row row-label" style={{ ...style, lineHeight }}><Lines lines={row.lines} /></div>;
        case 'title':
            return <div className="row row-title" style={{ ...style, lineHeight }}><Lines lines={row.lines} /></div>;
        case 'caption':
            return <div className="row row-caption" style={{ ...style, lineHeight }}><Lines lines={row.lines} /></div>;
        case 'orn':
            return (
                <div className="row row-orn" style={style}>
                    <img src={fleuron(volume.binding.accent).url} width={50} height={10} alt="" />
                </div>
            );
        case 'link':
            return (
                <a className="row row-link" style={{ ...style, height: undefined, lineHeight: `${row.h / Math.max(1, row.lines?.length ?? 1)}px` }} href={row.href} target="_blank" rel="noopener noreferrer">
                    <Lines lines={row.lines} />
                </a>
            );
        case 'toc': {
            const lines = row.lines ?? [];
            const content = lines.map((line, index) => (index < lines.length - 1 ? (
                <span key={index} className="row-line"><Words text={line} /></span>
            ) : (
                <span key={index} className="row-line toc-last">
                    <span className="toc-text"><Words text={line} /></span>
                    <span className="toc-dots" aria-hidden="true" />
                    <span className="toc-folio">{row.folio}</span>
                </span>
            )));
            const className = `row row-toc toc-${row.level ?? 1}`;
            const target = row.target ?? -1;
            return target >= 0 ? (
                <button type="button" className={className} style={{ ...style, lineHeight }} onClick={() => volume.jump(target)}>{content}</button>
            ) : (
                <div className={className} style={{ ...style, lineHeight }}>{content}</div>
            );
        }
    }
}
