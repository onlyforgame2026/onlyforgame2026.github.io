# ServerBloom Supabase 設定

1. 在 Supabase 建立專案，開啟 **SQL Editor**，貼上並執行 [`supabase.sql`](supabase.sql) 全文。
2. 到 **Authentication → Providers → Email**，開啟 Email OTP，關閉新使用者自行註冊。只在 **Authentication → Users** 建立 `alyonayona0801@gmail.com`。
3. 到 **Authentication → Email Templates → Magic Link**，把內容改成顯示 `{{ .Token }}` 的 6 位數驗證碼（不要只放確認連結）。
4. 到 **Authentication → Settings**，將 Email OTP 到期時間設為 **600 秒**、JWT expiry 設為 **604800 秒（7 天）**。Site URL 填 `https://onlyforgame2026.github.io/serverbloom/`。
5. 到 **Project Settings → API** 複製 Project URL 與 `anon` public key，填入 `assets/js/supabase-config.js` 的兩個 placeholder。
6. 部署後，以電腦 `Ctrl+Shift+B` 或手機連點 Logo 7 次登入。第一次登入會把目前卡片資料一次性匯入 Supabase。

只填 Project URL 與 `anon` key；不要把 `service_role`、Gmail 密碼或任何私人金鑰放進 Repository。
