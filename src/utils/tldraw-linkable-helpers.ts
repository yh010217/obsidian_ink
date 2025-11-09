import {createShapeId, Editor, TLShapeId, TLUnknownShape,} from "@tldraw/tldraw";
import { debug, warn, info, error, http, verbose } from "./log-to-console";


// tldraw 팔레트 예시
export type TLColor = 'black'|'blue'|'green'|'red'|'yellow'|'violet'|'grey'

type LinkableGroup = {
    id: string;
    name?: string;
    color?: string;
    createdAt?: string;
    [key: string]: any;  // 추가 메타데이터
};

type PageLinkableGroups = {
    [key: string]: LinkableGroup;
};


/**
 * Shape에 linkableGroups를 설정합니다
 */
export function setLinkableGroups(
    editor: Editor,
    shapeId: TLShapeId,
    linkableGroups: string[]
) {
    const shape = editor.getShape(shapeId);
    if (!shape) {
        warn(`Shape not found: ${shapeId}`);
        return;
    }

    editor.updateShape({
        id: shapeId,
        type: shape.type,
        meta: {
            ...shape.meta,
            linkableGroups: linkableGroups
        }
    });
}

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
 * Shape에 linkableGroup을 추가합니다 (중복 체크)
 */
export function addLinkableGroup(
    editor: Editor,
    shapeId: TLShapeId,
    linkableGroupId: string
) {
    const currentGroups = getLinkableGroups(editor, shapeId);
    if (!currentGroups.includes(linkableGroupId)) {
        setLinkableGroups(editor, shapeId, [...currentGroups, linkableGroupId]);
    }
}

/**
 * Shape에서 linkableGroup을 제거합니다
 */
export function removeLinkableGroup(
    editor: Editor,
    shapeId: TLShapeId,
    linkableGroupId: string
) {
    const currentGroups = getLinkableGroups(editor, shapeId);
    setLinkableGroups(editor, shapeId, currentGroups.filter(id => id !== linkableGroupId));
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
 * 페이지에 linkableGroup을 추가/업데이트합니다
 */
export function setPageLinkableGroup(
    editor: Editor,
    groupId: string,
    groupData: LinkableGroup
) {
    const currentPageId = editor.getCurrentPageId();
    const page = editor.store.get(currentPageId);

    if (!page || page.typeName !== 'page') {
        warn(`Page not found: ${currentPageId}`);
        return;
    }

    const currentGroups = getPageLinkableGroups(editor);
    const updatedGroups: PageLinkableGroups = {
        ...currentGroups,
        [groupId]: {
            ...groupData,
            id: groupId,  // ID는 항상 확실하게 설정
        }
    };

    editor.store.update(currentPageId, (record) => {
        return {
            ...record,
            meta: {
                ...record.meta,
                linkableGroups: updatedGroups
            }
        };
    });
}

/**
 * 페이지에서 linkableGroup을 제거합니다
 */
export function removePageLinkableGroup(editor: Editor, groupId: string) {
    const currentPageId = editor.getCurrentPageId();
    const page = editor.store.get(currentPageId);

    if (!page || page.typeName !== 'page') {
        warn(`Page not found: ${currentPageId}`);
        return;
    }

    const currentGroups = getPageLinkableGroups(editor);
    const { [groupId]: removed, ...updatedGroups } = currentGroups;

    // 해당 그룹을 참조하는 모든 shape의 linkableGroups에서도 제거
    const allShapes = editor.getCurrentPageShapes();
    allShapes.forEach(shape => {
        const shapeGroups = getLinkableGroups(editor, shape.id as TLShapeId);
        if (shapeGroups.includes(groupId)) {
            removeLinkableGroup(editor, shape.id as TLShapeId, groupId);
        }
    });

    editor.store.update(currentPageId, (record) => {
        return {
            ...record,
            meta: {
                ...record.meta,
                linkableGroups: updatedGroups
            }
        };
    });
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

/**
 * 그룹 ID로 그룹 이름을 가져옵니다
 */
export function getLinkableGroupName(editor: Editor, groupId: string): string {
    const group = getLinkableGroupInfo(editor, groupId);
    return group?.name || groupId;
}


export function highlightOn(editor: Editor, ids: TLShapeId[], color: TLColor = 'red') {
    editor.run(() => {
        ids.forEach((id) => {
            const s = editor.getShape(id)
            if (!s) return


            const cloneId = createShapeId()
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
            })
        })
    })
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