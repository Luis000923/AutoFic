document.addEventListener('DOMContentLoaded', () => {
    const AUTO_USER_NAME = 'AutoFic';

    // ===== READER TAB ELEMENTS =====
    const enabledToggle = document.getElementById('enabledToggle');
    const redirectToggle = document.getElementById('redirectToggle');
    const minMinutesInput = document.getElementById('minMinutes');
    const minSecondsInput = document.getElementById('minSeconds');
    const maxMinutesInput = document.getElementById('maxMinutes');
    const maxSecondsInput = document.getElementById('maxSeconds');
    const targetDomainInput = document.getElementById('targetDomain');
    const downloadBtn = document.getElementById('downloadBtn');
    const questionsBtn = document.getElementById('questionsBtn');
    const saveBtn = document.getElementById('saveBtn');
    const statusBadge = document.getElementById('statusBadge');

    // ===== QUIZ TAB ELEMENTS =====
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    const quizLevel = document.getElementById('quizLevel');
    const quizBookName = document.getElementById('quizBookName');
    const quizChapterName = document.getElementById('quizChapterName');
    const chapterFile = document.getElementById('chapterFile');
    const chapterContent = document.getElementById('chapterContent');
    const questionsText = document.getElementById('questionsText');
    const questionCount = document.getElementById('questionCount');
    const processQuizBtn = document.getElementById('processQuizBtn');
    const processingStatus = document.getElementById('processingStatus');

    // ===== READER TAB INITIALIZATION =====
    chrome.storage.local.get(['minInterval', 'maxInterval', 'targetDomain', 'enabled', 'redirectEnabled'], (result) => {
        const minInterval = result.minInterval || DEFAULT_CONFIG.minInterval;
        const maxInterval = result.maxInterval || DEFAULT_CONFIG.maxInterval;
        const targetDomain = result.targetDomain || DEFAULT_CONFIG.targetDomain;
        const enabled = result.enabled !== undefined ? result.enabled : DEFAULT_CONFIG.enabled;
        const redirectEnabled = result.redirectEnabled !== undefined ? result.redirectEnabled : DEFAULT_CONFIG.redirectEnabled;

        minMinutesInput.value = Math.floor(minInterval / 60000);
        minSecondsInput.value = Math.floor((minInterval % 60000) / 1000);
        maxMinutesInput.value = Math.floor(maxInterval / 60000);
        maxSecondsInput.value = Math.floor((maxInterval % 60000) / 1000);

        targetDomainInput.value = targetDomain;
        enabledToggle.checked = enabled;
        redirectToggle.checked = redirectEnabled;
        updateBadge(enabled);
    });

    function updateBadge(enabled) {
        if (enabled) {
            statusBadge.textContent = 'Activo';
            statusBadge.style.color = '#10b981';
            statusBadge.style.background = 'rgba(16, 185, 129, 0.1)';
            statusBadge.style.borderColor = 'rgba(16, 185, 129, 0.3)';
        } else {
            statusBadge.textContent = 'Inactivo';
            statusBadge.style.color = '#ef4444';
            statusBadge.style.background = 'rgba(239, 68, 68, 0.1)';
            statusBadge.style.borderColor = 'rgba(239, 68, 68, 0.3)';
        }
    }

    // ===== TAB SWITCHING =====
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.dataset.tab;
            const targetTab = document.getElementById(tabName + '-tab');

            if (!targetTab) {
                return;
            }
            
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            btn.classList.add('active');
            targetTab.classList.add('active');
        });
    });

    // ===== READER TAB LISTENERS =====
    saveBtn.addEventListener('click', () => {
        const minMs = (parseInt(minMinutesInput.value || 0) * 60000) + (parseInt(minSecondsInput.value || 0) * 1000);
        const maxMs = (parseInt(maxMinutesInput.value || 0) * 60000) + (parseInt(maxSecondsInput.value || 0) * 1000);
        const targetDomain = targetDomainInput.value;
        const enabled = enabledToggle.checked;
        const redirectEnabled = redirectToggle.checked;

        if (isNaN(minMs) || isNaN(maxMs) || minMs > maxMs || minMs < 1000) {
            alert('Por favor ingrese intervalos válidos (mínimo <= máximo, y al menos 1 segundo)');
            return;
        }

        chrome.storage.local.set({
            minInterval: minMs,
            maxInterval: maxMs,
            targetDomain,
            enabled,
            redirectEnabled
        }, () => {
            updateBadge(enabled);

            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0]) {
                    chrome.tabs.sendMessage(tabs[0].id, { type: 'UPDATE_CONFIG' }).catch(err => {
                    });
                }
            });

            saveBtn.textContent = '¡Guardado!';
            saveBtn.style.background = 'linear-gradient(to right, #10b981, #059669)';

            setTimeout(() => {
                saveBtn.textContent = 'Guardar Configuración';
                saveBtn.style.background = 'linear-gradient(to right, #6366f1, #8b5cf6)';
            }, 2000);
        });
    });

    downloadBtn.addEventListener('click', () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, { type: 'DOWNLOAD_CHAPTER' }).catch(err => {
                    alert('Error: Por favor, recarga la página del libro para activar la extensión.');
                    downloadBtn.textContent = 'Recargar Página';
                    downloadBtn.disabled = false;
                });
            }
        });

        const originalText = downloadBtn.textContent;
        downloadBtn.textContent = '¡Descargando!';
        downloadBtn.disabled = true;
        setTimeout(() => {
            if (downloadBtn.disabled) {
                downloadBtn.textContent = originalText;
                downloadBtn.disabled = false;
            }
        }, 2000);
    });

    questionsBtn.addEventListener('click', () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, { type: 'SHOW_QUESTIONS' }).catch(err => {
                    alert('Error: Por favor, recarga la página del libro para activar la extensión.');
                });
            }
        });
    });

    enabledToggle.addEventListener('change', () => {
        updateBadge(enabledToggle.checked);
    });

    // ===== QUIZ TAB LISTENERS =====
    chapterFile.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                chapterContent.value = event.target.result;
            };
            reader.readAsText(file);
        }
    });

    questionsText.addEventListener('input', () => {
        const questions = parseQuestions(questionsText.value);
        questionCount.textContent = `Preguntas detectadas: ${questions.length}/10`;
    });

    processQuizBtn.addEventListener('click', async () => {
        processingStatus.textContent = '';
        processingStatus.className = '';

        // Validaciones
        if (!quizLevel.value) {
            showError('Por favor selecciona un nivel');
            return;
        }

        if (!quizBookName.value.trim()) {
            showError('Por favor ingresa el nombre del libro');
            return;
        }

        if (!quizChapterName.value.trim()) {
            showError('Por favor ingresa el nombre del capítulo');
            return;
        }

        if (!chapterContent.value.trim()) {
            showError('Por favor carga el contenido del capítulo');
            return;
        }

        const questions = parseQuestions(questionsText.value);
        if (questions.length < 10) {
            showError(`Se requieren 10 preguntas. Detectadas: ${questions.length}`);
            return;
        }

        // Procesar
        await sendToBackend(questions);
    });

    function parseQuestions(text) {
        const questions = [];
        const lines = text.split('\n');
        let currentQuestion = null;

        for (const line of lines) {
            const trimmed = line.trim();

            // Detectar nueva pregunta (número al inicio seguido de punto)
            const questionMatch = trimmed.match(/^(\d+)\.\s*(.+)/);
            if (questionMatch) {
                if (currentQuestion) {
                    questions.push(currentQuestion);
                }
                currentQuestion = {
                    question: questionMatch[2],
                    options: []
                };
                continue;
            }

            if (!currentQuestion) continue;

            // Detectar opciones (a), b), c), d) o - Opción)
            const optionMatch = trimmed.match(/^[a-d]\)\s*(.+)|^[-•]\s*(.+)/);
            if (optionMatch) {
                const option = optionMatch[1] || optionMatch[2];
                if (option) {
                    currentQuestion.options.push(option);
                }
            }
        }

        if (currentQuestion && currentQuestion.options.length > 0) {
            questions.push(currentQuestion);
        }

        return questions;
    }

    async function sendToBackend(questions) {
        processQuizBtn.disabled = true;
        showStatus('Procesando...', 'loading');

        try {
            const payload = {
                userName: AUTO_USER_NAME,
                bookId: 0,
                chapterId: 0,
                level: parseInt(quizLevel.value),
                bookName: quizBookName.value.trim(),
                chapterName: `Capítulo ${quizChapterName.value}`,
                chapterContent: chapterContent.value.trim(),
                questions: questions
            };

            const response = await fetch('https://free-quiz.varios.store/api/quiz-answer', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (result.success) {
                showSuccess(`✓ Quiz procesado correctamente!\n\nSiguiente paso: Sube el PDF en\nhttps://free-quiz.varios.store/apoyar-con-quiz`);
                // Limpiar formulario
                setTimeout(() => {
                    quizLevel.value = '';
                    quizBookName.value = '';
                    quizChapterName.value = '';
                    chapterContent.value = '';
                    questionsText.value = '';
                    questionCount.textContent = 'Preguntas detectadas: 0/10';
                }, 2000);
            } else {
                showError(result.error || 'Error al procesar el quiz');
            }
        } catch (error) {
            console.error('Error:', error);
            showError('Error de conexión con el servidor');
        } finally {
            processQuizBtn.disabled = false;
        }
    }

    function showError(message) {
        processingStatus.textContent = '✗ ' + message;
        processingStatus.className = 'error';
    }

    function showSuccess(message) {
        processingStatus.textContent = message;
        processingStatus.className = 'success';
    }

    function showStatus(message, type) {
        processingStatus.textContent = message;
        processingStatus.className = type;
    }
});
