import {createShapeId, Editor, TLEventMapHandler, TLShapeId, TLUnknownShape,} from "@tldraw/tldraw";


// tldraw 팔레트 예시
export type TLColor = 'black'|'blue'|'green'|'red'|'yellow'|'violet'|'grey'

export type LinkableFileEntry = {
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

    // TODO : all shapes의 각 shape에서 구하지 말고, groupId 로 group 내 shape 정보를 구할 수 있음.
    const allShapes = editor.getCurrentPageShapes();
    return allShapes.filter(shape => {
        const linkableGroups = (shape.meta?.linkableGroups as string[]) || [];
        return linkableGroups.includes(linkableGroupId);
    });
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

export function highlightOn(editor: Editor, ids: TLShapeId[], color: TLColor = 'red') : TLShapeId[]{
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
        const bothIds : TLShapeId[] = [...ids, ...clonedShapeIds];
        editor.select(...bothIds as TLShapeId);
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