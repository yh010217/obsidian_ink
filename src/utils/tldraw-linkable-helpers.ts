import { createShapeId, Editor, TLShapeId, TLUnknownShape, } from "@tldraw/tldraw";
import { MarkdownView, TFile, WorkspaceLeaf } from "obsidian";


// tldraw 팔레트 예시
export type TLColor = 'black' | 'blue' | 'green' | 'red' | 'yellow' | 'violet' | 'grey'

export type LinkableFileEntry = {
    id: string;           // 고유 ID
    name: string;         // UI용 표시 이름
    path: string;         // Obsidian Vault 내 상대 경로
    line?: number;        // 이동하려는 line 번호 (optional)
};

type LinkableGroup = {
    id: string;
    name?: string;
    color?: string;
    createdAt?: string;
    link_files?: LinkableFileEntry[];
    shapeIds?: TLShapeId[];
    [key: string]: any;  // 추가 메타데이터
};

type PageLinkableGroups = {
    [key: string]: LinkableGroup;
};

/**
 * Shape에서 linkableGroups를 읽습니다
 */
export function getLinkableGroups(editor: Editor, shapeId: TLShapeId): string[] {
    const shape = editor.getShape(shapeId);
    if (!shape) {
        return [];
    }
    return (shape.meta?.linkableGroups as string[]) || [];
}

/**
 * 특정 linkableGroup에 속한 모든 shape를 찾습니다
 */
export function getShapesByLinkableGroup(
    editor: Editor,
    linkableGroupId: string
): TLUnknownShape[] {
    const group = getLinkableGroupInfo(editor, linkableGroupId);
    if (!group || !group.shapeIds) {
        // fallback: shapeIds가 없으면 전체 스캔 (하위 호환성)
        const allShapes = editor.getCurrentPageShapes();
        return allShapes.filter(shape => {
            const linkableGroups = (shape.meta?.linkableGroups as string[]) || [];
            return linkableGroups.includes(linkableGroupId);
        });
    }
    
    return group.shapeIds
        .map(id => editor.getShape(id))
        .filter((shape): shape is TLUnknownShape => !!shape);
}

/**
 * 선택된 shape들의 모든 linkableGroup ID를 가져옵니다.
 * 중복된 ID는 제거되고 정렬되어 반환됩니다.
 * 
 * @param editor - tldraw editor 인스턴스
 * @returns 정렬된 unique한 group ID 배열
 */
export function getGroupsFromShapeIds(editor: Editor, shapeIds: TLShapeId[]): string[] {
    const groupSetByIds = new Set<string>();
    
    shapeIds.forEach((shapeId: TLShapeId) => {
        const groups = getLinkableGroups(editor, shapeId);
        groups.forEach((group) => groupSetByIds.add(group));
    });
    
    return Array.from(groupSetByIds).sort();
}

/**
 * 현재 페이지의 모든 linkableGroups를 가져옵니다
 */
export function getPageLinkableGroups(editor: Editor): PageLinkableGroups {
    const currentPageId = editor.getCurrentPageId();
    const page = editor.store.get(currentPageId);

    if (!page || page.typeName !== 'page') {
        return {};
    }

    return (page.meta?.linkableGroups as PageLinkableGroups) || {};
}

/**
 * 특정 linkableGroup의 정보를 가져옵니다
 */
export function getLinkableGroupInfo(
    editor: Editor,
    groupId: string
): LinkableGroup | null {
    const groups = getPageLinkableGroups(editor);
    return groups[groupId] || null;
}

