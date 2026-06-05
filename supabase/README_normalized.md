# Normalized Schema Notes

## Entry file
- `supabase/schema_normalized.sql`

## global_category_code
`time_categories.global_category_code` は法人間比較のための共通カテゴリキーです。

例:
- `DIRECT_CARE_TOILET`
- `DIRECT_CARE_MEAL`
- `INDIRECT_RECORDING`
- `INDIRECT_HANDOVER`
- `INDIRECT_MOVEMENT`

同じ法人内では `sub_no` と `action_name` を自由に持ちながら、
集計時は `global_category_code` で横断比較できます。

## RLS
- `users.tenant_id` を基準に全テーブルを tenant 分離します。
- 実運用では role 別の厳密ポリシー（例: viewerはread-only）を追加してください。
