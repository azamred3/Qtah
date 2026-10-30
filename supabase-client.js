// Supabase Client — يجب أن يكون سكربت CDN محمّل قبله
const SUPABASE_URL = 'https://wxlzgjlsyltjbqaryliz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_o9GysQqd6PzMCtzJOx3EUQ_KUgR4Qlc';

if (typeof supabase === 'undefined' || !supabase || typeof supabase.createClient !== 'function') {
  console.error('❌ مكتبة Supabase ما تحمّلت. تأكد من تحميل CDN قبل هذا الملف.');
  window.db = null;
} else {
  try {
    window.db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('✅ تم توصيل السلك بقاعدة البيانات بنجاح!');
  } catch (e) {
    console.error('❌ فشل إنشاء Supabase client:', e);
    window.db = null;
  }
}