export function highlightOn(editor: Editor, ids: TLShapeId[], color: TLColor = 'red'): TLShapeId[] {
    const clonedShapeIds: TLShapeId[] = [];
    editor.run(() => {
        ids.forEach((id) => {
            const s = editor.getShape(id)
            if (!s) return


            const cloneId = createShapeId()
            clonedShapeIds.push(cloneId)
            editor.createShape({
                id: cloneId,
                type: s.type,
                parentId: s.parentId,
                // index: topIndex(editor, s.parentId),
                x: (s as any).x,              // TLBaseShape 공통 필드
                y: (s as any).y,
                rotation: (s as any).rotation,
                isLocked: false,
                meta: { __hlSourceId: s.id }, // 역참조
                props: { ...s.props, color }, // 색만 바꾼다
            })

            // 원본에 클론 id 저장 (토글/정리용)
            editor.updateShape({
                id: s.id,
                type: s.type,
                meta: { ...s.meta, __hlCloneId: cloneId },
            });
        })

        // source, clone 둘다 select 되도록
        const bothIds: TLShapeId[] = [...ids, ...clonedShapeIds];
        editor.select(...bothIds);
    })
    return clonedShapeIds;
}

export function allHighlightOff(editor: Editor) {
    // meta에 __hlSourceId가 있는 shape 모두 찾기 - 클론들
    const allClonedShapes = editor.getCurrentPageShapes()
        .filter((s) => (s.meta as any)?.__hlSourceId);

    // clone의 원본 id 모으기
    const sourceIds = allClonedShapes.map((s) => (s.meta as any).__hlSourceId as TLShapeId);
    const sourceShapes = sourceIds.map((id) => editor.getShape(id)).filter((s): s is TLUnknownShape => !!s);

    editor.run(() => {
        // 클론 삭제하기
        allClonedShapes.forEach((s) => {
            editor.deleteShapes([s.id])
        })
        // 원본 메타 정리하기
        sourceShapes.forEach((s) => {
            const { __hlCloneId, ...restMeta } = (s.meta as any) ?? {}
            editor.updateShape({
                id: s.id,
                type: s.type,
                meta: Object.keys(restMeta).length ? restMeta : undefined,
            })
        });
    })
}

export function selectionCheck(
    editor: Editor,
    sourceIds: TLShapeId[],
    setHighlightOff: () => void
) {
    const sourceIdSet = new Set(sourceIds);
    let wasAllSelected = true;

    const dispose = editor.store.listen(
        () => {
            const selectedShapeIds = editor.getSelectedShapeIds();
            const selectedIdSet = new Set(selectedShapeIds);

            // 현재 모든 source가 선택되어 있는지
            const allSourcesSelected = Array.from(sourceIdSet).every(
                id => selectedIdSet.has(id)
            );

            // 이전에는 전부 선택되어 있었는데 지금은 아닌 경우
            if (wasAllSelected && !allSourcesSelected) {
                setHighlightOff();
                allHighlightOff(editor);
                return; // dispose 후 더 이상 실행 안 됨
            }

            wasAllSelected = allSourcesSelected;
        },
        { source: 'user' }
    );
    return dispose;
}

