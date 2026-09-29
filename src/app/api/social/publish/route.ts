import { NextResponse } from "next/server";
import { publishTikTokVideo } from "@/lib/social/tiktok";
import { publishInstagramReel, publishFacebookReel } from "@/lib/social/meta";
import { uploadYouTubeVideo } from "@/lib/social/youtube";
import { publishXPost } from "@/lib/social/x";
import { createLinkedInVideoPost, decryptLinkedInToken } from "@/lib/linkedin";
import { getAdminSupabase, getUserFromBearer } from "@/lib/billing";
import { writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

export const runtime = "nodejs";
export const maxDuration = 300;

type Platform = "tiktok" | "instagram" | "facebook" | "youtube" | "x" | "linkedin";

export async function POST(request: Request) {
  try {
    const user = await getUserFromBearer(request);
    if (!user) return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });
    const body = await request.json();
    const socialPostId = typeof body.socialPostId === "string" ? body.socialPostId.trim() : "";
    const videoUrl = typeof body.videoUrl === "string" ? body.videoUrl.trim() : "";
    const caption = typeof body.caption === "string" ? body.caption.trim() : "";
    const platforms = Array.isArray(body.platforms)
      ? body.platforms.filter((v: unknown): v is Platform => ["tiktok","instagram","facebook","youtube","x","linkedin"].includes(String(v)))
      : [];
    if (!socialPostId) return NextResponse.json({ error: "socialPostIdが必要です。" }, { status: 400 });
    if (!videoUrl.startsWith("https://")) return NextResponse.json({ error: "完成動画のHTTPS URLが必要です。" }, { status: 400 });
    if (!caption) return NextResponse.json({ error: "投稿本文が必要です。" }, { status: 400 });
    if (!platforms.length) return NextResponse.json({ error: "投稿先を1つ以上選択してください。" }, { status: 400 });

    const supabase = getAdminSupabase();
    const { data: source, error: sourceError } = await supabase.from("social_posts")
      .select("id,creative_id").eq("id", socialPostId).eq("user_id", user.id).maybeSingle();
    if (sourceError) throw sourceError;
    if (!source) return NextResponse.json({ error: "対象のテスト投稿が見つかりません。" }, { status: 404 });

    const results: Array<{platform:string;ok:boolean;postId?:string;url?:string;error?:string}> = [];
    let tempFile = "";
    let videoBuffer: Uint8Array | null = null;
    const getVideoBuffer = async () => {
      if (videoBuffer) return videoBuffer;
      const response = await fetch(videoUrl);
      if (!response.ok) throw new Error(`動画取得失敗: HTTP ${response.status}`);
      videoBuffer = new Uint8Array(await response.arrayBuffer());
      if (!videoBuffer.byteLength) throw new Error("完成動画が空です。");
      return videoBuffer;
    };
    const save = async (network: Platform, externalId: string | null, postUrl: string | null, metadata: Record<string,unknown> = {}) => {
      const { error } = await supabase.from("social_posts").insert({
        creative_id: source.creative_id, user_id: user.id, network,
        external_post_id: externalId, post_url: postUrl, published_at: new Date().toISOString(),
        status: "published", caption, metadata: { sourceSocialPostId: socialPostId, ...metadata },
      });
      if (error) throw error;
    };

    try {
      for (const platform of platforms) {
        try {
          if (platform === "tiktok") {
            const r = await publishTikTokVideo({videoUrl,title:caption,isAigc:true});
            await save(platform,r.publishId,null,{publishId:r.publishId});
            results.push({platform,ok:true,postId:r.publishId});
          } else if (platform === "instagram") {
            const r = await publishInstagramReel({videoUrl,caption});
            await save(platform,r.mediaId,null,r);
            results.push({platform,ok:true,postId:r.mediaId});
          } else if (platform === "facebook") {
            const r = await publishFacebookReel({videoUrl,caption});
            await save(platform,r.videoId,null,r);
            results.push({platform,ok:true,postId:r.videoId});
          } else if (platform === "youtube") {
            const response = await fetch(videoUrl);
            if (!response.ok) throw new Error(`動画取得失敗: HTTP ${response.status}`);
            tempFile = path.join(os.tmpdir(),`ai-acquisition-${source.id}.mp4`);
            await writeFile(tempFile,Buffer.from(await response.arrayBuffer()));
            const r = await uploadYouTubeVideo({filePath:tempFile,title:caption,description:caption,privacyStatus:"public",containsSyntheticMedia:true});
            await save(platform,r.videoId,r.url,r);
            results.push({platform,ok:true,postId:r.videoId,url:r.url ?? undefined});
          } else if (platform === "x") {
            const r = await publishXPost({text:caption.slice(0,280),video:await getVideoBuffer()});
            await save(platform,r.postId,r.url,r);
            results.push({platform,ok:true,postId:r.postId,url:r.url});
          } else {
            const {data: account,error} = await supabase.from("linkedin_accounts")
              .select("linkedin_sub,access_token_encrypted,expires_at").eq("user_id",user.id).maybeSingle();
            if (error) throw error;
            if (!account) throw new Error("LinkedInを先に接続してください。");
            if (account.expires_at && new Date(account.expires_at).getTime() <= Date.now()) throw new Error("LinkedInアクセストークンの有効期限が切れています。");
            const r = await createLinkedInVideoPost(decryptLinkedInToken(account.access_token_encrypted),"urn:li:person:"+account.linkedin_sub,caption,await getVideoBuffer());
            const url = r.id ? "https://www.linkedin.com/feed/update/"+r.id : null;
            await save(platform,r.id,url,{postUrn:r.id,videoUrn:r.videoUrn});
            results.push({platform,ok:true,postId:r.id ?? undefined,url:url ?? undefined});
          }
        } catch (e) {
          results.push({platform,ok:false,error:e instanceof Error ? e.message : String(e)});
        }
      }
    } finally {
      if (tempFile) await unlink(tempFile).catch(()=>{});
    }
    return NextResponse.json({ok:results.some(r=>r.ok),results,published:results.filter(r=>r.ok).length,failed:results.filter(r=>!r.ok).length});
  } catch (e) {
    return NextResponse.json({error:e instanceof Error ? e.message : "SNS投稿に失敗しました。"},{status:500});
  }
}