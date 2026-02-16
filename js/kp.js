<script>
        const scriptURL = 'https://script.google.com/macros/s/AKfycbwyb72P0r7gF8UKK-On1MKR4-N4C-mck6M3O_dZGtmhfOYPnO8IaJez7dIHCXk8SWMkkQ/exec';
        
        const form = document.forms['kpForm'];
        const btnKirim = document.querySelector('.btn-kirim');
        const btnLoading = document.querySelector('.btn-loading');

        form.addEventListener('submit', e => {
            e.preventDefault();

            // 1. Tampilkan Loading
            btnLoading.classList.remove('d-none');
            btnKirim.classList.add('d-none');

            // 2. Kirim Data (TANPA mode: 'no-cors')
            fetch(scriptURL, {
                method: 'POST',
                body: new FormData(form)
            })
            .then(response => response.json()) // Ubah ke JSON agar bisa dibaca
            .then(data => {
                // 3. Cek Respon dari Apps Script
                if (data.result === 'success') {
                    // SUKSES
                    alert('✅ BERHASIL TERKIRIM!\n\nData pendaftaran KP Anda telah masuk ke Database Jurusan.\nSilakan cek tabel monitoring di bawah.');
                    form.reset();

                    // Refresh iframe otomatis (tambah timestamp agar tidak dicache browser)
                    const iframe = document.getElementById('dataFrame');
                    if (iframe) {
                        // Tambah jeda sedikit agar Google Sheet sempat update
                        setTimeout(() => {
                            iframe.src = iframe.src.split('?')[0] + '?widget=true&headers=false&t=' + new Date().getTime();
                        }, 1500);
                    }
                } else {
                    // ERROR (Misal: Email bukan Unsri)
                    alert('❌ GAGAL DISIMPAN!\n\nPesan Sistem: ' + data.error);
                }

                // Kembalikan Tombol
                btnLoading.classList.add('d-none');
                btnKirim.classList.remove('d-none');
            })
            .catch(error => {
                // ERROR JARINGAN
                console.error('Error!', error);
                alert('⚠️ Terjadi Kesalahan Koneksi!\n\nPastikan internet Anda lancar dan coba lagi.');
                
                btnLoading.classList.add('d-none');
                btnKirim.classList.remove('d-none');
            });
        });
    </script>