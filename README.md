# Pulse SNS

GitHub Pages 向けの静的SNS試作です。現在は既存 Render サービス `photo-evaluator-dl-api` への一時同居を前提に、SNS登録APIも呼べる構成にしています。

## 公開ファイル

- `index.html`
- `styles.css`
- `script.js`

## 特徴

- 1ページ完結
- iPhone を含むモバイル表示に対応
- 投稿、プロフィール、フォロー、アイコン設定はこのブラウザの `localStorage` に保存
- `meta[name="pulse-sns-api-base"]` が有効なときは `/api/sns/register` と `/api/sns/login` を優先利用
- API が使えないときはローカル登録へフォールバック

## 公開時の注意

- `profile.html` や `messages.html` は使いません
- ルートまたは `SNS/` 配下にこの3ファイルを置けば動作します
- 一時同居先: `https://photo-evaluator-dl-api.onrender.com`
- GitHub Pages から一般ユーザー登録を有効にするには、Render 側に最新の `photo_eval_ml_server.py` を反映する必要があります
- 現在のSNS登録データ保存は Render 上の JSON ファイルなので、本番永続運用には別ストレージ化が必要です
