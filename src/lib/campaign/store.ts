import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type CampaignRecord = {
  campaignId: string;
  productUrl: string;
  createdAt: string;
  updatedAt: string;
  status: "planning" | "testing" | "learning";
  hypothesis: unknown;
  posts: Array<{
    platform: string;
    postId: string;
    url?: string;
    publishedAt?: string;
  }>;
  performance: unknown[];
};

function campaignPath(campaignId: string) {
  return path.join(process.cwd(), "generated", "campaigns", `${campaignId}.json`);
}

export async function saveCampaign(record: CampaignRecord) {
  const file = campaignPath(record.campaignId);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(record, null, 2), "utf8");
  return file;
}

export async function loadCampaign(campaignId: string) {
  try {
    return JSON.parse(await readFile(campaignPath(campaignId), "utf8")) as CampaignRecord;
  } catch {
    return null;
  }
}

export function createCampaignId() {
  return `campaign-${Date.now()}`;
}
