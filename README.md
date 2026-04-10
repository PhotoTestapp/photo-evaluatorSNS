# Pulse SNS

1ページ構成のフロントエンドで動く、実運用向けの最小SNSクライアントです。  
認証、プロフィール更新、画像アップロード、投稿、Like、Save、Follow、ページネーション付きフィード取得を API ベースで扱います。

## 対象ファイル

- `index.html`
- `styles.css`
- `script.js`

## フロントの前提

- 正本データはすべて SNS API 側にあります
- `localStorage` は以下の UI 補助用途だけに限定しています
  - セッション情報: `token`, `accountId`, `email`, `profile`
  - キャッシュプロフィール: 表示名、ハンドル、地域、自己紹介、アイコン
  - API ベース URL: `pulse_sns_api_base`
- パスワードはブラウザに永続保存しません
- 投稿画像は `data URL` で投稿 API へ送らず、必ず upload API を経由します
- スコア表記は UI 全体で `Photo Score` / `写真スコア` に統一しています

## 初期化時の挙動

- `initializeApp()` の先頭で `cleanupLegacyStorage()` を実行します
- これは旧試作の `localStorage` データがセッション復元や初期描画へ混ざらないようにするためです
- legacy key の削除処理は同一ページロード中に一度だけ実行されます
- 実行結果は `console.info` に出力し、ユーザー向けステータスには表示しません

削除対象:

- `photo_eval_anonymous_user_id`
- `pulse_sns_feed_state_v2`
- `pulse_sns_profile_v1`
- `pulse_sns_follow_state_v1`
- `pulse_sns_accounts_v1`
- `pulse_sns_session_v1`

## 必要な API 契約

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
      "avatarSrc": "https://cdn.example.com/avatar.jpg"
    }
  }
}
```

### 画像アップロード

- `POST /api/sns/uploads`

必須:

- `multipart/form-data` を受け取ること
- フィールド例: `file`, `kind`
- フロントは投稿画像・アバター画像のどちらもこの API を使います

返却例:

```json
{
  "success": true,
  "assetId": "asset_123",
  "imageUrl": "https://cdn.example.com/uploads/post-123.jpg"
}
```

### 投稿

- `GET /api/sns/posts?sort=latest&limit=12`
- `GET /api/sns/posts?sort=top&limit=12`
- `GET /api/sns/posts?scope=mine&sort=latest&limit=12`
- `GET /api/sns/posts?sort=latest&limit=12&cursor=<cursor>`
- `POST /api/sns/posts`
- `DELETE /api/sns/posts/:id`

投稿レスポンスで期待するフィールド:

```json
{
  "id": "post_123",
  "authorId": "acct_123",
  "displayName": "Seiya Harada",
  "handle": "@seiya",
  "avatarSrc": "https://cdn.example.com/avatar.jpg",
  "content": "投稿本文",
  "imageSrc": "https://cdn.example.com/post.jpg",
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

一覧取得の返却例:

```json
{
  "success": true,
  "posts": [],
  "nextCursor": "cursor_2"
}
```

投稿作成の送信例:

```json
{
  "content": "本文",
  "imageSrc": "https://cdn.example.com/post.jpg",
  "imageAlt": "sample.jpg の投稿画像",
  "uploadAssetId": "asset_123",
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
Follow / Unfollow は最小でも以下のどちらかを返してください。

- 更新済み投稿群: `{ success, posts: [...] }`
- もしくは最小返却: `{ success, userId, viewerIsFollowingAuthor }`

### プロフィール

- `PATCH /api/sns/profile`

送信例:

```json
{
  "profile": {
    "displayName": "Seiya Harada",
    "handle": "@seiya",
    "location": "Japan",
    "bio": "更新後プロフィール",
    "avatarSrc": "https://cdn.example.com/avatar.jpg"
  }
}
```

## ページネーション仕様

- フィードとプロフィール投稿一覧の両方で `limit` と `cursor` を使います
- フロントの既定 `limit` は 12 件です
- `nextCursor` があれば「もっと見る」ボタンを表示します
- `scope=mine` 側も同じくカーソルページネーション前提です

## 認証失効時の挙動

- `apiRequest()` は `AbortController` による timeout を使います
- `401` / `403` を受けたら共通処理で `clearSession()` を実行します
- セッション破棄後は feed / profile / following の表示を初期化します
- UI には「セッションが切れました。再ログインしてください。」系のメッセージを表示します

## 統計の母集団

- `Session Stats` は共通フィード `state.feed` を母集団にした集計です
- プロフィール統計は `GET /api/sns/posts?scope=mine&sort=latest` の取得結果を、さらに `authorId === session.accountId` で再確認した `profilePostsState.items` を母集団にした集計です

## APIベースURLの設定

`index.html` の `meta[name="pulse-sns-api-base"]` を使います。

```html
<meta name="pulse-sns-api-base" content="https://your-api.example.com" />
```

優先順位:

1. `localStorage["pulse_sns_api_base"]`
2. `meta[name="pulse-sns-api-base"]`
3. `localhost` / `127.0.0.1` のときは `window.location.origin`

## API未接続時の挙動

- UI上で「ローカルデモモード」と明示します
- 写真解析プレビューは使えます
- 登録、ログイン、プロフィール更新、投稿、Like、Save、Follow、削除は成立しません
- 共通フィードは空表示になります

## 構文確認

以下は検証手順です。結果を README には埋め込みません。

```bash
node --check script.js
```

## 手動結合確認項目

1. 新規登録後にトークンだけが保存され、パスワードが `localStorage` に残らないことを確認する
2. ログイン後に `PATCH /api/sns/profile` でプロフィール更新が反映されることを確認する
3. 投稿画像選択時に upload API が呼ばれ、`POST /api/sns/posts` には `imageSrc` / `uploadAssetId` が送られることを確認する
4. Like / Save / Follow 後に API 応答の真値で UI が更新されることを確認する
5. `DELETE /api/sns/posts/:id` 後に feed とプロフィール投稿一覧から削除されることを確認する
6. `limit` / `cursor` を返す API で「もっと見る」が動作することを確認する
7. 401 / 403 を返したときにセッション破棄と再ログイン導線が働くことを確認する

## 開発時の配信例

```bash
python3 -m http.server 8080
```
