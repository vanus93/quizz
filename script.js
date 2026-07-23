// Variable Global
let questions = [];
let currentQuestionIndex = 0;
let userAnswers = []; // Menampung riwayat jawaban untuk resume
let score = 0;

/**
 * Helper: Mengacak urutan elemen dalam array (Fisher-Yates Shuffle)
 */
function shuffleArray(array) {
    let shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

/**
 * Mengekstrak ID Google Sheet dan memaksanya menggunakan GViz API CSV Endpoint
 */
function formatCsvUrl(input) {
  let cleanInput = input.trim();
  let sheetId = "";

  // 1. Ekstrak ID jika input berupa URL Google Sheet (edit, view, pub, dll)
  const sheetIdMatch = cleanInput.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (sheetIdMatch && sheetIdMatch[1]) {
    sheetId = sheetIdMatch[1];
  } else if (!cleanInput.includes('http')) {
    // 2. Jika input yang dimasukkan HANYA ID-nya saja
    sheetId = cleanInput;
  }

  // Jika ID ditemukan, gunakan GViz API Endpoint (Anti HTML/Web Page)
  if (sheetId) {
    return `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`;
  }

  return cleanInput;
}

/**
 * Memuat data soal dari Google Sheet & mengacak urutannya
 */
function loadQuestions(rawUrl) {
    let csvUrl = formatCsvUrl(rawUrl);
    
    // Cache Buster agar data selalu update saat Sheet diedit
    const cacheBuster = (csvUrl.includes('?') ? '&' : '?') + 't=' + new Date().getTime();
    const finalUrl = csvUrl + cacheBuster;

    Papa.parse(finalUrl, {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
            // Proteksi Tambahan: Cek jika Google mengembalikan file HTML
            const firstKey = results.data[0] ? Object.keys(results.data[0])[0] : '';
            if (firstKey.toLowerCase().includes('html') || firstKey.toLowerCase().includes('doctype')) {
                alert("Akses Ditolak/File HTML: Pastikan akses Google Sheet diatur ke 'Anyone with the link' (Siapa saja yang memiliki link).");
                return;
            }

            if (results.data && results.data.length > 0) {
                // ACAK URUTAN SOAL
                questions = shuffleArray(results.data);

                // Reset State Game
                currentQuestionIndex = 0;
                score = 0;
                userAnswers = [];
                
                document.getElementById('setupContainer').classList.add('hidden');
                document.getElementById('quizSummary').classList.add('hidden');
                document.getElementById('quizContainer').classList.remove('hidden');
                displayQuestion();
            } else {
                alert("File berhasil dibaca, tetapi tidak ada data soal di dalamnya. Cek header kolom!");
            }
        },
        error: function(err) {
            console.error("Error PapaParse:", err);
            alert("Gagal memuat soal. Pastikan link Google Sheet benar dan opsi 'General Access' diset ke Anyone with the link.");
        }
    });
}

/**
 * Helper fleksibel untuk pencarian nama kolom (case-insensitive)
 */
function getFieldValue(row, possibleKeys) {
    for (let key of Object.keys(row)) {
        const cleanKey = key.trim().toLowerCase();
        if (possibleKeys.includes(cleanKey)) {
            return row[key];
        }
    }
    return null;
}

/**
 * Menampilkan Soal dan Opsi Jawaban (Soal & Opsi Teracak)
 */
function displayQuestion() {
    if (currentQuestionIndex >= questions.length) {
        showSummary();
        return;
    }

    const currentQ = questions[currentQuestionIndex];
    const questionText = getFieldValue(currentQ, ['soal', 'question', 'pertanyaan']) || 'Teks soal tidak ditemukan';
    
    document.getElementById('questionText').innerText = `Soal ${currentQuestionIndex + 1} dari ${questions.length}: ${questionText}`;

    const optionsDiv = document.getElementById('optionsContainer');
    optionsDiv.innerHTML = '';

    const optionKeys = ['a', 'b', 'c', 'd'];
    let availableOptions = [];

    // Kumpulkan opsi yang memiliki isi
    optionKeys.forEach(opt => {
        const optValue = getFieldValue(currentQ, [opt, `option_${opt}`, `pilihan_${opt}`, `jawaban_${opt}`]);
        if (optValue) {
            availableOptions.push({
                key: opt,        // Identitas kunci asli ('a', 'b', 'c', atau 'd')
                value: optValue  // Teks jawaban
            });
        }
    });

    // ACAK URUTAN OPSI JAWABAN
    availableOptions = shuffleArray(availableOptions);

    // Tampilkan tombol opsi
    availableOptions.forEach((optItem, index) => {
        const displayLabel = String.fromCharCode(65 + index); // Ubah index 0,1,2,3 menjadi A, B, C, D
        const btn = document.createElement('button');
        
        btn.innerText = `${displayLabel}. ${optItem.value}`;
        // Tetap meneruskan optItem.key (kunci asli dari sheet) untuk pengecekan skor
        btn.onclick = () => handleAnswer(optItem.key, optItem.value); 
        
        optionsDiv.appendChild(btn);
    });
}

/**
 * Menyimpan jawaban user & lanjut otomatis
 */
function handleAnswer(selectedOptKey, selectedText) {
    const currentQ = questions[currentQuestionIndex];
    const questionText = getFieldValue(currentQ, ['soal', 'question', 'pertanyaan']) || 'Soal';
    const correctAnswerKey = (getFieldValue(currentQ, ['kunci', 'jawaban', 'key', 'correct']) || '').trim().toLowerCase();
    
    const isCorrect = selectedOptKey.toLowerCase() === correctAnswerKey;

    if (isCorrect) {
        score++;
    }

    userAnswers.push({
        questionNumber: currentQuestionIndex + 1,
        questionText: questionText,
        selectedText: selectedText,
        correctKey: correctAnswerKey.toUpperCase(),
        isCorrect: isCorrect
    });

    currentQuestionIndex++;
    displayQuestion();
}

/**
 * Menampilkan Halaman Resume Hasil
 */
function showSummary() {
    document.getElementById('quizContainer').classList.add('hidden');
    document.getElementById('quizSummary').classList.remove('hidden');

    const totalQuestions = questions.length;
    const percentage = Math.round((score / totalQuestions) * 100);

    document.getElementById('scoreText').innerText = `${score} / ${totalQuestions}`;
    document.getElementById('percentageText').innerText = `Nilai: ${percentage}%`;

    const summaryDetails = document.getElementById('summaryDetails');
    summaryDetails.innerHTML = '';

    userAnswers.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = `summary-item ${item.isCorrect ? 'correct' : 'wrong'}`;

        itemDiv.innerHTML = `
            <p><strong>Soal ${item.questionNumber}:</strong> ${item.questionText}</p>
            <p class="user-ans">Jawaban Kamu: <b>${item.selectedText}</b> ${item.isCorrect ? '✅' : '❌'}</p>
            ${!item.isCorrect ? `<p class="correct-ans">Kunci Jawaban: <b>Pilihan ${item.correctKey}</b></p>` : ''}
        `;

        summaryDetails.appendChild(itemDiv);
    });
}

/**
 * Reset Permainan
 */
function resetQuiz() {
    document.getElementById('quizSummary').classList.add('hidden');
    document.getElementById('setupContainer').classList.remove('hidden');
}

/**
 * Trigger Tombol Mulai Game
 */
function startGame() {
    const inputVal = document.getElementById('sheetInput').value;
    if (!inputVal) {
        alert("Harap masukkan URL atau ID Google Sheet terlebih dahulu!");
        return;
    }
    loadQuestions(inputVal);
}
