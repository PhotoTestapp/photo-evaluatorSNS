# Pulse SNS

Pulse SNS は、1ページ構成の最小SNSクライアントです。  
このフロントは `meta[name="pulse-sns-api-base"]` で指定した API に接続し、ユーザー登録、ログイン、画像アップロード、投稿、コメント、いいね、プロフィール更新、ページネーション付き一覧取得を行います。

## 対象ファイル

- `index.html`
- `styles.css`
- `script.js`

## フロント前提

- 正本データは API 側にあります
- `localStorage` はセッション、キャッシュプロフィール、API ベース URL にだけ使います
- パスワードは保存しません
- 投稿画像とアバター画像は必ず `POST /api/sns/uploads` を通します
- スコア表記は `Photo Score` / `写真スコア` に統一しています
- コメントは `POST /api/sns/posts/:id/comments` を使って投稿し、投稿レスポンスの `comments` / `commentsCount` を正として再描画します

## API ベース URL

`index.html`:

```html
<meta name="pulse-sns-api-base" content="https://photo-evaluator-dl-api.onrender.com" />
```

優先順位:

1. `localStorage["pulse_sns_api_base"]`
2. `meta[name="pulse-sns-api-base"]`
3. `localhost` / `127.0.0.1` のときは `window.location.origin`

## 初期化時の挙動

- `initializeApp()` の先頭で `cleanupLegacyStorage()` を実行します
- 目的は旧試作の `localStorage` データが新しい API ベース実装へ混ざらないようにすることです
- 同一ページロード中は一度だけ実行します
- 実行結果は `console.info` に出力します

削除対象:

- `photo_eval_anonymous_user_id`
- `pulse_sns_feed_state_v2`
- `pulse_sns_profile_v1`
- `pulse_sns_follow_state_v1`
- `pulse_sns_accounts_v1`
- `pulse_sns_session_v1`

## 共通レスポンスルール

成功レスポンスの基本形:

```json
{
  "success": true
}
```

エラーレスポンスの基本形:

```json
{
  "success": false,
  "message": "短いエラー説明"
}
```

フロントのエラー分類:

- `NETWORK_ERROR`: 接続失敗または timeout
- `AUTH_ERROR`: `401` / `403`
- `VALIDATION_ERROR`: `4xx`
- `SERVER_ERROR`: `5xx`

## 必須 API 契約

### 1. `POST /api/sns/register`

必須フィールド:

- `email`
- `password`
- `profile.displayName`
- `profile.handle`

リクエスト例:

```json
{
  "email": "you@example.com",
  "password": "password123",
  "profile": {
    "displayName": "Seiya Harada",
    "handle": "@seiya",
    "location": "Japan",
    "bio": "写真とUIのあいだを記録するアカウント。",
    "avatarSrc": "https://cdn.example.com/avatar.jpg"
  }
}
```

成功レスポンス例:

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

エラーレスポンス例:

```json
{
  "success": false,
  "message": "このメールアドレスはすでに登録されています。"
}
```

### 2. `POST /api/sns/login`

必須フィールド:

- `email`
- `password`

リクエスト例:

```json
{
  "email": "you@example.com",
  "password": "password123"
}
```

