// ── Supabase 연동 설정 예시 ──
// 이 파일을 복사해서 같은 폴더에 config.js 로 저장한 뒤, 아래 두 값을 실제 값으로 채우세요.
//   PowerShell:  Copy-Item frontend\js\config.example.js frontend\js\config.js
//
// 값 위치: Supabase 대시보드 → Project Settings(⚙️) → API
//   - Project URL      → SUPABASE_URL
//   - anon public key  → SUPABASE_ANON_KEY  (공개용 키. 클라이언트 노출 전제)
//
// 실제 값이 든 config.js 는 .gitignore 로 커밋에서 제외됩니다.

window.SUPABASE_URL = 'https://YOUR-PROJECT-REF.supabase.co';
window.SUPABASE_ANON_KEY = 'YOUR-ANON-PUBLIC-KEY';
