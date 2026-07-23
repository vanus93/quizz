// Variable Global State
let questions = [];
let currentQuestionIndex = 0;
let userAnswers = [];
let score = 0;

/**
 * Mengacak urutan elemen dalam array (Fisher-Yates Shuffle)
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
 * Format & Paksa URL menggunakan Google Visualization (GViz) CSV Endpoint
 */
function formatCsvUrl(input) {
  let cleanInput = input.trim();
  let sheetId = "";

  const sheetIdMatch = cleanInput.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (sheetIdMatch && sheetIdMatch[1]) {
    sheetId = sheetIdMatch[1];
  } else if (!cleanInput.includes('http')) {
    sheetId = cleanInput;
  }

  if (sheetId) {
    return `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`;
  }

  return cleanInput;
}

/**
 * Fetch Data dari Google Sheet & Acak Urutan Soal
 */
function loadQuestions(rawUrl) {
    let csvUrl = formatCsvUrl(rawUrl);
    
    // Cache Buster untuk mencegah browser HP menyimpan cache file lama
    const cacheBuster = (csvUrl.includes('?') ? '&' : '?') + 't=' + new Date().getTime();
    const finalUrl = csvUrl + cacheBuster;

    Papa.parse(finalUrl, {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
            // Proteksi jika Google mengembalikan halaman login HTML
            const firstKey = results.data[0] ? Object.keys(results.data[0])[0] : '';
            if (firstKey.toLowerCase().includes('html') || firstKey.toLowerCase().includes('doctype')) {
                alert("Akses Ditolak: Pastikan akses Google Sheet diatur ke 'Anyone with the link'.");
                return;
            }

            if (results.data && results.data.length > 0) {
                // ACAK URUTAN SOAL
                questions = shuffleArray(results.data);

                // Reset State
                currentQuestionIndex = 0;
                score = 0;
                userAnswers = [];
                
                document.getElementById('setupContainer').classList.add('hidden');
                document.getElementById('quizSummary').classList.add('hidden');
                document.getElementById('quizContainer').classList.remove('hidden');
                displayQuestion();
            } else {
                alert("Data soal tidak ditemukan. Periksa kembali struktur header Google Sheet kamu.");
            }
        },
        error: function(err) {
            console.error("Error PapaParse:", err);
            alert("Gagal memuat soal. Pastikan link Google Sheet benar dan akses diset ke Public.");
        }
    });
}

/**
 * Helper Pencarian Nama Kolom (Case-Insensitive)
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
 * Menampilkan Soal & Opsi Jawaban Teracak
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
    optionsDiv.classList.remove('disabled'); // Re-enable tombol untuk soal baru

    const optionKeys = ['a', 'b', 'c', 'd'];
    let availableOptions = [];

    // Kumpulkan opsi yang tersedia
    optionKeys.forEach(opt => {
        const optValue = getFieldValue(currentQ, [opt, `option_${opt}`, `pilihan_${opt}`, `jawaban_${opt}`]);
        if (optValue) {
            availableOptions.push({
                key: opt,        // Identitas kunci asli ('a', 'b', 'c', atau 'd')
                value: optValue  // Teks Jawaban
            });
        }
    });

    // ACAK URUTAN OPSI JAWABAN
    availableOptions = shuffleArray(availableOptions);

    // Tampilkan tombol opsi
    availableOptions.forEach((optItem, index) => {
        const displayLabel = String.fromCharCode(65 + index); // Ubah index ke huruf (A, B, C, D)
        const btn = document.createElement('button');
        
        btn.innerText = `${displayLabel}. ${optItem.value}`;
        btn.setAttribute('data-key', optItem.key.toLowerCase()); // Simpan kunci asli di atribut
        
        btn.onclick = () => handleAnswer(optItem.key, optItem.value, btn); 
        
        optionsDiv.appendChild(btn);
    });
}

/**
 * Menyimpan Jawaban, Memberi Indikator Warna, & Memberi Jeda
 */
function handleAnswer(selectedOptKey, selectedText, clickedButton) {
    const optionsDiv = document.getElementById('optionsContainer');
    
    // Kunci tombol agar tidak bisa di-spam klik selama jeda
    optionsDiv.classList.add('disabled');

    const currentQ = questions[currentQuestionIndex];
    const questionText = getFieldValue(currentQ, ['soal', 'question', 'pertanyaan']) || 'Soal';
    const correctAnswerKey = (getFieldValue(currentQ, ['kunci', 'jawaban', 'key', 'correct']) || '').trim().toLowerCase();
    
    const isCorrect = selectedOptKey.toLowerCase() === correctAnswerKey;

    if (isCorrect) {
        score++;
        clickedButton.classList.add('btn-correct'); // Warna Hijau
    } else {
        clickedButton.classList.add('btn-wrong');   // Warna Merah

        // Tunjukkan tombol dengan jawaban yang benar
        const buttons = optionsDiv.querySelectorAll('button');
        buttons.forEach(btn => {
            if (btn.getAttribute('data-key') === correctAnswerKey) {
                btn.classList.add('btn-correct');
            }
        });
    }

    // Simpan Histori
    userAnswers.push({
        questionNumber: currentQuestionIndex + 1,
        questionText: questionText,
        selectedText: selectedText,
        correctKey: correctAnswerKey.toUpperCase(),
        isCorrect: isCorrect
    });

    // Jeda 1 detik (1000ms) sebelum berpindah ke soal berikutnya
    setTimeout(() => {
        currentQuestionIndex++;
        displayQuestion();
    }, 1000);
}

/**
 * Tampilan Hasil Kuis
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
 * Reset Game
 */
function resetQuiz() {
    document.getElementById('quizSummary').classList.add('hidden');
    document.getElementById('setupContainer').classList.remove('hidden');
}

/**
 * Handler Tombol Mulai
 */
function startGame() {
    const inputVal = document.getElementById('sheetInput').value;
    if (!inputVal) {
        alert("Harap masukkan URL atau ID Google Sheet terlebih dahulu!");
        return;
    }
    loadQuestions(inputVal);
}
