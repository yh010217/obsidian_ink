import classNames from 'classnames';
import './drawing-embed-preview.scss';
import * as React from 'react';
import SVG from 'react-inlinesvg';
import { PrimaryMenuBar } from 'src/tldraw/primary-menu-bar/primary-menu-bar';
import TransitionMenu from 'src/tldraw/transition-menu/transition-menu';
import InkPlugin from 'src/main';
import { TFile } from 'obsidian';
import { useAtomValue, useSetAtom } from 'jotai';
import { DrawingEmbedState, embedStateAtom, previewActiveAtom } from '../drawing-embed';
import { getInkFileData } from 'src/utils/getInkFileData';
import { LinkGroup, LinkGroupMap } from 'src/utils/page-file';
import { getLinkGroupBoundsFromSnapshot } from 'src/utils/tldraw-helpers';
import { Box } from '@tldraw/tldraw';
const emptyDrawingSvg = require('../../../placeholders/empty-drawing-embed.svg');

//////////
//////////

interface DrawingEmbedPreviewProps {
    plugin: InkPlugin,
    onReady: Function,
    drawingFile: TFile,
        onClick: React.MouseEventHandler,
        onLinkGroupClick?: (payload: {
                groupId: string;
                link: LinkGroup;
                anchor: DOMRect;
                bounds: Box | null;
        }) => void,
}

// Wraps the component so that it can full unmount when inactive
export const DrawingEmbedPreviewWrapper: React.FC<DrawingEmbedPreviewProps> = (props) => {
    const previewActive = useAtomValue(previewActiveAtom);
    //console.log('PREVIEW ACTIVE', previewActive)

    if (previewActive) {
        return <DrawingEmbedPreview {...props} />
    } else {
        return <></>
    }
}

export const DrawingEmbedPreview: React.FC<DrawingEmbedPreviewProps> = (props) => {
    const svgRef = React.useRef(null);

    const containerElRef = React.useRef<HTMLDivElement>(null);
    const setEmbedState = useSetAtom(embedStateAtom);
    const [fileSrc, setFileSrc] = React.useState<string>(emptyDrawingSvg);
    const [linkGroups, setLinkGroups] = React.useState<LinkGroupMap>({});
    const [normalizedBounds, setNormalizedBounds] = React.useState<{
            groupId: string;
            rect: { x: number; y: number; width: number; height: number; };
    }[]>([]);

    React.useEffect(() => {
        //console.log('PREVIEW mounted');
        fetchFileData();
        return () => {
            //console.log('PREVIEW unmounting');
        }
    })

    // Check if src is a DataURI. If not, it's an SVG
    const isImg = fileSrc.slice(0, 4) === 'data';

	return <>
        <div
            ref = {containerElRef}
            className = {classNames([
                'ddc_ink_drawing-embed-preview',
                props.plugin.settings.drawingFrameWhenLocked && 'ddc_ink_visible-frame',
                props.plugin.settings.drawingBackgroundWhenLocked && 'ddc_ink_visible-background',
            ])}
            style = {{
                position: 'absolute',
                width: '100%',
                height: '100%',
                pointerEvents: 'all',
            }}
            onClick = {props.onClick}

            // Not currently doing this cause it can mean users easily lose their undo history
            // onMouseUp = {props.onEditClick}
            // onMouseEnter = {props.onClick}
        >
            {isImg && (
                <img
                    src = {fileSrc}
                    style = {{
                        height: '100%',
                        cursor: 'pointer',
                        pointerEvents: 'all',
                    }}
                    onLoad = {onLoad}
                />
            )}

            {!isImg && (
                <SVG
                    src = {fileSrc}
                    style = {{
                        // width: 'auto',
                        // height: '100%',
                        maxWidth: '100%',
                        maxHeight: '100%',
                        cursor: 'pointer'
                    }}
                    pointerEvents = "visible"
                    onLoad = {onLoad}
                />
            )}

            {normalizedBounds.map((group, index) => {
                const link = linkGroups[group.groupId];
                if (!link) return null;
                const color = LINK_GROUP_COLORS[index % LINK_GROUP_COLORS.length];
                return (
                    <div
                        key={group.groupId}
                        className="ddc_ink_link-overlay"
                        style={{
                            left: `${group.rect.x * 100}%`,
                            top: `${group.rect.y * 100}%`,
                            width: `${group.rect.width * 100}%`,
                            height: `${group.rect.height * 100}%`,
                        }}
                    >
                        <button
                            type="button"
                            className="ddc_ink_link-overlay__button"
                            style={{
                                borderColor: color,
                                backgroundColor: `${color}1A`,
                            }}
                            onClick={(event) => handleLinkGroupClick(event, group.groupId)}
                            title={link.target}
                        >
                            <span className="ddc_ink_link-overlay__badge" style={{ backgroundColor: color }}>
                                {index + 1}
                            </span>
                            <span className="ddc_ink_link-overlay__label">{link.target}</span>
                        </button>
                    </div>
                );
            })}
        </div>
    </>;

    // Helper functions
    ///////////////////

    function onLoad() {
        // Slight delay on transition because otherwise a flicker is sometimes seen
        setTimeout(() => {
            //console.log('--------------- SET EMBED STATE TO preview')
            setEmbedState(DrawingEmbedState.preview);
            props.onReady();
        }, 100);
    }

    async function fetchFileData() {
        const { pageData } = await getInkFileData(props.plugin, props.drawingFile)
        if (pageData.previewUri) setFileSrc(pageData.previewUri)
        setLinkGroups(pageData.linkGroups ?? {});
        const { pageBounds, groups } = getLinkGroupBoundsFromSnapshot(pageData.tldraw, pageData.linkGroups);
        if (!pageBounds || pageBounds.width === 0 || pageBounds.height === 0) {
                setNormalizedBounds([]);
                return;
        }
        const normalized = groups.map((group) => ({
                groupId: group.groupId,
                rect: {
                        x: (group.bounds.minX - pageBounds.minX) / pageBounds.width,
                        y: (group.bounds.minY - pageBounds.minY) / pageBounds.height,
                        width: group.bounds.width / pageBounds.width,
                        height: group.bounds.height / pageBounds.height,
                },
        }));
        setNormalizedBounds(normalized);
    }

    function handleLinkGroupClick(event: React.MouseEvent<HTMLButtonElement>, groupId: string) {
            event.stopPropagation();
            if (!props.onLinkGroupClick) return;
            const link = linkGroups[groupId];
            if (!link) return;
            const anchor = event.currentTarget.getBoundingClientRect();
            props.onLinkGroupClick({
                    groupId,
                    link,
                    anchor,
                    bounds: null,
            });
    }

};



const LINK_GROUP_COLORS = [
        '#FF6B6B',
        '#4D96FF',
        '#6BCB77',
        '#FFC75F',
        '#A66DD4',
];

