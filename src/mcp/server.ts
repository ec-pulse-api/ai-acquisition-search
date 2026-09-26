import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";
import { analyzePage } from "../lib/acquisition/analyze";
import { fetchPageSnapshot } from "../lib/acquisition/fetch-url";
import { saveNarrationFile } from "../lib/video/gemini-tts";
import { getTikTokPublishStatus, publishTikTokVideo, queryTikTokCreator } from "../lib/social/tiktok";
import { getYouTubeVideoStatus, uploadYouTubeVideo } from "../lib/social/youtube";
import { publishFacebookReel, publishInstagramReel } from "../lib/social/meta";

function createServer(): McpServer {
  const server = new McpServer({
    name: "ai-acquisition-search",
    version: "0.3.0"
  });

  server.registerTool(
    "analyze-acquisition",
    {
      description:
        "商品・サービスURLを取得し、商品・市場・顧客・競合・実績を分析して、集客課題・機会・優先順位・次にやるべき集客アクションを返します。",
      inputSchema: z.object({
        url: z.string().url().describe("分析対象の商品・サービスの公開URL")
      })
    },
    async ({ url }) => {
      try {
        const source = await fetchPageSnapshot(url);
        const analysis = await analyzePage(source);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  url,
                  source,
                  analysis
                },
                null,
                2
              )
            }
          ]
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "集客分析に失敗しました。";

        return {
          content: [{ type: "text", text: message }],
          isError: true
        };
      }
    }
  );

  server.registerTool(
    "generate-narration",
    {
      description:
        "Gemini 3.8 Flash TTSで日本語ナレーションを生成し、Claude Code拡張機能のローカルgeneratedフォルダにWAVとして保存します。",
      inputSchema: z.object({
        text: z.string().min(1).describe("読み上げるナレーション本文"),
        voice: z.string().optional().describe("Gemini TTSの音声名。既定値はKore"),
        style: z
          .string()
          .optional()
          .describe("話し方。例: 自然で明るい日本語広告ナレーション")
      })
    },
    async ({ text, voice, style }) => {
      try {
        const result = await saveNarrationFile({ text, voice, style });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "ナレーション生成に失敗しました。";
        return {
          content: [{ type: "text", text: message }],
          isError: true
        };
      }
    }
  );

  server.registerTool(
    "tiktok-creator-info",
    {
      description:
        "認可済みTikTokアカウントの投稿可能設定を取得します。投稿前の確認に使用します。",
      inputSchema: z.object({})
    },
    async () => {
      try {
        const result = await queryTikTokCreator();
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "TikTokアカウント情報の取得に失敗しました。";
        return { content: [{ type: "text", text: message }], isError: true };
      }
    }
  );

  server.registerTool(
    "tiktok-publish",
    {
      description:
        "TikTok Content Posting APIのDirect PostでHTTPS公開動画URLを認可済みアカウントへ投稿します。公開範囲は指定された値を使用し、AI生成動画はis_aigc=trueで送信します。",
      inputSchema: z.object({
        videoUrl: z.string().url().describe("TikTokから取得可能なHTTPS公開動画URL"),
        title: z.string().min(1).max(2200).describe("TikTokキャプション"),
        privacyLevel: z.enum([
          "PUBLIC_TO_EVERYONE",
          "MUTUAL_FOLLOW_FRIENDS",
          "FOLLOWER_OF_CREATOR",
          "SELF_ONLY"
        ]).optional(),
        disableComment: z.boolean().optional(),
        disableDuet: z.boolean().optional(),
        disableStitch: z.boolean().optional(),
        isAigc: z.boolean().optional(),
        brandOrganicToggle: z.boolean().optional(),
        videoCoverTimestampMs: z.number().int().min(0).optional()
      })
    },
    async (input) => {
      try {
        const result = await publishTikTokVideo(input);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "TikTok投稿に失敗しました。";
        return { content: [{ type: "text", text: message }], isError: true };
      }
    }
  );

  server.registerTool(
    "tiktok-publish-status",
    {
      description: "TikTok Direct Postのpublish_idから投稿処理状態を取得します。",
      inputSchema: z.object({
        publishId: z.string().min(1).describe("TikTok APIが返したpublish_id")
      })
    },
    async ({ publishId }) => {
      try {
        const result = await getTikTokPublishStatus(publishId);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "TikTok投稿状態の取得に失敗しました。";
        return { content: [{ type: "text", text: message }], isError: true };
      }
    }
  );

  server.registerTool(
    "youtube-publish",
    {
      description:
        "YouTube Data API v3のvideos.insertを使い、ローカルMP4を認可済みYouTubeチャンネルへアップロードします。",
      inputSchema: z.object({
        filePath: z.string().min(1).describe("アップロードするMP4ファイルのローカルパス"),
        title: z.string().min(1).max(100),
        description: z.string().optional(),
        tags: z.array(z.string()).optional(),
        categoryId: z.string().optional(),
        privacyStatus: z.enum(["private", "unlisted", "public"]).optional(),
        madeForKids: z.boolean().optional(),
        containsSyntheticMedia: z.boolean().optional()
      })
    },
    async (input) => {
      try {
        const result = await uploadYouTubeVideo(input);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : "YouTube投稿に失敗しました。";
        return { content: [{ type: "text", text: message }], isError: true };
      }
    }
  );

  server.registerTool(
    "youtube-publish-status",
    {
      description:
        "YouTube動画の公開状態、処理状態、再生数・いいね等の公開統計を取得します。",
      inputSchema: z.object({
        videoId: z.string().min(1)
      })
    },
    async ({ videoId }) => {
      try {
        const result = await getYouTubeVideoStatus(videoId);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : "YouTube状態取得に失敗しました。";
        return { content: [{ type: "text", text: message }], isError: true };
      }
    }
  );

  server.registerTool(
    "instagram-reel-publish",
    {
      description: "Meta Graph APIでInstagramプロフェッショナルアカウントへReelsを公開します。",
      inputSchema: z.object({
        videoUrl: z.string().url(),
        caption: z.string().optional()
      })
    },
    async (input) => {
      try {
        const result = await publishInstagramReel(input);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Instagram投稿に失敗しました。";
        return { content: [{ type: "text", text: message }], isError: true };
      }
    }
  );

  server.registerTool(
    "facebook-reel-publish",
    {
      description: "Meta Graph APIでFacebook PageへReelsを公開します。",
      inputSchema: z.object({
        videoUrl: z.string().url(),
        caption: z.string().optional()
      })
    },
    async (input) => {
      try {
        const result = await publishFacebookReel(input);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Facebook投稿に失敗しました。";
        return { content: [{ type: "text", text: message }], isError: true };
      }
    }
  );

  server.registerTool(
    "x-publish",
    {
      description: "X API v2で認可済みアカウントへテキスト投稿します。",
      inputSchema: z.object({ text: z.string().min(1).max(280) })
    },
    async ({ text }) => {
      try {
        const result = await publishXPost({ text });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : "X投稿に失敗しました。";
        return { content: [{ type: "text", text: message }], isError: true };
      }
    }
  );

  server.registerTool(
    "x-post-metrics",
    {
      description: "X投稿の公開メトリクスを取得します。",
      inputSchema: z.object({ postId: z.string().min(1) })
    },
    async ({ postId }) => {
      try {
        const result = await getXPostMetrics(postId);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : "X投稿のメトリクス取得に失敗しました。";
        return { content: [{ type: "text", text: message }], isError: true };
      }
    }
  );


  server.registerTool(
    "collect-performance",
    {
      description: "公開SNS投稿の実績を共通形式に正規化します。XとYouTubeから取得できます。",
      inputSchema: z.object({
        platform: z.enum(["x", "youtube"]),
        postId: z.string().min(1)
      })
    },
    async ({ platform, postId }) => {
      try {
        const { normalizeXPerformance, normalizeYouTubePerformance } = await import("../lib/analytics/performance");
        const result = platform === "x"
          ? await normalizeXPerformance(await getXPostMetrics(postId))
          : await normalizeYouTubePerformance(await getYouTubeVideoStatus(postId));
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : "実績取得に失敗しました。";
        return { content: [{ type: "text", text: message }], isError: true };
      }
    }
  );

  server.registerTool(
    "optimize-next-campaign",
    {
      description: "分析結果と接続済みSNS実績から、次に実施する集客テストと制作ブリーフを決定します。未取得データは推測で補完しません。",
      inputSchema: z.object({
        analysis: z.record(z.string(), z.unknown()),
        performance: z.array(z.object({
          platform: z.string(),
          postId: z.string(),
          metrics: z.object({
            views: z.number().nullable().optional(),
            impressions: z.number().nullable().optional(),
            likes: z.number().nullable().optional(),
            comments: z.number().nullable().optional(),
            shares: z.number().nullable().optional(),
            clicks: z.number().nullable().optional()
          })
        })).optional()
      })
    },
    async ({ analysis, performance }) => {
      try {
        const result = decideNextCampaign({
          analysis: analysis as Parameters<typeof decideNextCampaign>[0]["analysis"],
          performance
        });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : "次の集客施策の決定に失敗しました。";
        return { content: [{ type: "text", text: message }], isError: true };
      }
    }
  );

  return server;
}

void serveStdio(createServer);
