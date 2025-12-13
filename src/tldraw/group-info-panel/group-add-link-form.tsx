import * as React from "react";
import { Editor } from "@tldraw/tldraw";
import {
	addFileToGroup,
	updateFileInGroup,
	checkDuplicateFile,
	LinkableFileEntry,
} from "../../utils/tldraw-linkable-helpers";
import InkPlugin from "../../main";
import { TFile } from "obsidian";

interface GroupAddLinkFormProps {
	getTlEditor: () => Editor | undefined;
	groupId: string;
	onClose: () => void;
	plugin: InkPlugin;
	initialData?: LinkableFileEntry;
}

export const GroupAddLinkForm = (props: GroupAddLinkFormProps) => {
	const isEditMode = !!props.initialData;
	const [formData, setFormData] = React.useState({
		fileName: props.initialData?.name || "",
		filePath: props.initialData?.path || "",
		fileLine: props.initialData?.line ? String(props.initialData.line) : "",
	});
	const [suggestions, setSuggestions] = React.useState<TFile[]>([]);
	const [showSuggestions, setShowSuggestions] = React.useState(false);

	function handleFormChange(e: React.ChangeEvent<HTMLInputElement>) {
		const { name, value } = e.target;
		setFormData((prev) => ({
			...prev,
			[name]: value,
		}));

		if (name === "filePath") {
			if (value.trim().length > 0) {
				const files = props.plugin.app.vault.getFiles();
				const matchedFiles = files
					.filter((file) =>
						file.path.toLowerCase().includes(value.toLowerCase())
					)
					.slice(0, 10); // Limit to 10 suggestions

				setSuggestions(matchedFiles);
				setShowSuggestions(true);
			} else {
				setSuggestions([]);
				setShowSuggestions(false);
			}
		}
	}

	function handleSuggestionClick(file: TFile) {
		setFormData((prev) => ({
			...prev,
			filePath: file.path,
			fileName: prev.fileName ? prev.fileName : file.basename,
		}));
		setSuggestions([]);
		setShowSuggestions(false);
	}

	function handleFormSubmit(e: React.FormEvent) {
		e.preventDefault();

		// 1. Validate mandatory fields
		if (!formData.filePath.trim()) {
			return; // required attribute handles UI, but good to be safe
		}

		const nameToSave = formData.fileName
			? formData.fileName
			: formData.filePath.split("/").pop()?.split(".")[0] || "Untitled";
		const pathToSave = formData.filePath;
		const lineToSave = formData.fileLine ? Number(formData.fileLine) : 1;

		const editor = props.getTlEditor();
		if (!editor) return;

		// 2. Duplicate Check using helper
		const isDuplicate = checkDuplicateFile(
			editor,
			props.groupId,
			{ name: nameToSave, path: pathToSave },
			isEditMode ? props.initialData!.id : undefined
		);

		if (isDuplicate) {
			// Simple alert for now, can be improved to UI error message
			alert(
				"이미 동일한 이름과 경로를 가진 파일이 이 그룹에 존재합니다."
			);
			return;
		}

		if (isEditMode && props.initialData) {
			updateFileInGroup(editor, props.groupId, props.initialData.id, {
				name: nameToSave,
				path: pathToSave,
				line: lineToSave,
			});
		} else {
			addFileToGroup(editor, props.groupId, {
				name: nameToSave,
				path: pathToSave,
				line: lineToSave,
			});
		}

		setFormData({
			fileName: "",
			filePath: "",
			fileLine: "",
		});
		props.onClose();
	}

	function handleFormCancel(e: React.MouseEvent) {
		e.stopPropagation();
		props.onClose();
	}

	// Close suggestions when clicking outside might be needed,
	// but for now relying on selection or empty input is okay for a simple version.

	return (
		<form
			className="ink_group-info-panel__form"
			onSubmit={handleFormSubmit}
		>
			<div className="ink_group-info-panel__form-title">
				{isEditMode ? "파일 수정" : "파일 추가"}
			</div>

			<div className="ink_group-info-panel__form-field">
				<label>파일 이름 (선택)</label>
				<input
					type="text"
					name="fileName"
					value={formData.fileName}
					onChange={handleFormChange}
					placeholder="표시할 파일 이름"
				/>
			</div>

			<div
				className="ink_group-info-panel__form-field"
				style={{ position: "relative" }}
			>
				<label>파일 경로</label>
				<input
					type="text"
					name="filePath"
					value={formData.filePath}
					onChange={handleFormChange}
					placeholder="vault/path/to/file.md"
					required
					autoComplete="off"
				/>
				{showSuggestions && suggestions.length > 0 && (
					<div className="ink_group-info-panel__suggestions">
						{suggestions.map((file) => (
							<div
								key={file.path}
								className="ink_group-info-panel__suggestion-item"
								onClick={() => handleSuggestionClick(file)}
							>
								{file.path}
							</div>
						))}
					</div>
				)}
			</div>

			<div className="ink_group-info-panel__form-field">
				<label>라인 번호 (선택)</label>
				<input
					type="text"
					name="fileLine"
					value={formData.fileLine}
					onChange={handleFormChange}
					placeholder="입력 없으면 첫 줄로 이동합니다."
				/>
			</div>

			<div className="ink_group-info-panel__form-actions">
				<button type="button" onClick={handleFormCancel}>
					취소
				</button>
				<button type="submit" className="primary">
					{isEditMode ? "수정" : "추가"}
				</button>
			</div>
		</form>
	);
};
