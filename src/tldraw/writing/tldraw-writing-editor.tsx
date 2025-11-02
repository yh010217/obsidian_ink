import './tldraw-writing-editor.scss';
import { Box, Editor, HistoryEntry, StoreSnapshot, TLStoreSnapshot, TLRecord, TLShapeId, TLStore, TLUiOverrides, TLUnknownShape, Tldraw, getSnapshot, TLSerializedStore, TldrawOptions, TldrawEditor, defaultTools, defaultShapeTools, defaultShapeUtils, defaultBindingUtils, TldrawScribble, TldrawShapeIndicators, TldrawSelectionForeground, TldrawSelectionBackground, TldrawHandles, TLEditorSnapshot } from "@tldraw/tldraw";
import { useRef } from "react";
import { Activity, WritingCameraLimits, adaptTldrawToObsidianThemeMode, deleteObsoleteWritingTemplateShapes, focusChildTldrawEditor, getActivityType, getShapeLinkGroupId, getWritingContainerBounds, getWritingSvg, hideWritingContainer, hideWritingLines, hideWritingTemplate, initWritingCamera, initWritingCameraLimits, lockShape, prepareWritingSnapshot, preventTldrawCanvasesCausingObsidianGestures, resizeWritingTemplateInvitingly, restrictWritingCamera, silentlyChangeStore, unhideWritingContainer, unhideWritingLines, unhideWritingTemplate, unlockShape, updateWritingStoreIfNeeded, useStash } from "../../utils/tldraw-helpers";
import { WritingContainer, WritingContainerUtil } from "../writing-shapes/writing-container"
import { WritingMenu } from "../writing-menu/writing-menu";
import InkPlugin from "../../main";
import * as React from "react";
import { MENUBAR_HEIGHT_PX, WRITE_LONG_DELAY_MS, WRITE_SHORT_DELAY_MS, WRITING_LINE_HEIGHT, WRITING_MIN_PAGE_HEIGHT, WRITING_PAGE_WIDTH } from 'src/constants';
import { InkFileData, LinkGroupMap, buildWritingFileData } from 'src/utils/page-file';
import { TFile } from 'obsidian';
import { PrimaryMenuBar } from '../primary-menu-bar/primary-menu-bar';
import ExtendedWritingMenu from '../extended-writing-menu/extended-writing-menu';
import classNames from 'classnames';
import { WritingLines, WritingLinesUtil } from '../writing-shapes/writing-lines';
import { getAssetUrlsByMetaUrl } from '@tldraw/assets/urls';
import {getAssetUrlsByImport} from '@tldraw/assets/imports';
import { editorActiveAtom, WritingEmbedState, embedStateAtom } from './writing-embed';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { getInkFileData } from 'src/utils/getInkFileData';
import { verbose } from 'src/utils/log-to-console';
import { SecondaryMenuBar } from '../secondary-menu-bar/secondary-menu-bar';
import ModifyMenu from '../modify-menu/modify-menu';

///////
///////

interface TldrawWritingEditorProps {
	onResize?: Function,
	plugin: InkPlugin,
	writingFile: TFile,
	save: (inkFileData: InkFileData) => void,
	extendedMenu?: any[],

	// For embeds
	embedded?: boolean,
	resizeEmbedContainer?: (pxHeight: number) => void,
	closeEditor?: Function,
	saveControlsReference?: Function,
}

// Wraps the component so that it can full unmount when inactive
export const TldrawWritingEditorWrapper: React.FC<TldrawWritingEditorProps> = (props) => {
    const editorActive = useAtomValue(editorActiveAtom);

    if(editorActive) {
        return <TldrawWritingEditor {...props} />
    } else {
        return <></>
    }
}

const MyCustomShapes = [WritingContainerUtil, WritingLinesUtil];
const myOverrides: TLUiOverrides = {}
const tlOptions: Partial<TldrawOptions> = {
	defaultSvgPadding: 0,
}

