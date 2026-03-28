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
    const questionCount = document.getElementById('questionCount');
    const captureAllBtn = document.getElementById('captureAllBtn');
    const autoAnswerToggle = document.getElementById('autoAnswerToggle');
    const answersPreview = document.getElementById('answersPreview');
    const processQuizBtn = document.getElementById('processQuizBtn');
    const processingStatus = document.getElementById('processingStatus');

    const capturedQuestions = [];

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

    // ===== AUTO-FILL QUIZ INFO FROM URL =====
    async function autoFillQuizInfo() {
        const tab = await getActiveTab();
        if (!tab || !tab.url) return;

        const urlMatch = tab.url.match(/\/libros\/([^\/]+)\/capitulos\/(\d+)-(.+?)\/quiz\//i);
        if (!urlMatch) return;

        const [_, bookSlug, chapterNum] = urlMatch;
        
        if (bookSlug) {
            const bookName = bookSlug.split('-')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
            quizBookName.value = bookName;
        }

        if (chapterNum) {
            quizChapterName.value = 'Capítulo ' + chapterNum;
        }
    }

    autoFillQuizInfo();

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

    captureAllBtn.addEventListener('click', async () => {
        if (!chapterContent.value.trim()) {
            showError('Primero carga o pega el contenido del capítulo.');
            return;
        }

        await captureAndResolveAllQuestions();
    });

    processQuizBtn.addEventListener('click', async () => {
        processingStatus.textContent = '';
        processingStatus.className = '';

        // Validaciones
        if (!quizLevel.value) {
            showError('Por favor selecciona un nivel');
            return;
        }

        if (!chapterContent.value.trim()) {
            showError('Carga o pega el contenido del capítulo para procesar.');
            return;
        }

        if (capturedQuestions.length < 1) {
            showError('Captura preguntas antes de procesar.');
            return;
        }

        // Procesar
        await sendToBackend(capturedQuestions);
    });

    async function captureCurrentQuestion() {
        const tab = await getActiveTab();
        if (!tab) {
            showError('No se encontró una pestaña activa.');
            return null;
        }

        try {
            const data = await sendTabMessage(tab.id, { type: 'EXTRACT_QUIZ_QUESTION' });
            if (!data || !data.question || !Array.isArray(data.options) || data.options.length < 2) {
                showError('No se pudo leer la pregunta actual. Asegúrate de estar en una página de quiz.');
                return null;
            }

            return {
                question: data.question,
                options: data.options,
                questionNumber: data.questionNumber || null,
                url: tab.url || ''
            };
        } catch (error) {
            showError('No se pudo comunicar con la página. Recarga la pestaña del quiz.');
            return null;
        }
    }

    function addOrUpdateCapturedQuestion(item) {
        const key = normalizeText(item.question);
        const idx = capturedQuestions.findIndex(q => normalizeText(q.question) === key);

        if (idx >= 0) {
            capturedQuestions[idx] = item;
        } else {
            capturedQuestions.push(item);
        }

        capturedQuestions.sort((a, b) => {
            const an = a.questionNumber || 999;
            const bn = b.questionNumber || 999;
            return an - bn;
        });

        questionCount.textContent = `Preguntas capturadas: ${capturedQuestions.length}/10`;
    }

    async function captureAndResolveAllQuestions() {
        const tab = await getActiveTab();
        if (!tab || !tab.url) {
            showError('No se encontró una pestaña de quiz activa.');
            return;
        }

        const parsed = parseQuizUrl(tab.url);
        if (!parsed) {
            showError('Abre una URL de quiz con formato .../quiz/1/ antes de capturar.');
            return;
        }

        captureAllBtn.disabled = true;
        processQuizBtn.disabled = true;
        showStatus('Capturando preguntas del 1 al 10...', 'loading');

        try {
            capturedQuestions.length = 0;

            for (let i = 1; i <= 10; i++) {
                const quizUrl = `${parsed.prefix}${i}${parsed.suffix}`;
                await navigateTab(tab.id, quizUrl);
                await delay(700);

                const data = await sendTabMessage(tab.id, { type: 'EXTRACT_QUIZ_QUESTION' });
                if (data && data.question && Array.isArray(data.options) && data.options.length >= 2) {
                    addOrUpdateCapturedQuestion({
                        question: data.question,
                        options: data.options,
                        questionNumber: i,
                        url: quizUrl
                    });
                }
            }

            renderAnswersPreview();

            if (capturedQuestions.length === 0) {
                showError('No se logró capturar preguntas automáticamente.');
                return;
            }

            await sendToBackend(capturedQuestions, {
                autoApply: autoAnswerToggle.checked,
                tabId: tab.id,
                parsedUrl: parsed
            });
        } catch (error) {
            showError('Error durante la captura automática.');
        } finally {
            captureAllBtn.disabled = false;
            processQuizBtn.disabled = false;
        }
    }

    async function sendToBackend(questions, options = {}) {
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
                if (Array.isArray(result.answers)) {
                    renderAnswersPreview(result.answers);
                }

                if (options.autoApply && Array.isArray(result.answers) && result.answers.length > 0) {
                    await autoApplyAnswers(options.tabId, options.parsedUrl, result.answers);
                }

                showSuccess(`✓ Quiz procesado correctamente!\n\nSiguiente paso: Sube el PDF en\nhttps://free-quiz.varios.store/apoyar-con-quiz`);
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

    async function autoApplyAnswers(tabId, parsedUrl, answers) {
        showStatus('Aplicando respuestas en el quiz (consentido por usuario)...', 'loading');

        for (const item of answers) {
            const n = Number(item.number || 0);
            if (n < 1 || n > 10) continue;

            const quizUrl = `${parsedUrl.prefix}${n}${parsedUrl.suffix}`;
            await navigateTab(tabId, quizUrl);
            await delay(700);

            await sendTabMessage(tabId, {
                type: 'APPLY_QUIZ_ANSWER',
                answerText: item.correctAnswer || ''
            });
        }
    }

    function renderAnswersPreview(answers = []) {
        const items = answers.length > 0 ? answers : capturedQuestions.map((q, i) => ({
            number: q.questionNumber || (i + 1),
            question: q.question,
            correctAnswer: '(pendiente de resolver)'
        }));

        if (items.length === 0) {
            answersPreview.innerHTML = '<div class="help-text">Aquí se mostrarán las respuestas correctas por pregunta.</div>';
            return;
        }

        answersPreview.innerHTML = items.map(item => {
            return `<div class="answer-item">
                <div class="answer-q">${item.number}. ${escapeHtml(item.question || '')}</div>
                <div class="answer-a">${escapeHtml(item.correctAnswer || '')}</div>
            </div>`;
        }).join('');
    }

    function parseQuizUrl(url) {
        const match = url.match(/^(.*\/quiz\/)\d+(\/?(?:\?.*)?)$/i);
        if (!match) return null;
        return {
            prefix: match[1],
            suffix: match[2] || '/'
        };
    }

    function normalizeText(text) {
        return (text || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function escapeHtml(str) {
        return (str || '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');
    }

    function getActiveTab() {
        return new Promise(resolve => {
            chrome.tabs.query({ active: true, currentWindow: true }, tabs => resolve(tabs[0] || null));
        });
    }

    function sendTabMessage(tabId, msg) {
        return new Promise((resolve, reject) => {
            chrome.tabs.sendMessage(tabId, msg, response => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                    return;
                }
                resolve(response);
            });
        });
    }

    function navigateTab(tabId, url) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                chrome.tabs.onUpdated.removeListener(listener);
                reject(new Error('Timeout de navegación'));
            }, 15000);

            const listener = (updatedTabId, info) => {
                if (updatedTabId === tabId && info.status === 'complete') {
                    clearTimeout(timeout);
                    chrome.tabs.onUpdated.removeListener(listener);
                    resolve();
                }
            };

            chrome.tabs.onUpdated.addListener(listener);
            chrome.tabs.update(tabId, { url });
        });
    }

    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
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
