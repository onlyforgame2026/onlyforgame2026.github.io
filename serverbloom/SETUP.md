# ServerBloom Supabase 設定

1. 在 Supabase 開啟 **SQL Editor**，貼上並執行 `supabase.sql` 全文。
2. 到 **Authentication → Providers → Email** 開啟 Email OTP，並在 **Authentication → Users** 建立 `alyonayona0801@gmail.com`。
3. 到 **Authentication → Email Templates → Magic Link**，確認信件內容包含 `{{ .Token }}`，讓信件顯示 6 位數驗證碼。
4. 將 Email OTP 有效時間設為 **600 秒**；JWT expiry 設為 **604800 秒（7 天）**。
5. Site URL 填 `https://onlyforgame2026.github.io/serverbloom/`。
6. 到 **Project Settings → API** 複製 Project URL 與 `anon` public key，填入 `assets/js/supabase-config.js` 的 placeholder。
7. 部署後，電腦按 `Ctrl+Alt+B`，或從前台右下角暗鎖進入後台。

只填 Project URL 與 `anon` key。不要把 `service_role` key、Email 密碼或其他密鑰放進 Repository。
