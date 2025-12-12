import * as React from "react";
import { Editor } from "@tldraw/tldraw";
import { addNewLinkableGroupWithoutFile } from "../../utils/tldraw-linkable-helpers";

interface GroupAddFormProps {
    getTlEditor: () => Editor | undefined;
    onClose: () => void;
}

export const GroupAddForm = (props: GroupAddFormProps) => {
    const [formData, setFormData] = React.useState({
        groupName: "",
        groupColor: "red"
    });

    function handleFormChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    }

    function handleFormSubmit(e: React.FormEvent) {
        e.preventDefault();
        console.log("Form submitted:", formData);
        const editor = props.getTlEditor();
        if (editor) {
            const selectedShapeIds = editor.getSelectedShapeIds();
            console.log("Selected shapes:", selectedShapeIds);
            
            addNewLinkableGroupWithoutFile(
                editor,
                formData.groupName,
                formData.groupColor,
                selectedShapeIds
            );
        }
        
        // Reset form and close
        setFormData({
            groupName: "",
            groupColor: "red"
        });
        props.onClose();
    }

    function handleFormCancel(e: React.MouseEvent) {
        e.stopPropagation();
        props.onClose();
    }

    return (
        <form className="ink_group-info-panel__form" onSubmit={handleFormSubmit}>
            <div className="ink_group-info-panel__form-title">새 그룹 추가</div>
            
            <div className="ink_group-info-panel__form-field">
                <label>그룹 이름</label>
                <input 
                    type="text" 
                    name="groupName" 
                    value={formData.groupName} 
                    onChange={handleFormChange} 
                    placeholder="그룹 이름"
                    required
                />
            </div>

            <div className="ink_group-info-panel__form-field">
                <label>색상</label>
                <select 
                    name="groupColor" 
                    value={formData.groupColor} 
                    onChange={handleFormChange}
                >
                    <option value="black">Black</option>
                    <option value="blue">Blue</option>
                    <option value="green">Green</option>
                    <option value="red">Red</option>
                    <option value="yellow">Yellow</option>
                    <option value="violet">Violet</option>
                    <option value="grey">Grey</option>
                </select>
            </div>

            <div className="ink_group-info-panel__form-divider" />

            <div className="ink_group-info-panel__form-actions">
                <button type="button" onClick={handleFormCancel}>취소</button>
                <button type="submit" className="primary">추가</button>
            </div>
        </form>
    );
};
