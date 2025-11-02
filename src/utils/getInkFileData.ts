import { TFile } from "obsidian";
import InkPlugin from "src/main";
import { InkFileData, backfillLinkGroupsIfMissing } from "./page-file";

export type GetInkFileDataResult = {
        pageData: InkFileData;
        didBackfill: boolean;
};

/////////
/////////

export async function getInkFileData(plugin: InkPlugin, file: TFile): Promise<GetInkFileDataResult> {
        const v = plugin.app.vault;
        const inkFileDataStr = await v.read(file);
        const inkFileData = JSON.parse(inkFileDataStr) as InkFileData;
        return backfillLinkGroupsIfMissing(inkFileData);
}
