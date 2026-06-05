# Vercel + Supabase セットアップ手順

## 1. Supabase 側
1. Supabase プロジェクトを作成
2. SQL Editor で `supabase/schema.sql` を実行
3. `Settings > API` から以下を取得
   - Project URL
   - anon public key

## 2. Vercel 側
1. 本リポジトリを Vercel に import
2. Build Command: `npm run build`
3. Output Directory: `dist`
4. Environment Variables を設定
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_SUPABASE_SNAPSHOT_ID`（任意。施設単位などで分けたい場合に利用）

## 3. 動作確認
1. アプリを開く
2. 画面A/B/Cでデータ入力
3. 数秒待つ（クラウド保存はデバウンス）
4. 別端末/別ブラウザで同じURLを開き、データ復元を確認

## 実装方針（現状）
- Supabase が設定されている場合
  - 起動時に `app_snapshots` から最新スナップショットを読込
  - 変更時にスナップショットを upsert 保存
- Supabase 未設定の場合
  - 既存の localStorage 保存のみで動作

## 注意
- 現在の RLS ポリシーは「テストしやすさ優先」で anon 書込を許可しています。
- 本番では必ず以下を実施してください。
  - 認証導入
  - テナント分離（施設ID単位など）
  - RLSポリシーの厳格化
