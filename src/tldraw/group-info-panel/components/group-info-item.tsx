import * as React from "react";
import { LinkableFileEntry } from "src/utils/tldraw-linkable-helpers";

interface GroupInfoItemProps {
    groupId: string;
    groupName: string;
    color: string;
    isHighlighted: boolean;
    openFileListGroupId: string | null;
    linkFiles: LinkableFileEntry[];
    onGroupClick: (groupId: string) => void;
    onAddFileClick: (e: React.MouseEvent, groupId: string) => void;
    onActionClick: (e: React.MouseEvent, groupId: string) => void;
    onOpenFile: (file: LinkableFileEntry, e: React.MouseEvent) => void;
}

export const GroupInfoItem = ({
    groupId,
    groupName,
    color,
    isHighlighted,
    openFileListGroupId,
    linkFiles,
    onGroupClick,
    onAddFileClick,
    onActionClick,
    onOpenFile,
}: GroupInfoItemProps) => {
    return (
        <div
            className={`ink_group-info-panel__item ${
                isHighlighted ? "ink_group-info-panel__item--highlighted" : ""
            }`}
            style={{
                borderLeft: `4px solid ${color}`,
            }}
            onClick={() => onGroupClick(groupId)}
        >
            {groupName || groupId}
            {isHighlighted && (
                <div className="ink_group-info-panel__item-actions">
                    <button
                        className="ink_group-info-panel__action-button"
                        onClick={(e) => onAddFileClick(e, groupId)}
                        title="파일 추가"
                    >
                        +
                    </button>
                    <button
                        className="ink_group-info-panel__action-button"
                        onClick={(e) => {
                            onActionClick(e, groupId);
                        }}
                    >
                        ⋮
                    </button>
                </div>
            )}

            {isHighlighted && openFileListGroupId === groupId && (
                <div className="ink_group-info-panel__file-list">
                    {(linkFiles || []).map((filePath, idx) => (
                        <div
                            key={idx}
                            className="ink_group-info-panel__file-item"
                            onClick={(e) => onOpenFile(filePath, e)}
                        >
                            {filePath.name}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
