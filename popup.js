document.addEventListener('DOMContentLoaded', () => {
    const AUTO_USER_NAME = 'AutoFic';
    const QUIZ_STATE_KEY = 'autoficQuizState';
    const QUIZ_CONTENT_KEY = 'autoficQuizChapterContent';

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
    const solveSingleBtn = document.getElementById('solveSingleBtn');
    const solveAutoBtn = document.getElementById('solveAutoBtn');
    const answersPreview = document.getElementById('answersPreview');
    const processingStatus = document.getElementById('processingStatus');
    let resolvedAnswers = [];

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
    restoreQuizState();

    enabledToggle.addEventListener('change', () => {
        updateBadge(enabledToggle.checked);
    });

    // ===== QUIZ TAB LISTENERS =====
    chapterFile.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                const text = await file.text();
                chapterContent.value = text;
                persistChapterContent(text);
                saveQuizState();
                showStatus('El txt ya esta en el servidor.', 'loading');
            } catch (_error) {
                showError('No se pudo leer el archivo .txt');
            }
        }
    });

    chapterContent.addEventListener('input', saveQuizState);
    quizLevel.addEventListener('change', saveQuizState);
    window.addEventListener('beforeunload', saveQuizState);

    solveSingleBtn.addEventListener('click', async () => {
        if (!quizLevel.value) {
            showError('Por favor selecciona un nivel');
            return;
        }

        if (!chapterContent.value.trim()) {
            showError('Carga el contenido del capítulo antes de continuar.');
            return;
        }

        await resolveSingleQuestion();
    });

    solveAutoBtn.addEventListener('click', async () => {
        if (!quizLevel.value) {
            showError('Por favor selecciona un nivel');
            return;
        }

        if (!chapterContent.value.trim()) {
            showError('Carga el contenido del capítulo antes de continuar.');
            return;
        }

        await resolveAutomaticQuiz();
    });

    async function resolveSingleQuestion() {
        const tab = await getActiveTab();
        if (!tab || !tab.url) {
            showError('No se encontró una pestaña de quiz activa.');
            return;
        }

        solveSingleBtn.disabled = true;
        showStatus('Extrayendo pregunta...', 'loading');

        try {
            // Extrae la pregunta actual
            const questionData = await sendTabMessageWithRetry(tab.id, { type: 'EXTRACT_QUIZ_QUESTION' });
            if (!questionData || !questionData.question || !Array.isArray(questionData.options) || questionData.options.length < 2) {
                showError('No se pudo leer la pregunta. Asegúrate de estar en una página de quiz válida.');
                return;
            }

            const questionNum = questionData.questionNumber || (resolvedAnswers.length + 1);
            showStatus(`Resolviendo pregunta ${questionNum}...`, 'loading');

            const result = await resolveQuestionWithApi(questionData, questionNum);

            if (result.success && Array.isArray(result.answers) && result.answers.length > 0) {
                const answer = result.answers[0];
                
                // Aplicar la respuesta en el quiz actual (sin navegar)
                showStatus('Marcando respuesta correcta...', 'loading');
                await sendTabMessageWithRetry(tab.id, {
                    type: 'APPLY_QUIZ_ANSWER',
                    answerText: answer.correctAnswer || '',
                    goNext: false
                });

                // Mostrar la respuesta en el preview
                mergeAndRenderAnswers([answer]);
                questionCount.textContent = `Estado: resueltas ${resolvedAnswers.length}`;
                showSuccess(`✓ Respuesta marcada: ${answer.correctAnswer}\n\nPuedes continuar al siguiente quiz o usar el botón nuevamente.`);
            } else {
                showError('El servidor no encontró una respuesta válida para esta pregunta.');
            }
        } catch (error) {
            const msg = String(error && error.message ? error.message : error || 'Error desconocido');
            if (msg.includes('Receiving end does not exist')) {
                showError('No se pudo conectar con la pestaña. Recarga la página del quiz e intenta de nuevo.');
            } else {
                showError(`❌ Error: ${msg}`);
            }
        } finally {
            solveSingleBtn.disabled = false;
        }
    }

    async function resolveAutomaticQuiz() {
        const tab = await getActiveTab();
        if (!tab || !tab.url) {
            showError('No se encontró una pestaña de quiz activa.');
            return;
        }

        const parsed = parseQuizUrl(tab.url);
        if (!parsed) {
            showError('Abre una URL de quiz con formato .../quiz/1/ para resolver automático.');
            return;
        }

        solveAutoBtn.disabled = true;
        solveSingleBtn.disabled = true;
        answersPreview.innerHTML = '';
        showStatus('Iniciando resolución automática...', 'loading');

        const resolved = [];

        try {
            const seenQuestions = new Set();

            for (let i = 1; i <= 40; i++) {
                const questionData = await sendTabMessageWithRetry(tab.id, { type: 'EXTRACT_QUIZ_QUESTION' });
                if (!questionData || !questionData.question || !Array.isArray(questionData.options) || questionData.options.length < 2) {
                    break;
                }

                const questionKey = normalizeText(questionData.question);
                if (seenQuestions.has(questionKey)) {
                    break;
                }
                seenQuestions.add(questionKey);

                showStatus(`Resolviendo pregunta ${i}...`, 'loading');
                const result = await resolveQuestionWithApi(questionData, i);

                if (!result.success || !Array.isArray(result.answers) || result.answers.length < 1) {
                    break;
                }

                const answer = result.answers[0];
                await sendTabMessageWithRetry(tab.id, {
                    type: 'APPLY_QUIZ_ANSWER',
                    answerText: answer.correctAnswer || '',
                    goNext: true
                });

                resolved.push(answer);
                mergeAndRenderAnswers(resolved);
                questionCount.textContent = `Estado: resueltas ${resolvedAnswers.length}`;

                const moved = await waitForNextQuestion(tab.id, questionData.question);
                if (!moved) {
                    showStatus(`Auto detenido: no se detectó siguiente pregunta tras ${resolved.length}.`, 'loading');
                    break;
                }

                // Modo automático lento para parecer lectura humana.
                await delay(2200);
            }

            if (resolved.length === 0) {
                showError('No se pudieron resolver preguntas automáticamente en esta página.');
                return;
            }

            showSuccess(`✓ Auto completado. Resueltas ${resolved.length} preguntas.`);
        } catch (error) {
            const msg = String(error && error.message ? error.message : error || 'Error desconocido');
            showError(`❌ Error automático: ${msg}`);
        } finally {
            solveAutoBtn.disabled = false;
            solveSingleBtn.disabled = false;
        }
    }

    async function waitForNextQuestion(tabId, previousQuestion, timeoutMs = 12000) {
        const start = Date.now();
        const previous = normalizeText(previousQuestion || '');

        while (Date.now() - start < timeoutMs) {
            await delay(600);

            try {
                const nextData = await sendTabMessageWithRetry(tabId, { type: 'EXTRACT_QUIZ_QUESTION' });
                const nextQuestion = normalizeText(nextData && nextData.question ? nextData.question : '');
                if (nextQuestion && nextQuestion !== previous) {
                    return true;
                }
            } catch (_error) {
                // Si durante transición falla una lectura, reintentar hasta timeout.
            }
        }

        return false;
    }

    async function resolveQuestionWithApi(questionData, questionNum) {
        const payload = {
            userName: AUTO_USER_NAME,
            bookId: 0,
            chapterId: 0,
            level: parseInt(quizLevel.value),
            bookName: quizBookName.value.trim(),
            chapterName: quizChapterName.value.trim(),
            chapterContent: chapterContent.value.trim(),
            questions: [{
                question: questionData.question,
                options: (questionData.options || []).slice(0, 3),
                questionNumber: questionNum
            }]
        };

        const apiUrl = `${DEFAULT_CONFIG.apiBaseUrl}/api/quiz-answer`;
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            throw new Error(`Servidor no disponible o respuesta HTML: ${apiUrl}`);
        }

        if (!response.ok) {
            throw new Error(`HTTP ${response.status} en API`);
        }

        return await response.json();
    }

    function renderAnswersPreview(answers = []) {
        resolvedAnswers = Array.isArray(answers) ? answers : [];

        if (answers.length === 0) {
            answersPreview.innerHTML = '<div class="help-text">Las respuestas aparecerán aquí.</div>';
            saveQuizState();
            return;
        }

        answersPreview.innerHTML = answers.map(item => {
            const num = item.number || 1;
            const q = escapeHtml(item.question || '');
            const a = escapeHtml(item.correctAnswer || '');
            return `<div class="answer-item">
                <div class="answer-q">${num}. ${q} ${a}</div>
            </div>`;
        }).join('');

        saveQuizState();
    }

    function mergeAndRenderAnswers(newItems) {
        const map = new Map();

        for (const item of resolvedAnswers) {
            const key = `${item.number || ''}|${item.question || ''}`;
            map.set(key, item);
        }

        for (const item of newItems || []) {
            const key = `${item.number || ''}|${item.question || ''}`;
            map.set(key, item);
        }

        const merged = Array.from(map.values()).sort((a, b) => Number(a.number || 0) - Number(b.number || 0));
        renderAnswersPreview(merged);
    }

    function saveQuizState() {
        persistChapterContent(chapterContent.value || '');

        const state = {
            level: quizLevel.value || '',
            bookName: quizBookName.value || '',
            chapterName: quizChapterName.value || '',
            chapterContent: '',
            questionCount: questionCount.textContent || 'Estado: listo',
            answers: resolvedAnswers,
        };

        chrome.storage.local.set({ [QUIZ_STATE_KEY]: state });
    }

    function restoreQuizState() {
        const contentFromLocal = localStorage.getItem(QUIZ_CONTENT_KEY) || '';
        if (contentFromLocal) {
            chapterContent.value = contentFromLocal;
        }

        chrome.storage.local.get([QUIZ_STATE_KEY, QUIZ_CONTENT_KEY], (result) => {
            const state = result[QUIZ_STATE_KEY];
            const contentFromStorage = typeof result[QUIZ_CONTENT_KEY] === 'string' ? result[QUIZ_CONTENT_KEY] : '';

            if (!chapterContent.value && contentFromStorage) {
                chapterContent.value = contentFromStorage;
            }

            if (!state || typeof state !== 'object') {
                return;
            }

            if (state.level) quizLevel.value = state.level;
            if (state.bookName && !quizBookName.value) quizBookName.value = state.bookName;
            if (state.chapterName && !quizChapterName.value) quizChapterName.value = state.chapterName;
            if (!chapterContent.value && state.chapterContent) chapterContent.value = state.chapterContent;
            if (state.questionCount) questionCount.textContent = state.questionCount;

            if (Array.isArray(state.answers) && state.answers.length > 0) {
                renderAnswersPreview(state.answers);
            }
        });
    }

    function persistChapterContent(content) {
        try {
            localStorage.setItem(QUIZ_CONTENT_KEY, content);
        } catch (_error) {
            // localStorage puede fallar por cuota; dejamos respaldo en chrome.storage.
        }

        chrome.storage.local.set({ [QUIZ_CONTENT_KEY]: content }, () => {
            if (chrome.runtime.lastError) {
                // Si excede cuota, mantenemos al menos localStorage.
            }
        });
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

    async function sendTabMessageWithRetry(tabId, msg) {
        try {
            return await sendTabMessage(tabId, msg);
        } catch (error) {
            const message = String(error && error.message ? error.message : error || '');
            const canRetry = message.includes('Receiving end does not exist') || message.includes('Could not establish connection');

            if (!canRetry) {
                throw error;
            }

            await injectContentScripts(tabId);
            await delay(300);
            return await sendTabMessage(tabId, msg);
        }
    }

    function injectContentScripts(tabId) {
        return new Promise((resolve, reject) => {
            chrome.scripting.executeScript(
                {
                    target: { tabId },
                    files: ['config.js', 'content.js']
                },
                () => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                        return;
                    }
                    resolve();
                }
            );
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