export function TldrawWritingEditor(props: TldrawWritingEditorProps) {

        const [tlEditorSnapshot, setTlEditorSnapshot] = React.useState<TLEditorSnapshot>()
        const setEmbedState = useSetAtom(embedStateAtom);
        const shortDelayPostProcessTimeoutRef = useRef<NodeJS.Timeout>();
        const longDelayPostProcessTimeoutRef = useRef<NodeJS.Timeout>();
        const tlEditorRef = useRef<Editor>();
        const editorWrapperRefEl = useRef<HTMLDivElement>(null);
        const { stashStaleContent, unstashStaleContent } = useStash(props.plugin);
        const cameraLimitsRef = useRef<WritingCameraLimits>();
        const [preventTransitions, setPreventTransitions] = React.useState<boolean>(true);
        const linkGroupsRef = useRef<LinkGroupMap>({});
        const [, setLinkGroups] = React.useState<LinkGroupMap>({});
        const [isLinkPanelOpen, setIsLinkPanelOpen] = React.useState<boolean>(false);
        const [selectionGroups, setSelectionGroups] = React.useState<{ groupId: string; shapeIds: TLShapeId[] }[]>([]);

        const updateSelectionSummary = React.useCallback(() => {
                const editor = tlEditorRef.current;
                if (!editor) {
                        setSelectionGroups([]);
                        return;
                }

                const selectedIds = editor.getSelectedShapeIds();
                if (selectedIds.length === 0) {
                        setSelectionGroups([]);
                        return;
                }

                const grouped = new Map<string, TLShapeId[]>();
                selectedIds.forEach((id) => {
                        const shape = editor.getShape(id);
                        const groupId = getShapeLinkGroupId(shape);
                        if (!groupId) return;
                        const existing = grouped.get(groupId) ?? [];
                        existing.push(id as TLShapeId);
                        grouped.set(groupId, existing);
                });

                setSelectionGroups(Array.from(grouped.entries()).map(([groupId, shapeIds]) => ({ groupId, shapeIds })));
        }, []);

        const updateLinkGroups = React.useCallback((groups: LinkGroupMap) => {
                linkGroupsRef.current = groups;
                setLinkGroups(groups);
                updateSelectionSummary();
        }, [updateSelectionSummary]);

        const toggleLinkPanel = React.useCallback(() => {
                setIsLinkPanelOpen((prev) => !prev);
        }, []);

        React.useEffect(() => {
                const editor = tlEditorRef.current;
                if (!editor) return;

                updateSelectionSummary();
                const remove = editor.store.listen(() => {
                        updateSelectionSummary();
                }, { scope: 'session' });

                return () => remove();
        }, [tlEditorSnapshot, updateSelectionSummary]);

	// On mount
	React.useEffect( ()=> {
		verbose('EDITOR mounted');
		fetchFileData();
		return () => {
			verbose('EDITOR unmounting');
		}
	}, [])

	if(!tlEditorSnapshot) return <></>
	verbose('EDITOR snapshot loaded')

	////////

	const defaultComponents = {
		Scribble: TldrawScribble,
		ShapeIndicators: TldrawShapeIndicators,
		CollaboratorScribble: TldrawScribble,
		SelectionForeground: TldrawSelectionForeground,
		SelectionBackground: TldrawSelectionBackground,
		Handles: TldrawHandles,
	}

	const handleMount = (_editor: Editor) => {
		const editor = tlEditorRef.current = _editor;
		setEmbedState(WritingEmbedState.editor);
		focusChildTldrawEditor(editorWrapperRefEl.current);
		preventTldrawCanvasesCausingObsidianGestures(editor);

		resizeContainerIfEmbed(tlEditorRef.current);
		if(editorWrapperRefEl.current) {
			editorWrapperRefEl.current.style.opacity = '1';
		}

		updateWritingStoreIfNeeded(editor);
		
		// tldraw content setup
		adaptTldrawToObsidianThemeMode(editor);
		resizeWritingTemplateInvitingly(editor);
		resizeContainerIfEmbed(editor);	// Has an effect if the embed is new and started at 0
				
		// view set up
		if(props.embedded) {
			initWritingCamera(editor);
			editor.setCameraOptions({
				isLocked: true,
			})
		} else {
			initWritingCamera(editor, MENUBAR_HEIGHT_PX);
			cameraLimitsRef.current = initWritingCameraLimits(editor);
		}

		// Runs on any USER caused change to the store, (Anything wrapped in silently change method doesn't call this).
		const removeUserActionListener = editor.store.listen((entry) => {

			const activity = getActivityType(entry);
			switch (activity) {
				case Activity.PointerMoved:
					// REVIEW: Consider whether things are being erased
					break;

				case Activity.CameraMovedAutomatically:
				case Activity.CameraMovedManually:
					if(cameraLimitsRef.current) restrictWritingCamera(editor, cameraLimitsRef.current);
					unstashStaleContent(editor);
					break;

				case Activity.DrawingStarted:
					resetInputPostProcessTimers();
					stashStaleContent(editor);
					break;
					
				case Activity.DrawingContinued:
					resetInputPostProcessTimers();
					break;
							
				case Activity.DrawingCompleted:
					queueOrRunStorePostProcesses(editor);
					break;
					
				case Activity.DrawingErased:
					queueOrRunStorePostProcesses(editor);
					break;
					
				default:
					// Catch anything else not specifically mentioned (ie. draw shape, etc.)
					// queueOrRunStorePostProcesses(editor);
					verbose('Activity not recognised.');
					verbose(['entry', entry], {freeze: true});
			}

		}, {
			source: 'user',	// Local changes
			scope: 'all'	// Filters some things like camera movement changes. But Not sure it's locked down enough, so leaving as all.
		})

		const unmountActions = () => {
			// NOTE: This prevents the postProcessTimer completing when a new file is open and saving over that file.
			resetInputPostProcessTimers();
			removeUserActionListener();
		}

		if(props.saveControlsReference) {
			props.saveControlsReference({
				// save: () => completeSave(editor),
				saveAndHalt: async (): Promise<void> => {
					await completeSave(editor);
					unmountActions();	// Clean up immediately so nothing else occurs between this completeSave and a future unmount
				},
				resize: () => {
					const camera = editor.getCamera()
					const cameraY = camera.y;
					initWritingCamera(editor);
					editor.setCamera({x: camera.x, y: cameraY})
				}
			})
		}
		
		return () => {
			unmountActions();
		};
	}

	///////////////

	function resizeContainerIfEmbed (editor: Editor) {
		if (!props.embedded || !props.onResize) return;

		const embedBounds = editor.getViewportScreenBounds();
		const contentBounds = getWritingContainerBounds(editor);
		
		if (contentBounds) {
			const contentRatio = contentBounds.w / contentBounds.h;
			const newEmbedHeight = embedBounds.w / contentRatio;
			props.onResize(newEmbedHeight);
		}

	}

	const queueOrRunStorePostProcesses = (editor: Editor) => {
		instantInputPostProcess(editor);
		smallDelayInputPostProcess(editor);
		longDelayInputPostProcess(editor);
	}

	// Use this to run optimisations that that are quick and need to occur immediately on lifting the stylus
	const instantInputPostProcess = (editor: Editor) => { //, entry?: HistoryEntry<TLRecord>) => {
		resizeWritingTemplateInvitingly(editor);
		resizeContainerIfEmbed(editor);
		// entry && simplifyLines(editor, entry);
	};

	// Use this to run optimisations that take a small amount of time but should happen frequently
	const smallDelayInputPostProcess = (editor: Editor) => {
		resetShortPostProcessTimer();
		
		shortDelayPostProcessTimeoutRef.current = setTimeout(
			() => {
				incrementalSave(editor);
			},
			WRITE_SHORT_DELAY_MS
		)

	};

	// Use this to run optimisations after a slight delay
	const longDelayInputPostProcess = (editor: Editor) => {
		resetLongPostProcessTimer();
		
		longDelayPostProcessTimeoutRef.current = setTimeout(
			() => {
				completeSave(editor);
			},
			WRITE_LONG_DELAY_MS
		)

	};

	const resetShortPostProcessTimer = () => {
		clearTimeout(shortDelayPostProcessTimeoutRef.current);
	}
	const resetLongPostProcessTimer = () => {
		clearTimeout(longDelayPostProcessTimeoutRef.current);
	}
	const resetInputPostProcessTimers = () => {
		resetShortPostProcessTimer();
		resetLongPostProcessTimer();
	}

	const incrementalSave = async (editor: Editor) => {
		verbose('incrementalSave');
		unstashStaleContent(editor);
		const tlEditorSnapshot = getSnapshot(editor.store);
		stashStaleContent(editor);

                const pageData = buildWritingFileData({
                        tlEditorSnapshot: tlEditorSnapshot,
                        previewIsOutdated: true,
                        linkGroups: linkGroupsRef.current,
                })
                props.save(pageData);
        }

	const completeSave = async (editor: Editor): Promise<void> => {
		verbose('completeSave');
		let previewUri;
		
		unstashStaleContent(editor);
		const tlEditorSnapshot = getSnapshot(editor.store);
		const svgObj = await getWritingSvg(editor);
		stashStaleContent(editor);
		
		if (svgObj) {
			previewUri = svgObj.svg;//await svgToPngDataUri(svgObj)
			// if(previewUri) addDataURIImage(previewUri)	// NOTE: Option for testing
		}

		if(previewUri) {
                        const pageData = buildWritingFileData({
                                tlEditorSnapshot: tlEditorSnapshot,
                                previewUri,
                                linkGroups: linkGroupsRef.current,
                        })
                        props.save(pageData);
			// await savePngExport(props.plugin, previewUri, props.fileRef) // REVIEW: Still need a png?

		} else {
                        const pageData = buildWritingFileData({
                                tlEditorSnapshot: tlEditorSnapshot,
                                linkGroups: linkGroupsRef.current,
                        })
                        props.save(pageData);
		}

		return;
	}

	const getTlEditor = (): Editor | undefined => {
		return tlEditorRef.current;
	};

	//////////////

	return <>
		<div
			ref = {editorWrapperRefEl}
			className = {classNames([
				"ddc_ink_writing-editor",
			])}
			style={{
				height: '100%',
				position: 'relative',
				opacity: 0, // So it's invisible while it loads
			}}
		>
			<TldrawEditor
				options = {tlOptions}
				shapeUtils = {[...defaultShapeUtils, ...MyCustomShapes]}
				tools = {[...defaultTools, ...defaultShapeTools]}
				initialState = "draw"
				snapshot = {tlEditorSnapshot}
				// persistenceKey = {props.fileRef.path}

				// bindingUtils = {defaultBindingUtils}
				components = {defaultComponents}

				onMount = {handleMount}

				// Prevent autoFocussing so it can be handled in the handleMount
				autoFocus = {false}
			/>

                        <PrimaryMenuBar>
                                <WritingMenu
                                        getTlEditor = {getTlEditor}
                                        onStoreChange = {(tlEditor: Editor) => queueOrRunStorePostProcesses(tlEditor)}
                                        onToggleLinksPanel = {toggleLinkPanel}
                                />
                                {props.embedded && props.extendedMenu && (
                                        <ExtendedWritingMenu
                                                onLockClick = { async () => {
                                                        // REVIEW: Save immediately? incase it hasn't been saved yet
							if(props.closeEditor) props.closeEditor();
						}}
						menuOptions = {props.extendedMenu}
					/>
				)}
			</PrimaryMenuBar>

                        <SecondaryMenuBar>
                                <ModifyMenu
                                        getTlEditor = {getTlEditor}
                                        onStoreChange = {(tlEditor: Editor) => queueOrRunStorePostProcesses(tlEditor)}
                                />
                        </SecondaryMenuBar>

                        <LinkGroupPanel
                                isOpen = {isLinkPanelOpen}
                                onClose = {() => setIsLinkPanelOpen(false)}
                                linkGroups = {linkGroupsRef.current}
                                selectionGroups = {selectionGroups}
                                editor = {tlEditorRef.current}
                        />

                </div>
        </>;


        // Helper functions
        ///////////////////

interface LinkGroupPanelProps {
        isOpen: boolean;
        onClose: () => void;
        linkGroups: LinkGroupMap;
        selectionGroups: { groupId: string; shapeIds: TLShapeId[] }[];
        editor?: Editor;
}

function LinkGroupPanel({ isOpen, onClose, linkGroups, selectionGroups, editor }: LinkGroupPanelProps) {
        if (!isOpen) return <></>;

        return (
                <div className="ddc_ink_link-panel">
                        <div className="ddc_ink_link-panel__header">
                                <span>Links</span>
                                <button type="button" onClick={onClose} aria-label="Close link panel">
                                        ×
                                </button>
                        </div>
                        <div className="ddc_ink_link-panel__content">
                                {selectionGroups.length === 0 && (
                                        <p className="ddc_ink_link-panel__empty">Select a linked shape to view details.</p>
                                )}

                                {selectionGroups.map(({ groupId, shapeIds }) => {
                                        const group = linkGroups[groupId];
                                        if (!group) return null;

                                        const bounds = editor ? getBoundsForShapes(editor, shapeIds) : null;
                                        return (
                                                <div className="ddc_ink_link-panel__item" key={groupId}>
                                                        <div className="ddc_ink_link-panel__item-header">
                                                                <span className="ddc_ink_link-panel__item-label">{group.target}</span>
                                                                <span className="ddc_ink_link-panel__item-count">{shapeIds.length} shapes</span>
                                                        </div>
                                                        {bounds && (
                                                                <div className="ddc_ink_link-panel__item-bounds">
                                                                        Bounds: {Math.round(bounds.width)}×{Math.round(bounds.height)} px
                                                                </div>
                                                        )}
                                                        {group.meta && (
                                                                <pre className="ddc_ink_link-panel__item-meta">{JSON.stringify(group.meta, null, 2)}</pre>
                                                        )}
                                                        <div className="ddc_ink_link-panel__item-actions">
                                                                <button type="button" disabled>Edit</button>
                                                                <button type="button" disabled>Remove</button>
                                                        </div>
                                                </div>
                                        );
                                })}
                        </div>
                </div>
        );
}

function getBoundsForShapes(editor: Editor, shapeIds: TLShapeId[]): Box | null {
        let combined: Box | null = null;
        shapeIds.forEach((shapeId) => {
                const bounds = editor.getShapePageBounds(shapeId);
                if (!bounds) return;
                if (!combined) {
                        combined = new Box(bounds.minX, bounds.minY, bounds.width, bounds.height);
                } else {
                        combined.expand(bounds);
                }
        });
        return combined;
}

    async function fetchFileData() {
        const { pageData, didBackfill } = await getInkFileData(props.plugin, props.writingFile)
        if(didBackfill) {
            props.save(pageData);
        }
        updateLinkGroups(pageData.linkGroups ?? {});
        if(pageData.tldraw) {
            const snapshot = prepareWritingSnapshot(pageData.tldraw as TLEditorSnapshot);
            setTlEditorSnapshot(snapshot);
        }
    }

};



