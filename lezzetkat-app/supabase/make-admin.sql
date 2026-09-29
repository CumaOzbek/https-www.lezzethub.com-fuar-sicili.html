-- =====================================================================
-- İlk yönetici hesabını oluşturma (isteğe bağlı)
-- Not: ozbek.info@gmail.com zaten kayıtlı yönetici e-postasıdır ve otomatik yönetici olur.
-- Bu dosya yalnızca başka bir adresi elle yönetici yapmak için gerekir.
-- 1) Uygulamadan normal şekilde kayıt ol.
-- 2) Aşağıdaki e-posta adresini kendi adresinle değiştirip SQL Editor'de çalıştır.
-- Sonraki adminleri uygulama içindeki Admin → Kullanıcılar ekranından atayabilirsin.
-- =====================================================================

update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'SENIN-EPOSTAN@ornek.com');
