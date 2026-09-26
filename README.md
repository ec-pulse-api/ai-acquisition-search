# AI Acquisition Search

**AI集客検索エンジン**

商品・サービスURLから、商品・市場・顧客・競合・実績を分析し、集客課題・機会・優先順位・次に取るべき集客アクションを判断するAIシステム。

## MVP
1. 商品・サービスURLを入力
2. **「集客分析を開始」**
3. 公開ページの情報を取得
4. 商品 / 市場 / 顧客 / 競合 / 実績を分析
5. 集客課題と機会を整理
6. 優先順位を付ける
7. **次にやるべき集客アクション**を提示

## API
POST /api/analyze
```json
{ "url": "https://example.com/product" }
```

OPENAI_API_KEY が設定されている場合はLLM分析、未設定の場合はページ抽出ベースの予備分析を返します。

「Acquisition」は企業買収ではなく、**Customer Acquisition（顧客獲得・集客）**を意味します。