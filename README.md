# Pulse SNS

1ページ構成のフロントエンドで動く、最小構成のSNSクライアントです。  
見た目は静的試作のまま維持しつつ、認証・投稿・Like・Save・Follow・フィード取得の主経路を API ベースへ切り替えています。

## 構成

- `index.html`
- `styles.css`
- `script.js`

## 変更後の前提

- 正本データは SNS API 側にあります
- `localStorage` は以下の UI 補助用途だけに限定しています
  - セッション情報: `token`, `accountId`, `email`, `profile`
  - キャッシュプロフィール: 表示名、ハンドル、地域、自己紹介、アイコン
- 旧試作で使っていた `pulse_sns_feed_state_v2` などの legacy key は、初期化時に一度だけ自動削除します
- パスワードはブラウザに永続保存しません
- 写真解析の6軸スコア算出はフロントで継続します
- 投稿や反応の表示値は API 応答を正とします
- スコア表記は UI 全体で `Photo Score` に統一しています

## 必要な API

フロントは以下のエンドポイントを前提にしています。

### 認証

- `POST /api/sns/register`
- `POST /api/sns/login`

返却例:

```json
{
  "success": true,
  "token": "jwt-or-session-token",
  "account": {
    "id": "acct_123",
    "email": "you@example.com",
    "profile": {
      "id": "acct_123",
      "displayName": "Seiya Harada",
      "handle": "@seiya",
      "location": "Japan",
      "bio": "写真とUIのあいだを記録するアカウント。",
      "avatarSrc": "data-or-https-image"
    }
  }
}
```

### 投稿

- `GET /api/sns/posts?sort=latest`
- `GET /api/sns/posts?sort=top`
- `GET /api/sns/posts?scope=mine&sort=latest`
- `POST /api/sns/posts`

投稿レスポンスで期待するフィールド:

```json
{
  "id": "post_123",
  "authorId": "acct_123",
  "displayName": "Seiya Harada",
  "handle": "@seiya",
  "avatarSrc": "https://...",
  "content": "投稿本文",
  "imageSrc": "https://... or data URL",
  "imageAlt": "投稿写真",
  "scoreBreakdown": {
    "compositionScore": 88,
    "lightScore": 83,
    "colorScore": 86,
    "technicalScore": 82,
    "subjectScore": 84,
    "impactScore": 87
  },
  "baseScore": 85,
  "pulse": 41,
  "finalScore": 74,
  "likesCount": 12,
  "savesCount": 4,
  "createdAt": "2026-04-10T12:00:00.000Z",
  "viewerHasLiked": false,
  "viewerHasSaved": false,
  "viewerIsFollowingAuthor": true
}
```

`POST /api/sns/posts` 送信例:

```json
{
  "content": "本文",
  "imageSrc": "data:image/jpeg;base64,...",
  "imageAlt": "sample.jpg の投稿画像",
  "scoreBreakdown": {
    "compositionScore": 88,
    "lightScore": 83,
    "colorScore": 86,
    "technicalScore": 82,
    "subjectScore": 84,
    "impactScore": 87,
    "totalScore": 85
  },
  "baseScore": 85
}
```

### 反応

- `POST /api/sns/posts/:id/like`
- `DELETE /api/sns/posts/:id/like`
- `POST /api/sns/posts/:id/save`
- `DELETE /api/sns/posts/:id/save`
- `POST /api/sns/users/:id/follow`
- `DELETE /api/sns/users/:id/follow`
- `GET /api/sns/users/following`

Like / Save の返却は更新済み投稿オブジェクトを想定しています。  
Follow / Unfollow は最小でも `success` を返し、可能なら `userId` を返してください。

## APIベースURLの設定

`index.html` の `meta[name="pulse-sns-api-base"]` を使います。

```html
<meta name="pulse-sns-api-base" content="https://your-api.example.com" />
```

優先順位:

1. `localStorage["pulse_sns_api_base"]`
2. `meta[name="pulse-sns-api-base"]`
3. `localhost` / `127.0.0.1` のときは `window.location.origin`

## 開発時の使い方

1. 上記 API を起動する
2. `index.html` `styles.css` `script.js` を同じディレクトリに置く
3. `meta[name="pulse-sns-api-base"]` を API の URL に合わせる
4. 静的サーバーで配信する

例:

```bash
python3 -m http.server 8080
```

## API未接続時の挙動

- UI上で「ローカルデモモード」と明示します
- 写真解析プレビューは使えます
- 登録、ログイン、投稿、Like、Save、Follow は成立しません
- 共通フィードは空表示になります

## 初期化時の補足

- `initializeApp()` の先頭で `cleanupLegacyStorage()` を呼び出します
- これは旧試作の `localStorage` データが、セッション復元や初期描画に混ざらないようにするためです
- legacy key の削除処理はガードされており、同一ページロード中は一度だけ実行されます
- 実行結果は `console.info` に出力し、ユーザー向けステータスには表示しません

## 構文確認

- フロントの構文確認は `node --check script.js` を手動または CI で実行する前提です
- この README 自体は、実行ログを埋め込まずに検証手順のみを記載しています

例:

```bash
node --check script.js
```

## 実装メモ

- `script.js` は以下の責務ごとに整理しています
  - API 通信
  - セッション管理
  - 画像解析
  - 投稿描画
  - フィード取得と反応更新
  - プロフィール描画
- `createdAt` を基準に相対時間と新着判定を行います
- 投稿所有者判定は `authorId === session.accountId` に統一しています
- `Session Stats` は共通フィード `state.feed` を母集団にした集計です
- プロフィール統計は `GET /api/sns/posts?scope=mine&sort=latest` の取得結果を `authorId === session.accountId` で再確認した投稿一覧から計算します
