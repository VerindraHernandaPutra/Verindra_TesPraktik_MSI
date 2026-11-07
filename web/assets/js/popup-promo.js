// Popup promo template: tautan "Daftar Sekarang" menutup popup lalu menuju formulir pendaftaran.
(function () {
  'use strict';
  var popup = document.getElementById('popup');
  if (!popup) return;
  popup.querySelectorAll('a').forEach(function (a) {
    a.addEventListener('click', function () { popup.style.display = 'none'; });
  });
})();
