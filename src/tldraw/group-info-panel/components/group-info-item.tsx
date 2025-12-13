import * as React from "react";
import InkPlugin from "src/main";
import { TFile } from "obsidian";
import { openFile, LinkableFileEntry } from "src/utils/tldraw-linkable-helpers";

interface GroupInfoItemProps {
    groupId: string;
    groupName: string;
    color: string;
    isHighlighted: boolean;
    linkFiles: LinkableFileEntry[];
    plugin: InkPlugin;
    onGroupClick: (groupId: string) => void;
    setAddingFileToGroupId: (groupId: string | null) => void;
}

export const GroupInfoItem = (props: GroupInfoItemProps) => {

    function handleAddFileClick(e: React.MouseEvent) {
        e.stopPropagation();
        props.setAddingFileToGroupId(props.groupId);
    }

    async function handleOpenFile(linkableFile: LinkableFileEntry, e: React.MouseEvent) {
        e.stopPropagation();
        const file = props.plugin.app.vault.getAbstractFileByPath(linkableFile.path);
        if(!file || !(file instanceof TFile)) return;
        const leaf = props.plugin.app.workspace.getLeaf();
        await openFile(linkableFile,file,leaf);
    }

    return (
        <div
            className={`ink_group-info-panel__item`}
            style={{
                borderLeft: `4px solid ${props.color}`,
            }}
            onClick={() => props.onGroupClick(props.groupId)}
        >
            {props.groupName || props.groupId}
            {props.isHighlighted && (
                <div className="ink_group-info-panel__file-list">
                    {(props.linkFiles || []).map((filePath, idx) => (
                        <div
                            key={idx}
                            className="ink_group-info-panel__file-item"
                            onClick={(e) => handleOpenFile(filePath, e)}
                        >
                            {filePath.name}
                        </div>
                    ))}
                    <button
                        className="ink_group-info-panel__action-button"
                        style={{boxShadow: "none"}}
                        onClick={(e) => handleAddFileClick(e)}
                        title="링크 추가"
                    >
                        링크 추가
                    </button>
                </div>
            )}
        </div>
    );
};
