/* eslint-disable @typescript-eslint/no-unused-vars */
import "./group-info-panel.scss";
import * as React from "react";
import {createShapeId, Editor, TLPageId, TLShapeId} from "@tldraw/tldraw";
import {TFile, App, MarkdownView} from "obsidian";
import {
    getLinkableGroups,
    getLinkableGroupInfo,
    getShapesByLinkableGroup, highlightOn, TLColor, allHighlightOff, selectionCheck, LinkableFileEntry,
    openFile,
    getPageLinkableGroups,
} from "src/utils/tldraw-linkable-helpers";
import {useAtomValue} from "jotai";
import InkPlugin, {inkPluginAtom} from "../../main";
import { GroupAddForm } from "./group-add-form";
import { GroupListIcon } from "src/graphics/icons/group-list-icon";
import { SmallCrossIcon } from "src/graphics/icons/small-cross-icon";

interface GroupInfoPanelProps {
    getTlEditor: () => Editor | undefined;
    plugin: InkPlugin;
    groupUnmountRef: React.MutableRefObject<NodeJS.Timeout | undefined>;
}

export const GroupInfoPanel = (props: GroupInfoPanelProps) => {
    const [selectedGroups, setSelectedGroups] = React.useState<string[]>([]);
    const [highlightedGroup, setHighlightedGroup] = React.useState<string | null>(null);
    const [openFileListGroupId, setOpenFileListGroupId] = React.useState<string | null>(null);
    const [isCollapsed, setIsCollapsed] = React.useState(false);

    // const canvasContainerRef = React.useRef<HTMLDivElement>(null);
    let disposeCloneSync: React.MutableRefObject<(() => void) | undefined> = React.useRef<() => void>();



    React.useEffect(() => {
        let tlEditor: Editor;
        let removeListener: (() => void) | undefined;

        const mountDelayMs = 100;
        const timeoutId = setTimeout(() => {
            tlEditor = props.getTlEditor()!;
            if (!tlEditor) return;

            // TODO : panel에서 
            tlEditor.selectNone();

            // Selection 변경 감지
            removeListener = tlEditor.store.listen(
                (entry) => {
                    // Changes 정보가 없으면 무시
                    if (!entry.changes) return;
                    updateSelectedGroups(tlEditor);
                },
                {
                    source: "all",
                    scope: "all",
                }
            );
            // unmount 시 cleanup 함수 전달
            props.groupUnmountRef.current = setTimeout(() => {
                allHighlightOff(tlEditor);
                disposeCloneSync.current?.();
            }, mountDelayMs);

            // 초기 상태 업데이트
            updateSelectedGroups(tlEditor);
        }, mountDelayMs);

        return () => {
            removeListener?.();
            clearTimeout(timeoutId);
        };
    }, []);

    function updateSelectedGroups(editor: Editor) {
        const selectedShapeIds = editor.getSelectedShapeIds();

        console.log(selectedShapeIds);

        if (selectedShapeIds.length === 0) {
            // 선택된 쉐이프가 없으면 모든 그룹 표시
            const allPageGroups = getPageLinkableGroups(editor);
            setSelectedGroups(Object.keys(allPageGroups));
            return;

        }

        // 모든 선택된 shape의 그룹 수집
        const allGroups = new Set<string>();
        selectedShapeIds.forEach((shapeId: TLShapeId) => {
            const groups = getLinkableGroups(editor, shapeId);
            groups.forEach((group) => allGroups.add(group));
        });

        setSelectedGroups(Array.from(allGroups).sort());
    }

    function handleGroupClick(groupId: string) {
        const editor = props.getTlEditor();
        if (!editor) return;

        allHighlightOff(editor);
        disposeCloneSync.current?.();

        // 같은 그룹이면 하이라이트 제거
        if (highlightedGroup === groupId) {
            setHighlightedGroup(null);
            return;
        }

        setHighlightedGroup(groupId);

        // 해당 그룹에 속한 shape들 선택
        const shapes = getShapesByLinkableGroup(editor, groupId);
        const shapeIds = shapes.map((shape) => shape.id as TLShapeId);

        if (shapeIds.length > 0) {
            // editor.setSelectedShapes(shapeIds);
            const groupInfo = getLinkableGroupInfo(editor, groupId);
            const color = groupInfo?.color as TLColor || "red";
            const cloneIds = highlightOn(editor, shapeIds, color);
            disposeCloneSync.current = selectionCheck(editor, shapeIds, () => {
                setHighlightedGroup(null);
            });
        }
    }


    function getGroupInfo(groupId: string) {
        const editor = props.getTlEditor();
        if (!editor) return null;
        return getLinkableGroupInfo(editor, groupId);
    }

    const [isAddFormOpen, setIsAddFormOpen] = React.useState(false);

    function handleAddClick(e: React.MouseEvent) {
        e.stopPropagation();
        setIsAddFormOpen(true);
    }

    function handleActionClick(e: React.MouseEvent, groupId: string) {
        e.stopPropagation();
        const editor = props.getTlEditor();
        if (!editor) return;
        const groupInfo = getLinkableGroupInfo(editor, groupId);
        setOpenFileListGroupId(prev => prev === groupId ? null : groupId);
    }

    async function handleOpenFile(linkableFile: LinkableFileEntry, e: React.MouseEvent) {
        e.stopPropagation();
        const file = props.plugin.app.vault.getAbstractFileByPath(linkableFile.path);
        if(!file || !(file instanceof TFile)) return;
        const leaf = props.plugin.app.workspace.getLeaf();
        await openFile(linkableFile,file,leaf);
    }

    if (isCollapsed) {
        return (
            <div 
                className="ink_group-info-panel ink_group-info-panel--collapsed ink_menu-bar ink_menu-bar_full" 
                onClick={() => setIsCollapsed(false)}
                title="Open Group Info"
            >
                <button className="ink_group-info-panel__collapsed-button"
                style={{boxShadow: 'none'}}
                >
                    <GroupListIcon/>
                </button>
            </div>
        );
    }

    return (
        <div className="ink_group-info-panel">
            {isAddFormOpen ? (
                <GroupAddForm 
                    getTlEditor={props.getTlEditor} 
                    onClose={() => setIsAddFormOpen(false)} 
                />
            ) : (
                <>
                
            <button 
                className="ink_group-info-panel__close-button"
                style={{boxShadow: 'none'}}
                onClick={() => setIsCollapsed(true)}
                title="Close"
            >
                <SmallCrossIcon/>
            </button>
                    <div className="ink_group-info-panel__title">그룹 정보</div>
                    <div className="ink_group-info-panel__list">
                        {selectedGroups.map((groupId) => {
                            const groupInfo = getGroupInfo(groupId);
                            const isHighlighted = highlightedGroup === groupId;
                            const color = groupInfo?.color || "#FF0000";

                            return (
                                <div
                                    key={groupId}
                                    className={`ink_group-info-panel__item ${
                                        isHighlighted
                                            ? "ink_group-info-panel__item--highlighted"
                                            : ""
                                    }`}
                                    style={{
                                        borderLeft: isHighlighted ? `4px solid ${color}` : '4px solid transparent',
                                    }}
                                    onClick={() => handleGroupClick(groupId)}
                                >
                                    {groupInfo?.name || groupId}
                                    {isHighlighted && (
                                        <button
                                            className="ink_group-info-panel__action-button"
                                            onClick={(e) => {
                                                handleActionClick(e, groupId);
                                            }}
                                        >
                                            ⋮
                                        </button>
                                    )}

                                    {isHighlighted && openFileListGroupId === groupId && (
                                        <div className="ink_group-info-panel__file-list">
                                            {(groupInfo?.link_files || []).map((filePath, idx) => (
                                                <div
                                                    key={idx}
                                                    className="ink_group-info-panel__file-item"
                                                    onClick={(e) => handleOpenFile(filePath, e)}
                                                >
                                                    {filePath.name}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    
                    <div
                        className="ink_group-info-panel__add-button"
                        onClick={(e) => handleAddClick(e)}
                    >
                        추가하기
                    </div>
                </>
            )}
        </div>
    );
};
