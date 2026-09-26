import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";
import { analyzePage } from "../lib/acquisition/analyze";
import { fetchPageSnapshot } from "../lib/acquisition/fetch-url";

function createServer(): McpServer {
  const server = new McpServer({
    name: "ai-acquisition-search",
    version: "0.2.0"
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

  return server;
}

void serveStdio(createServer);
