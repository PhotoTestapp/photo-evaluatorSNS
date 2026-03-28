# Pulse SNS

GitHub Pages 向けの静的SNS試作です。

## 公開ファイル

- `index.html`
- `styles.css`
- `script.js`

## 特徴

- 1ページ完結
- iPhone を含むモバイル表示に対応
- 投稿、プロフィール、フォロー、アイコン設定はこのブラウザの `localStorage` に保存
- サーバー不要でそのまま GitHub Pages に置ける構成

## 公開時の注意

- `profile.html` や `messages.html` は使いません
- ルートまたは `SNS/` 配下にこの3ファイルを置けば動作します
- データは端末ごとに保存されるため、別端末とは共有されません
