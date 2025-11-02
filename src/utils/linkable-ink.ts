import { Editor, EditorPosition, MarkdownView } from 'obsidian';
import InkPlugin from 'src/main';
import { LinkGroup } from './page-file';
import { DEFAULT_LINKABLE_INK_RULES, LinkableInkRule } from 'src/types/plugin-settings';

////////
////////

export function computeLinkableInkTarget(plugin: InkPlugin, rules?: LinkableInkRule[]): LinkGroup | null {
        if (!plugin.settings.linkableInkEnabled) {
                return null;
        }

        const view = plugin.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view) {
                return null;
        }

        const candidates = resolveRuleOrder(plugin, rules);

        for (const rule of candidates) {
                switch (rule.type) {
                        case 'selected-text': {
                                const selectionTarget = buildSelectionTarget(view);
                                if (selectionTarget) {
                                        return selectionTarget;
                                }
                                break;
                        }
                        case 'current-heading': {
                                const headingTarget = buildHeadingTarget(view);
                                if (headingTarget) {
                                        return headingTarget;
                                }
                                break;
                        }
                        case 'active-file': {
                                const fileTarget = buildFileTarget(view);
                                if (fileTarget) {
                                        return fileTarget;
                                }
                                break;
                        }
                        default:
                                break;
                }
        }

        return null;
}

function resolveRuleOrder(plugin: InkPlugin, rules?: LinkableInkRule[]): LinkableInkRule[] {
        if (rules && rules.length) {
                return rules;
        }

        if (plugin.settings.linkableInkDefaultRules && plugin.settings.linkableInkDefaultRules.length) {
                return plugin.settings.linkableInkDefaultRules;
        }

        return DEFAULT_LINKABLE_INK_RULES;
}

function buildSelectionTarget(view: MarkdownView): LinkGroup | null {
        const editor = view.editor;
        const selection = editor.getSelection();
        if (!selection || !selection.trim()) {
                return null;
        }

        const trimmed = selection.trim();
        const from = editor.getCursor('from');
        const to = editor.getCursor('to');

        return {
                target: trimmed,
                meta: {
                        rule: 'selected-text',
                        filePath: view.file?.path,
                        selection: trimmed,
                        from: clonePosition(from),
                        to: clonePosition(to),
                },
        };
}

function buildHeadingTarget(view: MarkdownView): LinkGroup | null {
        const editor = view.editor;
        const heading = findCurrentHeading(editor);
        if (!heading) {
                return null;
        }

        const filePath = view.file?.path;
        const target = filePath ? `[[${filePath}#${heading.text}]]` : heading.text;

        return {
                target,
                meta: {
                        rule: 'current-heading',
                        filePath,
                        heading: heading.text,
                        headingLevel: heading.level,
                        headingLine: heading.line,
                },
        };
}

function buildFileTarget(view: MarkdownView): LinkGroup | null {
        const file = view.file;
        if (!file) {
                return null;
        }

        return {
                target: `[[${file.path}]]`,
                meta: {
                        rule: 'active-file',
                        filePath: file.path,
                        fileName: file.name,
                },
        };
}

function findCurrentHeading(editor: Editor): { text: string; level: number; line: number } | null {
        const cursor = editor.getCursor();

        for (let line = cursor.line; line >= 0; line--) {
                const lineText = editor.getLine(line);
                if (!lineText) {
                        continue;
                }

                const match = lineText.match(/^(#{1,6})\s+(.*)$/);
                if (!match) {
                        continue;
                }

                const level = match[1].length;
                const text = match[2].trim();
                if (!text) {
                        continue;
                }

                return { text, level, line };
        }

        return null;
}

function clonePosition(position: EditorPosition): EditorPosition {
        return { line: position.line, ch: position.ch };
}