export async function openFile(linkableFile: LinkableFileEntry, file: TFile,leaf: WorkspaceLeaf){
    try {
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


export function addNewLinkableGroupWithoutFile(
    editor: Editor,
    groupName: string,
    color: string,
    selectedShapeIds: TLShapeId[]
) {
    // 간단한 ID 생성
    const groupId = 'group_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    
    const newGroup: LinkableGroup = {
        id: groupId,
        name: groupName,
        color: color,
        createdAt: new Date().toISOString(),
        link_files: [],
        shapeIds: selectedShapeIds
    };

    editor.run(() => {
        // 1. Update Page Meta
        const currentPageId = editor.getCurrentPageId();
        const page = editor.store.get(currentPageId);
        if (page && page.typeName === 'page') {
             const currentGroups = (page.meta?.linkableGroups as PageLinkableGroups) || {};
             editor.updatePage({
                 id: currentPageId,
                 meta: {
                     ...page.meta,
                     linkableGroups: {
                         ...currentGroups,
                         [groupId]: newGroup
                     }
                 }
             });
        }

        // 2. Update Shape Meta
        selectedShapeIds.forEach(id => {
            const shape = editor.getShape(id);
            if (!shape) return;
            const currentLinkableGroups = (shape.meta?.linkableGroups as string[]) || [];
            
            // 이미 존재하지 않는 경우에만 추가
            if (!currentLinkableGroups.includes(groupId)) {
                editor.updateShape({
                    id,
                    type: shape.type,
                    meta: {
                        ...shape.meta,
                        linkableGroups: [...currentLinkableGroups, groupId]
                    }
                });
            }
        });
    });
}

export function addFileToGroup(
    editor: Editor,
    groupId: string,
    fileData: { name?: string; path: string; line?: number }
) {
    // 랜덤 ID 생성
    const fileId = 'file_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);

    const linkFile: LinkableFileEntry = {
        id: fileId,
        name: fileData.name || fileData.path.split('/').pop() || 'Untitled',
        path: fileData.path,
        line: fileData.line
    };

    editor.run(() => {
        // 1. Update Page Meta
        const currentPageId = editor.getCurrentPageId();
        const page = editor.store.get(currentPageId);
        if (page && page.typeName === 'page') {
             const currentGroups = (page.meta?.linkableGroups as PageLinkableGroups) || {};
             const targetGroup = currentGroups[groupId];
             
             if (targetGroup) {
                 const newGroupData = {
                     ...targetGroup,
                     link_files: [...(targetGroup.link_files || []), linkFile]
                 };

                 editor.updatePage({
                     id: currentPageId,
                     meta: {
                         ...page.meta,
                         linkableGroups: {
                             ...currentGroups,
                             [groupId]: newGroupData
                         }
                     }
                 });
             }
        }
    });
}

export function updateLinkableGroup(
    editor: Editor,
    groupId: string,
    data: { name?: string; color?: string }
) {
    editor.run(() => {
        const currentPageId = editor.getCurrentPageId();
        const page = editor.store.get(currentPageId);
        if (page && page.typeName === 'page') {
            const currentGroups = (page.meta?.linkableGroups as PageLinkableGroups) || {};
            const targetGroup = currentGroups[groupId];

            if (targetGroup) {
                const newGroupData = {
                    ...targetGroup,
                    ...data
                };

                editor.updatePage({
                    id: currentPageId,
                    meta: {
                        ...page.meta,
                        linkableGroups: {
                            ...currentGroups,
                            [groupId]: newGroupData
                        }
                    }
                });
            }
        }
    });
}

export function updateFileInGroup(
    editor: Editor,
    groupId: string,
    fileId: string,
    updatedData: { name?: string; path?: string; line?: number }
) {
    editor.run(() => {
        const currentPageId = editor.getCurrentPageId();
        const page = editor.store.get(currentPageId);
        if (page && page.typeName === 'page') {
            const currentGroups = (page.meta?.linkableGroups as PageLinkableGroups) || {};
            const targetGroup = currentGroups[groupId];

            if (targetGroup && targetGroup.link_files) {
                const updatedFiles = targetGroup.link_files.map(file => {
                    if (file.id === fileId) {
                        return { ...file, ...updatedData };
                    }
                    return file;
                });

                const newGroupData = {
                    ...targetGroup,
                    link_files: updatedFiles
                };

                editor.updatePage({
                    id: currentPageId,
                    meta: {
                        ...page.meta,
                        linkableGroups: {
                            ...currentGroups,
                            [groupId]: newGroupData
                        }
                    }
                });
            }
        }
    });
}

export function checkDuplicateFile(
    editor: Editor,
    groupId: string,
    fileData: { name: string; path: string },
    excludeFileId?: string
): boolean {
    const groupInfo = getLinkableGroupInfo(editor, groupId);
    if (!groupInfo || !groupInfo.link_files) return false;

    return groupInfo.link_files.some(file => {
        if (excludeFileId && file.id === excludeFileId) return false;
        return file.name === fileData.name && file.path === fileData.path;
    });
}
