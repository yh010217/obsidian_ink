/* eslint-disable @typescript-eslint/no-unused-vars */
import "./group-info-panel.scss";
import * as React from "react";
import {createShapeId, Editor, TLPageId, TLShapeId} from "@tldraw/tldraw";
import {
    getLinkableGroups,
    getLinkableGroupInfo,
    getShapesByLinkableGroup, highlightOn, TLColor, allHighlightOff, selectionCheck,
} from "src/utils/tldraw-linkable-helpers";

interface GroupInfoPanelProps {
    getTlEditor: () => Editor | undefined;
    groupUnmountRef: React.MutableRefObject<NodeJS.Timeout | undefined>;
}

export const GroupInfoPanel = (props: GroupInfoPanelProps) => {
    const [selectedGroups, setSelectedGroups] = React.useState<string[]>([]);
    const [highlightedGroup, setHighlightedGroup] = React.useState<
        string | null
        >(null);
    // const canvasContainerRef = React.useRef<HTMLDivElement>(null);
    let disposeCloneSync: React.MutableRefObject<(() => void) | undefined> = React.useRef<() => void>();

    React.useEffect(() => {
        let tlEditor : Editor;
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
            props.groupUnmountRef.current = setTimeout(() =>  {
                allHighlightOff(tlEditor);
                disposeCloneSync.current?.();
                removeListener?.();
            },mountDelayMs);

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
            disposeCloneSync.current = selectionCheck(editor, shapeIds,()=>{setHighlightedGroup(null);});
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
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
