/* eslint-disable @typescript-eslint/no-unused-vars */
import "./group-info-panel.scss";
import * as React from "react";
import {createShapeId, Editor, TLPageId, TLShapeId} from "@tldraw/tldraw";
import {TFile, App, MarkdownView} from "obsidian";
import {
    getLinkableGroups,
    getLinkableGroupInfo,
    getShapesByLinkableGroup, highlightOn, TLColor, allHighlightOff, selectionCheck, LinkableFileEntry,
} from "src/utils/tldraw-linkable-helpers";
import {useAtomValue} from "jotai";
import InkPlugin, {inkPluginAtom} from "../../main";

interface GroupInfoPanelProps {
    getTlEditor: () => Editor | undefined;
    plugin: InkPlugin;
    groupUnmountRef: React.MutableRefObject<NodeJS.Timeout | undefined>;
}

export const GroupInfoPanel = (props: GroupInfoPanelProps) => {
    const [selectedGroups, setSelectedGroups] = React.useState<string[]>([]);
    const [highlightedGroup, setHighlightedGroup] = React.useState<string | null>(null);
    const [openFileListGroupId, setOpenFileListGroupId] = React.useState<string | null>(null);

    // const canvasContainerRef = React.useRef<HTMLDivElement>(null);
    let disposeCloneSync: React.MutableRefObject<(() => void) | undefined> = React.useRef<() => void>();

    const actionButtonStyle: React.CSSProperties = {
        background: "transparent",
        border: "none",
        height: "16px",
        fontSize: "12px",
        cursor: "pointer",
        padding: "0 6px",
        color: "#888",
        boxShadow: "none",
        borderRadius: "8px",
        position: "absolute",
        right: "18px",
    }

    React.useEffect(() => {
        let tlEditor: Editor;
        let removeListener: (() => void) | undefined;

        const mountDelayMs = 100;
        const timeoutId = setTimeout(() => {
            tlEditor = props.getTlEditor()!;
            if (!tlEditor) return;

            // Selection 변경 감지
            removeListener = tlEditor.store.listen(
                (entry) => {
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
                removeListener?.();
            }, mountDelayMs);

            // 초기 상태 업데이트
            updateSelectedGroups(tlEditor);
        }, mountDelayMs);

        return () => {
            clearTimeout(timeoutId);
        };
    }, []);

    function updateSelectedGroups(editor: Editor) {
        const selectedShapeIds = editor.getSelectedShapeIds();

        if (selectedShapeIds.length === 0) {
            setSelectedGroups([]);
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

    if (selectedGroups.length === 0) {
        return null;
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
        try {
            // 2. Leaf를 얻고 파일 열기
            // 실제 환경: const leaf = props.plugin.app.workspace.getLeaf(true); // 새 Leaf 또는 기존 Leaf
            // 모의 환경: Leaf 객체를 가정
            const leaf = props.plugin.app.workspace.getLeaf();

            // openFile이 완료될 때까지 기다림
            await leaf.openFile(file);

            // 3. 파일이 열린 Leaf의 View 객체를 통해 에디터 접근
            // Leaf가 완전히 파일을 로드한 후, view가 설정됩니다.
            const view = leaf.view;

            // view가 존재하고, 이 view가 'editor' 속성을 가진 MarkdownView라고 가정합니다.
            // Obsidian API에서 MarkdownView는 'editor' 속성으로 CodeMirror 인스턴스를 노출합니다.
            if (view && view.getViewType() === "markdown") {
                // 라인 번호는 UI에서는 보통 1부터 시작하지만, 에디터 API는 0부터 시작합니다.
                // line이 제공되지 않으면 기본값으로 1 (첫 번째 라인)을 사용합니다.
                const markdownView = view as MarkdownView;
                const targetLine = (linkableFile.line || 1);
                const lineIndex = targetLine - 1;

                const editor = markdownView.editor;

                // 4. 커서 위치 설정
                // setCursor(line: number, ch: number, options?: object)
                // lineIndex는 0부터 시작, ch: 0은 라인의 시작 위치
                editor.setCursor({ line: lineIndex, ch: 0 });

                // 5. 해당 라인이 보이도록 스크롤
                // scrollIntoView(position: Position, center?: boolean)
                // true를 전달하면 해당 위치가 뷰포트 중앙에 오도록 스크롤됩니다.
                editor.scrollIntoView(
                    { from: { line: lineIndex, ch: 0 }, to: { line: lineIndex, ch: 0 } },
                    true
                );

                // (선택 사항) 에디터에 포커스를 맞춥니다.
                editor.focus();

            } else {
                console.error("파일은 열렸으나, MarkdownView나 Editor 인스턴스를 찾을 수 없습니다.");
            }

        } catch (error) {
            console.error("파일을 여는 중 오류 발생:", error);
        }
    }


    return (
        <div className="ink_group-info-panel">
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
                                cursor: "pointer",
                            }}
                            onClick={() => handleGroupClick(groupId)}
                        >
                            {groupInfo?.name || groupId}
                            {isHighlighted && (
                                <button
                                    className="ink_group-info-panel__action-button"
                                    style={actionButtonStyle}
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
                                            style={{
                                                padding: "4px 8px",
                                                cursor: "pointer",
                                                borderTop: "1px solid #ddd",
                                            }}
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
        </div>
    );
};
