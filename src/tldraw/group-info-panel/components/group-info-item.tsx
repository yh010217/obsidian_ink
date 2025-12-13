import * as React from "react";
import { LinkableFileEntry } from "src/utils/tldraw-linkable-helpers";

interface GroupInfoItemProps {
    groupId: string;
    groupName: string;
    color: string;
    isHighlighted: boolean;
    linkFiles: LinkableFileEntry[];
    onGroupClick: (groupId: string) => void;
    onAddFileClick: (e: React.MouseEvent, groupId: string) => void;
    onOpenFile: (file: LinkableFileEntry, e: React.MouseEvent) => void;
}

export const GroupInfoItem = (props: GroupInfoItemProps) => {
    return (
        <div
            className={`ink_group-info-panel__item ${
                props.isHighlighted ? "ink_group-info-panel__item--highlighted" : ""
            }`}
            style={{
                borderLeft: `4px solid ${props.color}`,
            }}
            onClick={() => props.onGroupClick(props.groupId)}
        >
            {props.groupName || props.groupId}
            {props.isHighlighted && (
                <div className="ink_group-info-panel__item-actions">
                    <button
                        className="ink_group-info-panel__action-button"
                        onClick={(e) => props.onAddFileClick(e, props.groupId)}
                        title="파일 추가"
                    >
                        +
                    </button>
                </div>
            )}

            {props.isHighlighted && (
                <div className="ink_group-info-panel__file-list">
                    {(props.linkFiles || []).map((filePath, idx) => (
                        <div
                            key={idx}
                            className="ink_group-info-panel__file-item"
                            onClick={(e) => props.onOpenFile(filePath, e)}
                        >
                            {filePath.name}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
