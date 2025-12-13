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
    getGroupsFromSelection,
} from "src/utils/tldraw-linkable-helpers";
import {useAtomValue} from "jotai";
import InkPlugin, {inkPluginAtom} from "../../main";
import { GroupAddForm } from "./group-add-form";
import { GroupAddLinkForm } from "./group-add-link-form";
import { GroupListIcon } from "src/graphics/icons/group-list-icon";
import { SmallCrossIcon } from "src/graphics/icons/small-cross-icon";
import { GroupInfoItem } from "./components/group-info-item";

interface GroupInfoPanelProps {
    getTlEditor: () => Editor | undefined;
    plugin: InkPlugin;
    groupUnmountRef: React.MutableRefObject<NodeJS.Timeout | undefined>;
}

export const GroupInfoPanel = (props: GroupInfoPanelProps) => {
    const [previousSelection, setPreviousSelection] = React.useState<TLShapeId[]>([]);
    const [isSelectionExist, setIsSelectionExist] = React.useState(false);
    const [selectedGroups, setSelectedGroups] = React.useState<string[]>([]);
    const [highlightedGroup, setHighlightedGroup] = React.useState<string | null>(null);
    const [addingFileToGroupId, setAddingFileToGroupId] = React.useState<string | null>(null);
    const [isCollapsed, setIsCollapsed] = React.useState(false);
    const [isAddFormOpen, setIsAddFormOpen] = React.useState(false);

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
        setIsAddFormOpen(false);
        setAddingFileToGroupId(null);
        const selectedShapeIds = editor.getSelectedShapeIds();

        console.log(selectedShapeIds);

        if (selectedShapeIds.length === 0) {
            // 선택된 쉐이프가 없으면 모든 그룹 표시
            setIsSelectionExist(false);
            const allPageGroups = getPageLinkableGroups(editor);
            setSelectedGroups(Object.keys(allPageGroups));
            return;
        }

        setIsSelectionExist(true);

        const groups = getGroupsFromSelection(editor);
        setSelectedGroups(groups);
    }

    function handleGroupClick(groupId: string) {
        const editor = props.getTlEditor();
        if (!editor) return;

        allHighlightOff(editor);
        disposeCloneSync.current?.();

        // 같은 그룹이면 하이라이트 제거
        if (highlightedGroup === groupId) {
            setHighlightedGroup(null);

            if(previousSelection.length == 0) {
                editor.selectNone();
            }
            // 이전 선택 상태 복원
            if (previousSelection.length > 0) {
                editor.setSelectedShapes(previousSelection);
                setPreviousSelection([]);
            }
            return;
        }

        // 새로운 그룹 선택 시, 현재 하이라이트 중이 아닐 때만 현재 선택 상태 저장
        // (그룹 간 전환 시에는 최초 선택 상태 유지를 위해 덮어쓰지 않음)
        if (highlightedGroup === null) {
            setPreviousSelection(editor.getSelectedShapeIds());
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
                setPreviousSelection([]); // 외부 요인으로 선택 해제 시 저장된 선택 상태 초기화
            });
        }
    }

    function getGroupInfo(groupId: string) {
        const editor = props.getTlEditor();
        if (!editor) return null;
        return getLinkableGroupInfo(editor, groupId);
    }


    function handleAddClick(e: React.MouseEvent) {
        e.stopPropagation();
        setIsAddFormOpen(true);
    }

    function handleAddFileClick(e: React.MouseEvent, groupId: string) {
        e.stopPropagation();
        setAddingFileToGroupId(groupId);
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

    // 하이라이트된 그룹이 있으면 그 그룹만 표시, 없으면 선택된 그룹들 표시
    const groupsDisplay = highlightedGroup ? [highlightedGroup] : selectedGroups;

    return (
        <div className="ink_group-info-panel">
            {isAddFormOpen ? (
                <GroupAddForm 
                    getTlEditor={props.getTlEditor} 
                    onClose={() => setIsAddFormOpen(false)} 
                />
            ) : addingFileToGroupId ? (
                <GroupAddLinkForm
                    getTlEditor={props.getTlEditor}
                    groupId={addingFileToGroupId}
                    onClose={() => setAddingFileToGroupId(null)}
                    plugin={props.plugin}
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
                        {groupsDisplay.map((groupId) => {
                            const groupInfo = getGroupInfo(groupId);
                            const isHighlighted = highlightedGroup === groupId;
                            const color = groupInfo?.color || "#FF0000";

                            return (
                                <GroupInfoItem
                                    key={groupId}
                                    groupId={groupId}
                                    groupName={groupInfo?.name || groupId}
                                    color={color as string}
                                    isHighlighted={isHighlighted}
                                    linkFiles={groupInfo?.link_files || []}
                                    onGroupClick={handleGroupClick}
                                    onAddFileClick={handleAddFileClick}
                                    onOpenFile={handleOpenFile}
                                />
                            );
                        })}
                    </div>
                    
                    {isSelectionExist && (
                        <div
                            className="ink_group-info-panel__add-button"
                            onClick={(e) => handleAddClick(e)}
                        >
                            추가하기
                        </div>
                    )}
                </>
            )}
        </div>
    );
};
