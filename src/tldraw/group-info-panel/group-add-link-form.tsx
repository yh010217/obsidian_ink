import * as React from "react";
import { Editor } from "@tldraw/tldraw";
import { addFileToGroup } from "../../utils/tldraw-linkable-helpers";

interface GroupAddLinkFormProps {
    getTlEditor: () => Editor | undefined;
    groupId: string;
    onClose: () => void;
}

export const GroupAddLinkForm = (props: GroupAddLinkFormProps) => {
    const [formData, setFormData] = React.useState({
        fileName: "",
        filePath: "",
        fileLine: 1
    });

    function handleFormChange(e: React.ChangeEvent<HTMLInputElement>) {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    }

    function handleFormSubmit(e: React.FormEvent) {
        e.preventDefault();
        const editor = props.getTlEditor();
        if (editor) {
            addFileToGroup(
                editor,
                props.groupId,
                {
                    name: formData.fileName,
                    path: formData.filePath,
                    line: Number(formData.fileLine)
                }
            );
        }
        
        setFormData({
            fileName: "",
            filePath: "",
            fileLine: 1
        });
        props.onClose();
    }

    function handleFormCancel(e: React.MouseEvent) {
        e.stopPropagation();
        props.onClose();
    }

    return (
        <form className="ink_group-info-panel__form" onSubmit={handleFormSubmit}>
            <div className="ink_group-info-panel__form-title">파일 추가</div>
            
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

            <div className="ink_group-info-panel__form-field">
                <label>파일 경로</label>
                <input 
                    type="text" 
                    name="filePath" 
                    value={formData.filePath} 
                    onChange={handleFormChange} 
                    placeholder="vault/path/to/file.md"
                    required
                />
            </div>

            <div className="ink_group-info-panel__form-field">
                <label>라인 번호 (선택)</label>
                <input 
                    type="number" 
                    name="fileLine" 
                    value={formData.fileLine} 
                    onChange={handleFormChange} 
                    min="1"
                    placeholder="1"
                />
            </div>

            <div className="ink_group-info-panel__form-actions">
                <button type="button" onClick={handleFormCancel}>취소</button>
                <button type="submit" className="primary">추가</button>
            </div>
        </form>
    );
};
