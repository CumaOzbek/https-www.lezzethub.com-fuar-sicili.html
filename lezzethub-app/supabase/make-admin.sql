-- =====================================================================
-- İlk yönetici hesabını oluşturma
-- 1) Uygulamadan normal şekilde kayıt ol.
-- 2) Aşağıdaki e-posta adresini kendi adresinle değiştirip SQL Editor'de çalıştır.
-- Sonraki adminleri uygulama içindeki Admin → Kullanıcılar ekranından atayabilirsin.
-- =====================================================================

update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'SENIN-EPOSTAN@ornek.com');
