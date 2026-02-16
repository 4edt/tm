// ============================================
// KONFIGURASI SEMINAR
// ============================================
var seminarSheetName = '2026';
var seminarSpreadsheetId = '12vp90tJRTecge-7G0H06bL4RGJqtGwpNdgTBNd3STdw';
var uploadFolderId = '1eTNicPMMEVGp8hZsVbJz_ZJ2b_cEaDjz';

// ============================================
// FUNGSI doGet - HARUS ADA UNTUK WEB APP
// ============================================
function doGet() {
  return HtmlService.createHtmlOutputFromFile('seminar')
    .setTitle('Pendaftaran Seminar - Teknik Mesin Unsri')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ============================================
// FUNGSI AUTENTIKASI
// ============================================
function getUserEmail() {
  try {
    var email = Session.getActiveUser().getEmail();
    
    if (!email || email === '') {
      return {
        success: false,
        message: 'Tidak dapat mengambil email. Pastikan Anda sudah login.'
      };
    }
    
    var lowerEmail = email.toLowerCase();
    if (!lowerEmail.endsWith('@unsri.ac.id') && !lowerEmail.endsWith('@student.unsri.ac.id')) {
      return {
        success: false,
        message: 'Akses ditolak! Hanya email @unsri.ac.id atau @student.unsri.ac.id yang diizinkan.'
      };
    }
    
    return {
      success: true,
      email: email
    };
  } catch (error) {
    return {
      success: false,
      message: error.message
    };
  }
}

// ============================================
// FUNGSI UPLOAD FILE KE GOOGLE DRIVE
// ============================================
function uploadFileToDrive(base64Data, fileName, mimeType) {
  try {
    Logger.log('Starting file upload: ' + fileName);
    
    // Decode base64
    var decodedData = Utilities.newBlob(
      Utilities.base64Decode(base64Data), 
      mimeType, 
      fileName
    );
    
    Logger.log('File decoded successfully');
    
    // Get upload folder
    var folder = DriveApp.getFolderById(uploadFolderId);
    Logger.log('Folder found: ' + folder.getName());
    
    // Create file in folder
    var file = folder.createFile(decodedData);
    Logger.log('File created: ' + file.getId());
    
    // Set file sharing to anyone with link
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    Logger.log('File sharing set');
    
    // Get file URL
    var fileUrl = file.getUrl();
    var fileId = file.getId();
    
    return {
      success: true,
      fileId: fileId,
      fileUrl: fileUrl,
      fileName: file.getName()
    };
    
  } catch (error) {
    Logger.log('Upload error: ' + error.toString());
    return {
      success: false,
      error: error.toString()
    };
  }
}

// ============================================
// FUNGSI SUBMIT SEMINAR
// ============================================
function submitSeminarForm(formData, fileData) {
  var lock = LockService.getScriptLock();
  
  try {
    lock.tryLock(10000);
    
    Logger.log('=== SEMINAR SUBMISSION START ===');
    Logger.log('Form Data: ' + JSON.stringify(formData));
    Logger.log('File Name: ' + fileData.fileName);
    
    // Verifikasi email user
    var userEmail = Session.getActiveUser().getEmail();
    Logger.log('User Email: ' + userEmail);
    
    if (!userEmail || userEmail === '') {
      return {
        result: 'error',
        error: 'Anda belum login. Silakan login menggunakan akun Google Unsri.'
      };
    }
    
    var lowerEmail = userEmail.toLowerCase();
    if (!lowerEmail.endsWith('@unsri.ac.id') && !lowerEmail.endsWith('@student.unsri.ac.id')) {
      return {
        result: 'error',
        error: 'Akses ditolak! Hanya email institusi Unsri yang diperbolehkan.'
      };
    }
    
    // Upload file ke Google Drive
    Logger.log('Uploading file to Drive...');
    var uploadResult = uploadFileToDrive(
      fileData.data, 
      fileData.fileName, 
      fileData.mimeType
    );
    
    if (!uploadResult.success) {
      Logger.log('Upload failed: ' + uploadResult.error);
      return {
        result: 'error',
        error: 'Gagal mengupload file: ' + uploadResult.error
      };
    }
    
    Logger.log('File uploaded successfully: ' + uploadResult.fileUrl);
    
    // Buka spreadsheet
    var spreadsheet = SpreadsheetApp.openById(seminarSpreadsheetId);
    var sheet = spreadsheet.getSheetByName(seminarSheetName);
    
    if (!sheet) {
      Logger.log('Sheet not found: ' + seminarSheetName);
      return {
        result: 'error',
        error: 'Sheet "' + seminarSheetName + '" tidak ditemukan!'
      };
    }
    
    // Validasi data
    if (!formData.nama || !formData.nim || !formData.judul || !formData.pembimbing) {
      return {
        result: 'error',
        error: 'Data tidak lengkap! Mohon isi semua field yang wajib.'
      };
    }
    
    // Get next row
    var nextRow = sheet.getLastRow() + 1;
    Logger.log('Next row: ' + nextRow);
    
    // Prepare data row
    var newRow = [
      new Date(),                    // A: Timestamp
      formData.nama,                 // B: Nama
      "'" + formData.nim,            // C: NIM
      formData.judul,                // D: Judul
      formData.pembimbing,           // E: Dosen Pembimbing
      uploadResult.fileUrl,          // F: Link File
      userEmail,                     // G: Email
      'Pending'                      // H: Status
    ];
    
    // Insert to sheet
    sheet.getRange(nextRow, 1, 1, newRow.length).setValues([newRow]);
    Logger.log('Data inserted to row: ' + nextRow);
    
    // Kirim email notifikasi
    try {
      sendSeminarNotification(formData, userEmail, uploadResult.fileUrl);
      Logger.log('Email notification sent');
    } catch (e) {
      Logger.log('Email notification failed: ' + e.message);
    }
    
    Logger.log('=== SEMINAR SUBMISSION SUCCESS ===');
    
    return {
      result: 'success',
      row: nextRow,
      fileUrl: uploadResult.fileUrl,
      message: 'Pendaftaran seminar berhasil! Email konfirmasi telah dikirim ke ' + userEmail
    };
    
  } catch (error) {
    Logger.log('=== SEMINAR SUBMISSION ERROR ===');
    Logger.log('Error: ' + error.message);
    Logger.log('Stack: ' + error.stack);
    
    return {
      result: 'error',
      error: 'Terjadi kesalahan: ' + error.message
    };
  } finally {
    lock.releaseLock();
  }
}

// ============================================
// FUNGSI KIRIM EMAIL NOTIFIKASI
// ============================================
function sendSeminarNotification(formData, email, fileUrl) {
  var subject = 'Konfirmasi Pendaftaran Seminar - ' + formData.nama;
  var htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #0066cc; padding: 20px; text-align: center;">
        <h2 style="color: white; margin: 0;">Jurusan Teknik Mesin UNSRI</h2>
      </div>
      
      <div style="padding: 20px; background-color: #f9f9f9;">
        <h3 style="color: #0066cc;">Konfirmasi Pendaftaran Seminar</h3>
        <p>Terima kasih telah mendaftar Seminar di Jurusan Teknik Mesin Unsri.</p>
        
        <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h4 style="margin-top: 0; color: #333;">Detail Pendaftaran:</h4>
          <table style="width: 100%; border-collapse: collapse;">
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 8px 0; font-weight: bold; width: 40%;">Nama:</td>
              <td style="padding: 8px 0;">${formData.nama}</td>
            </tr>
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 8px 0; font-weight: bold;">NIM:</td>
              <td style="padding: 8px 0;">${formData.nim}</td>
            </tr>
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 8px 0; font-weight: bold;">Judul:</td>
              <td style="padding: 8px 0;">${formData.judul}</td>
            </tr>
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 8px 0; font-weight: bold;">Dosen Pembimbing:</td>
              <td style="padding: 8px 0;">${formData.pembimbing}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold;">File:</td>
              <td style="padding: 8px 0;">
                <a href="${fileUrl}" style="color: #0066cc; text-decoration: none;">
                  <strong>Lihat File PDF</strong>
                </a>
              </td>
            </tr>
          </table>
        </div>
        
        <div style="background-color: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; border-radius: 4px; margin: 20px 0;">
          <p style="margin: 0;"><strong>Status:</strong> Menunggu Verifikasi Admin</p>
        </div>
        
        <p>Anda dapat memantau status pendaftaran melalui website Teknik Mesin Unsri.</p>
      </div>
      
      <div style="background-color: #333; color: #fff; padding: 15px; text-align: center; font-size: 12px;">
        <p style="margin: 5px 0;">Jurusan Teknik Mesin, Fakultas Teknik</p>
        <p style="margin: 5px 0;">Universitas Sriwijaya</p>
        <p style="margin: 5px 0;">Email: mesin@ft.unsri.ac.id | Telp: +62 812-7036-0756</p>
      </div>
    </div>
  `;
  
  MailApp.sendEmail({
    to: email,
    subject: subject,
    htmlBody: htmlBody
  });
}