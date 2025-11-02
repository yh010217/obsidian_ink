import { TLEditorSnapshot } from '@tldraw/tldraw';
import { PLUGIN_VERSION, TLDRAW_VERSION } from 'src/constants';

///////
///////

type Metadata = {
        pluginVersion: string;
        tldrawVersion: string;
        previewIsOutdated?: boolean;
        transcript?: string;
};

export type LinkGroup = { target: string; meta?: Record<string, unknown> };
export type LinkGroupMap = Record<string, LinkGroup>;

export type InkFileData = {
        meta: Metadata;
        tldraw: TLEditorSnapshot;
        previewUri?: string;
        linkGroups?: LinkGroupMap;
};

// Primary functions
///////

export const buildWritingFileData = (props: {
        tlEditorSnapshot: TLEditorSnapshot,
        previewIsOutdated?: boolean;
        transcript?: string;
        previewUri?: string,
        linkGroups?: LinkGroupMap,
}): InkFileData => {

        return buildFileData(props);
}

export const buildDrawingFileData = (props: {
        tlEditorSnapshot: TLEditorSnapshot,
        previewIsOutdated?: boolean;
        previewUri?: string,
        linkGroups?: LinkGroupMap,
}): InkFileData => {

        return buildFileData(props);
}

const buildFileData = (props: {
        tlEditorSnapshot: TLEditorSnapshot,
        previewIsOutdated?: boolean;
        transcript?: string;
        previewUri?: string,
        linkGroups?: LinkGroupMap,
}): InkFileData => {

        const {
                tlEditorSnapshot: tlEditorSnapshot,
                previewUri,
                previewIsOutdated = false,
                linkGroups,
        } = props;

        let pageData: InkFileData = {
                meta: {
                        pluginVersion: PLUGIN_VERSION,
                        tldrawVersion: TLDRAW_VERSION,
                },
                tldraw: tlEditorSnapshot,
                linkGroups: linkGroups ?? {},
        }

        if(previewIsOutdated) pageData.meta.previewIsOutdated = previewIsOutdated;
        if(previewUri) pageData.previewUri = previewUri;

        return pageData;
};

export const stringifyPageData = (pageData: InkFileData): string => {
        return JSON.stringify(pageData, null, '\t');
}

const LINK_GROUPS_BACKFILL_FLAG = '__inkLinkGroupsBackfilled';

export const ensureLinkGroups = (pageData: InkFileData): InkFileData => {
        if(pageData.linkGroups) return pageData;

        const ensured: InkFileData & Record<string, unknown> = {
                ...pageData,
                linkGroups: {},
        };

        Object.defineProperty(ensured, LINK_GROUPS_BACKFILL_FLAG, {
                value: true,
                enumerable: false,
                configurable: true,
        });

        return ensured;
};

export const backfillLinkGroupsIfMissing = (pageData: InkFileData): { pageData: InkFileData; didBackfill: boolean } => {
        const ensured = ensureLinkGroups(pageData) as InkFileData & Record<string, unknown>;
        const didBackfill = Boolean(ensured[LINK_GROUPS_BACKFILL_FLAG]);

        if(didBackfill) {
                delete ensured[LINK_GROUPS_BACKFILL_FLAG];
        }

        return {
                pageData: ensured,
                didBackfill,
        };
};
