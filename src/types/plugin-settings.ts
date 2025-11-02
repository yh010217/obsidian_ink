////////
////////

export type LinkableInkRuleType = 'selected-text' | 'current-heading' | 'active-file';

export interface LinkableInkRule {
        type: LinkableInkRuleType;
}

export interface PluginSettings {
	// Helpers
    onboardingTips: {
		welcomeTipRead: boolean,
		strokeLimitTipRead: boolean,
		lastVersionTipRead: string,
	},
	// General
	customAttachmentFolders: boolean,
    noteAttachmentFolderLocation: 'obsidian' | 'root' | 'note',
    notelessAttachmentFolderLocation: 'obsidian' | 'root',
	writingSubfolder: string,
	drawingSubfolder: string,
        // Writing specific
        writingEnabled: boolean,
        writingStrokeLimit: number,
        writingDynamicStrokeThickness: boolean,
        writingSmoothing: boolean,
        writingLinesWhenLocked: boolean,
        writingBackgroundWhenLocked: boolean,
        linkableInkEnabled: boolean,
        linkableInkDefaultRules?: LinkableInkRule[],
        // Drawing specific
        drawingEnabled: boolean,
        drawingFrameWhenLocked: boolean,
        drawingBackgroundWhenLocked: boolean,
}

export const DEFAULT_LINKABLE_INK_RULES: LinkableInkRule[] = [
        { type: 'selected-text' },
        { type: 'current-heading' },
        { type: 'active-file' },
];

export const DEFAULT_SETTINGS: PluginSettings = {
	// Helpers
    onboardingTips: {
		welcomeTipRead: false,
		strokeLimitTipRead: false,
		lastVersionTipRead: '',
	},
	// General
	customAttachmentFolders: false,
    noteAttachmentFolderLocation: 'obsidian',
	notelessAttachmentFolderLocation: 'obsidian',
	writingSubfolder: 'Ink/Writing',
	drawingSubfolder: 'Ink/Drawing',
        // Writing specific
        writingEnabled: true,
        writingStrokeLimit: 200,
        writingDynamicStrokeThickness: true,
        writingSmoothing: false,
        writingLinesWhenLocked: true,
        writingBackgroundWhenLocked: true,
        linkableInkEnabled: false,
        linkableInkDefaultRules: DEFAULT_LINKABLE_INK_RULES,
        // Drawing specific
        drawingEnabled: true,
        drawingFrameWhenLocked: false,
        drawingBackgroundWhenLocked: false,
}

