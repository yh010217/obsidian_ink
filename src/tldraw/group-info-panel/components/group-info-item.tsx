import * as React from "react";
import InkPlugin from "src/main";
import { TFile } from "obsidian";
import { openFile, LinkableFileEntry } from "src/utils/tldraw-linkable-helpers";
import { SimpleEditIcon } from "src/graphics/icons/simple-edit-icon";

interface GroupInfoItemProps {
	groupId: string;
	groupName: string;
	color: string;
	isHighlighted: boolean;
	linkFiles: LinkableFileEntry[];
	plugin: InkPlugin;
	onGroupClick: (groupId: string) => void;
	setAddingFileToGroupId: (groupId: string | null) => void;
	onEditFile: (groupId: string, file: LinkableFileEntry) => void;
	onEditGroup: (groupId: string) => void;
}

export const GroupInfoItem = (props: GroupInfoItemProps) => {
	function handleAddFileClick(e: React.MouseEvent) {
		e.stopPropagation();
		props.setAddingFileToGroupId(props.groupId);
	}

	async function handleOpenFile(
		linkableFile: LinkableFileEntry,
		e: React.MouseEvent
	) {
		e.stopPropagation();
		const file = props.plugin.app.vault.getAbstractFileByPath(
			linkableFile.path
		);
		if (!file || !(file instanceof TFile)) return;
		const leaf = props.plugin.app.workspace.getLeaf();
		await openFile(linkableFile, file, leaf);
	}

	function handleEditFileClick(e: React.MouseEvent, file: LinkableFileEntry) {
		e.stopPropagation();
		props.onEditFile(props.groupId, file);
	}

	function handleEditGroupClick(e: React.MouseEvent) {
		e.stopPropagation();
		props.onEditGroup(props.groupId);
	}

	return (
		<div
			className={`ink_group-info-panel__item`}
			style={{
				borderLeft: `4px solid ${props.color}`,
			}}
			onClick={() => props.onGroupClick(props.groupId)}
		>
			<div
				style={{
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
				}}
			>
				<span>{props.groupName || props.groupId}</span>
				{props.isHighlighted && (
					<button
						className="ink_group-info-panel__item-action"
						style={{
							boxShadow: "none",
							backgroundColor: "transparent",
						}}
						onClick={handleEditGroupClick}
						title="그룹 수정"
					>
						<SimpleEditIcon />
					</button>
				)}
			</div>
			{props.isHighlighted && (
				<div className="ink_group-info-panel__file-list">
					{(props.linkFiles || []).map((linkFile, idx) => (
						<div
							key={linkFile.id || idx}
							className="ink_group-info-panel__file-item"
							onClick={(e) => handleOpenFile(linkFile, e)}
							style={{
								display: "flex",
								justifyContent: "space-between",
								alignItems: "center",
							}}
						>
							<span
								style={{
									overflow: "hidden",
									textOverflow: "ellipsis",
									whiteSpace: "nowrap",
								}}
							>
								{linkFile.name}
							</span>
							<button
								className="ink_group-info-panel__item-action"
								style={{
									boxShadow: "none",
									backgroundColor: "transparent",
								}}
								onClick={(e) =>
									handleEditFileClick(e, linkFile)
								}
								title="수정"
							>
								<SimpleEditIcon />
							</button>
						</div>
					))}
					<button
						className="ink_group-info-panel__action-button"
						style={{ boxShadow: "none" }}
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