成功レスポンス例:

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
      "bio": "プロフィール",
      "avatarSrc": "https://cdn.example.com/avatar.jpg"
    }
  }
}
```

エラーレスポンス例:

```json
{
  "success": false,
  "message": "メールアドレスまたはパスワードが一致しません。"
}
```

### 3. `POST /api/sns/uploads`

必須フィールド:

- `file`
- `kind`

リクエスト:

- `multipart/form-data`
- `kind` は `post` または `avatar`

成功レスポンス例:

```json
{
  "success": true,
  "assetId": "asset_123",
  "imageUrl": "https://cdn.example.com/uploads/post-123.jpg"
}
```

エラーレスポンス例:

```json
{
  "success": false,
  "message": "画像サイズが上限を超えています。"
}
```

運用メモ:

- フロントはアップロード前に圧縮を行います
- 推奨形式は JPEG または PNG です
- バックエンドでは元ファイル 10MB 以下を受け付ける前提にしてください
- フロントは最長辺 1600px 以内を目安に圧縮して送信します
- フロントは `imageUrl` が返らない場合、投稿を中断します

### 4. `PATCH /api/sns/profile`

必須フィールド:

- `profile.displayName`
- `profile.handle`

リクエスト例:

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

成功レスポンス例:

```json
{
  "success": true,
  "account": {
    "id": "acct_123",
    "email": "you@example.com",
    "profile": {
      "id": "acct_123",
      "displayName": "Seiya Harada",
      "handle": "@seiya",
      "location": "Japan",
      "bio": "更新後プロフィール",
      "avatarSrc": "https://cdn.example.com/avatar.jpg"
    }
  }
}
```

エラーレスポンス例:

```json
{
  "success": false,
  "message": "ハンドル名はすでに使用されています。"
}
```

### 5. `GET /api/sns/posts?sort=latest|top&limit=<n>&cursor=<cursor>`

必須クエリ:

- `sort`
- `limit`

任意クエリ:

- `cursor`

成功レスポンス例:

```json
{
  "success": true,
  "posts": [
    {
      "id": "post_123",
      "authorId": "acct_123",
      "displayName": "Seiya Harada",
      "handle": "@seiya",
      "avatarSrc": "https://cdn.example.com/avatar.jpg",
      "content": "投稿本文",
      "imageUrl": "https://cdn.example.com/post.jpg",
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
      "commentsCount": 2,
      "createdAt": "2026-04-10T12:00:00.000Z",
      "viewerHasLiked": false,
      "viewerHasSaved": false,
      "viewerIsFollowingAuthor": true,
      "comments": [
        {
          "id": "comment_001",
          "postId": "post_123",
          "authorId": "acct_777",
          "displayName": "Aya",
          "handle": "@aya",
          "avatarSrc": "https://cdn.example.com/avatar-aya.jpg",
          "content": "色のまとまりがとても好きです。",
          "createdAt": "2026-04-10T12:10:00.000Z"
        }
      ]
    }
  ],
  "nextCursor": "cursor_2"
}
```

エラーレスポンス例:

```json
{
  "success": false,
  "message": "sort パラメータが不正です。"
}
```

### 6. `GET /api/sns/posts?scope=mine&sort=latest&limit=<n>&cursor=<cursor>`

必須クエリ:

- `scope=mine`
- `sort=latest`
- `limit`

成功レスポンス例:

```json
{
  "success": true,
  "posts": [],
  "nextCursor": null
}
```

エラーレスポンス例:

```json
{
  "success": false,
  "message": "認証が必要です。"
}
```

### 7. `POST /api/sns/posts`

必須フィールド:

- `content` または `imageUrl`
- `baseScore` 画像付き投稿時

リクエスト例:

```json
{
  "content": "本文",
  "imageUrl": "https://cdn.example.com/post.jpg",
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

成功レスポンス例:

```json
{
  "success": true,
  "post": {
    "id": "post_123",
    "authorId": "acct_123",
    "displayName": "Seiya Harada",
    "handle": "@seiya",
    "avatarSrc": "https://cdn.example.com/avatar.jpg",
    "content": "本文",
    "imageUrl": "https://cdn.example.com/post.jpg",
    "imageAlt": "sample.jpg の投稿画像",
    "scoreBreakdown": {
      "compositionScore": 88,
      "lightScore": 83,
      "colorScore": 86,
      "technicalScore": 82,
      "subjectScore": 84,
      "impactScore": 87
    },
    "baseScore": 85,
    "pulse": 18,
    "finalScore": 85,
    "likesCount": 0,
    "savesCount": 0,
    "commentsCount": 0,
    "createdAt": "2026-04-10T12:00:00.000Z",
    "viewerHasLiked": false,
    "viewerHasSaved": false,
    "viewerIsFollowingAuthor": false,
    "comments": []
  }
}
```

エラーレスポンス例:

```json
{
  "success": false,
  "message": "本文または画像が必要です。"
}
```

### 8. `DELETE /api/sns/posts/:id`

必須:

- パスパラメータ `id`

成功レスポンス例:

```json
{
  "success": true,
  "deletedPostId": "post_123"
}
```

エラーレスポンス例:

```json
{
  "success": false,
  "message": "この投稿を削除する権限がありません。"
}
```

### 9. `POST /api/sns/posts/:id/like`

成功レスポンス例:

```json
{
  "success": true,
  "post": {
    "id": "post_123",
    "likesCount": 13,
    "viewerHasLiked": true
  }
}
```

エラーレスポンス例:

```json
{
  "success": false,
  "message": "認証が必要です。"
}
```

### 10. `DELETE /api/sns/posts/:id/like`

成功レスポンス例:

```json
{
  "success": true,
  "post": {
    "id": "post_123",
    "likesCount": 12,
    "viewerHasLiked": false
  }
}
```

エラーレスポンス例:

```json
{
  "success": false,
  "message": "認証が必要です。"
}
```

### 11. `POST /api/sns/posts/:id/save`

成功レスポンス例:

```json
{
  "success": true,
  "post": {
    "id": "post_123",
    "savesCount": 5,
    "viewerHasSaved": true
  }
}
```

### 13. `POST /api/sns/posts/:id/comments`

必須フィールド:

- `content`

リクエスト例:

```json
{
  "content": "色のまとまりがとても好きです。"
}
```

成功レスポンス例:

```json
{
  "success": true,
  "post": {
    "id": "post_123",
    "commentsCount": 3,
    "comments": [
      {
        "id": "comment_001",
        "postId": "post_123",
        "authorId": "acct_777",
        "displayName": "Aya",
        "handle": "@aya",
        "avatarSrc": "https://cdn.example.com/avatar-aya.jpg",
        "content": "色のまとまりがとても好きです。",
        "createdAt": "2026-04-10T12:10:00.000Z"
      }
    ]
  }
}
```

エラーレスポンス例:

```json
{
  "success": false,
  "message": "コメント内容を入力してください。"
}
```

補足:

- フロントは `post.comments` が返る場合はそのまま再描画します
- 最小契約として `commentsCount` は必須です
- `post` 全体を返さない場合は `comment` 単体と `commentsCount` を返してください

エラーレスポンス例:

```json
{
  "success": false,
  "message": "認証が必要です。"
}
```

### 12. `DELETE /api/sns/posts/:id/save`

成功レスポンス例:

```json
{
  "success": true,
  "post": {
    "id": "post_123",
    "savesCount": 4,
    "viewerHasSaved": false
  }
}
```

エラーレスポンス例:

```json
{
  "success": false,
  "message": "認証が必要です。"
}
```

### 13. `POST /api/sns/users/:id/follow`

成功レスポンス例 1:

```json
{
  "success": true,
  "userId": "acct_456",
  "viewerIsFollowingAuthor": true
}
```

成功レスポンス例 2:

```json
{
  "success": true,
  "posts": [
    {
      "id": "post_1",
      "authorId": "acct_456",
      "viewerIsFollowingAuthor": true
    }
  ]
}
```

エラーレスポンス例:

```json
{
  "success": false,
  "message": "認証が必要です。"
}
```

### 14. `DELETE /api/sns/users/:id/follow`

成功レスポンス例:

```json
{
  "success": true,
  "userId": "acct_456",
  "viewerIsFollowingAuthor": false
}
```

エラーレスポンス例:

```json
{
  "success": false,
  "message": "認証が必要です。"
}
```

### 15. `GET /api/sns/users/following`

成功レスポンス例:

```json
{
  "success": true,
  "users": [
    {
      "id": "acct_456",
      "displayName": "Other User",
      "handle": "@other"
    }
  ]
}
```

エラーレスポンス例:

```json
{
  "success": false,
  "message": "認証が必要です。"
}
```

## 認証失効時の挙動

- `apiRequest()` は `AbortController` による timeout を使います
- `401` / `403` を受けたら共通処理で `clearSession()` を実行します
- 再ログインが必要であることを `signupStatus` と `composerStatus` に表示します
- セッション破棄後は feed / following / profile posts を初期化します

## ページネーション仕様

- フィードとプロフィール投稿一覧の両方で `limit` と `cursor` を使います
- フロントの既定 `limit` は 12 件です
- `nextCursor` があれば「もっと見る」ボタンを表示します
- フィルタ切替時は cursor をリセットします
- 追加取得時は重複投稿を除去します

## 統計の母集団

- `Session Stats` は共通フィード `state.feed` を母集団にした集計です
- プロフィール統計は `scope=mine` 取得後に `authorId === session.accountId` を再確認した `profilePostsState.items` を母集団にした集計です

## API未接続時の挙動

- UI上で「ローカルデモモード」と明示します
- 写真解析プレビューは使えます
- 登録、ログイン、プロフィール更新、投稿、削除、Like、Save、Follow は成立しません
- 共通フィードとプロフィール投稿一覧は空表示になります

## 構文確認

以下は検証手順です。結果を README には埋め込みません。

```bash
node --check script.js
```

## 手動結合確認項目

1. 登録
2. ログイン
3. アバターアップロード
4. 投稿画像アップロード
5. 投稿作成
6. フィード取得
7. もっと見る
8. Like / Save / Follow
9. プロフィール更新
10. 自分の投稿削除
11. 401 時の挙動
12. API 停止時の挙動

確認例:

1. 新規登録後にトークンだけが保存され、パスワードが `localStorage` に残らないこと
2. 投稿画像選択後に upload API が呼ばれ、`POST /api/sns/posts` には `imageUrl` / `uploadAssetId` が送られること
3. `PATCH /api/sns/profile` でプロフィール更新が反映されること
4. `DELETE /api/sns/posts/:id` 後に feed とプロフィール投稿一覧から削除されること
5. `limit` / `cursor` を返す API で「もっと見る」が動作すること
6. 401 / 403 を返したときにセッション破棄と再ログイン導線が働くこと

## 開発時の配信例

```bash
python3 -m http.server 8080
```
