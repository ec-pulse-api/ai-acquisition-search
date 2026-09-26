# AI Acquisition Search

**AI集客検索エンジン / Claude Code 拡張機能**

商品・サービスURLから、商品・市場・顧客・競合・実績を分析し、集客課題・機会・優先順位・次に取るべき集客アクションを判断するAIシステムです。

## MVP

1. 商品・サービスURLを入力
2. **「集客分析を開始」**
3. 公開ページの情報を取得
4. 商品 / 市場 / 顧客 / 競合 / 実績を分析
5. 集客課題と機会を整理
6. 優先順位を付ける
7. **次にやるべき集客アクション**を提示

## Claude Code 拡張機能

このリポジトリはClaude Codeプラグインとしても利用できる構成です。

- Plugin manifest: `.claude-plugin/plugin.json`
- MCP configuration: `.mcp.json`
- MCP tool: `analyze-acquisition`
- MCP server: `src/mcp/server.ts`

Claude CodeからURLを渡すと、Webページ取得 → 集客分析 → 次のアクションまでを1回のツール呼び出しで実行できます。

### MCP tool

入力:

```json
{ "url": "https://example.com/product" }
```

出力:

- 取得したページ情報
- 商品分析
- 市場分析
- 顧客分析
- 競合分析
- 実績分析
- 集客課題
- 集客機会
- 優先順位
- 次にやるべき集客アクション

## ローカル開発

```powershell
npm install
npm run build
npm run dev
```

Web UI:

`http://localhost:3000`（使用中の場合はNext.jsが空いているポートを使用）

MCPサーバー単体:

```powershell
npm run mcp
```

MCPサーバーはstdioを使用するため、通常はClaude Codeから起動します。

## Web API

POST `/api/analyze`

```json
{ "url": "https://example.com/product" }
```

`OPENAI_API_KEY` が設定されている場合はLLM分析、未設定の場合はページ抽出ベースの予備分析を返します。\n\n## SNS検索レイヤー\n\n`SCRAPE_CREATORS_API_KEY` を設定すると、Scrape CreatorsのTikTok検索を任意接続し、商品名から関連投稿の公開指標（再生・いいね・コメント・シェア）を取得して意思決定AIの材料にします。未設定でも商品ページ＋Web検索による分析は動作します。\n\n任意の環境変数:\n\n```text\nSCRAPE_CREATORS_API_KEY=...\nSCRAPE_CREATORS_REGION=JP\nSCRAPE_CREATORS_DATE_POSTED=this-month\n```\n\nTikTok検索は外部APIの従量課金を使用するため、キーはサーバー側環境変数だけに保存します。

「Acquisition」は企業買収ではなく、**Customer Acquisition（顧客獲得・集客）**を意味します。
