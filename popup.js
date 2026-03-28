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
    const solveSingleBtn = document.getElementById('solveSingleBtn');
    const answersPreview = document.getElementById('answersPreview');
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
            const questionData = await sendTabMessage(tab.id, { type: 'EXTRACT_QUIZ_QUESTION' });
            if (!questionData || !questionData.question || !Array.isArray(questionData.options) || questionData.options.length < 2) {
                showError('No se pudo leer la pregunta. Asegúrate de estar en una página de quiz válida.');
                return;
            }

            const questionNum = questionData.questionNumber || 1;
            showStatus(`Resolviendo pregunta ${questionNum}...`, 'loading');

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
                    options: questionData.options,
                    questionNumber: questionNum
                }]
            };

            const apiUrl = `${DEFAULT_CONFIG.apiBaseUrl}/api/quiz-answer`;
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            // Verificar si la respuesta es JSON válida
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                showError(`⚠️ Error: Servidor no disponible o retorna HTML\n${apiUrl}`);
                return;
            }

            if (!response.ok) {
                showError(`❌ Error HTTP ${response.status}`);
                return;
            }

            const result = await response.json();

            if (result.success && Array.isArray(result.answers) && result.answers.length > 0) {
                const answer = result.answers[0];
                
                // Aplicar la respuesta en el quiz actual (sin navegar)
                showStatus('Marcando respuesta correcta...', 'loading');
                await sendTabMessage(tab.id, {
                    type: 'APPLY_QUIZ_ANSWER',
                    answerText: answer.correctAnswer || ''
                });

                // Mostrar la respuesta en el preview
                renderAnswersPreview([answer]);
                showSuccess(`✓ Respuesta marcada: ${answer.correctAnswer}\n\nPuedes continuar al siguiente quiz o usar el botón nuevamente.`);
            } else {
                showError('El servidor no encontró una respuesta válida para esta pregunta.');
            }
        } catch (error) {
            showError(`❌ Error: ${error.message}`);
        } finally {
            solveSingleBtn.disabled = false;
        }
    }

    function renderAnswersPreview(answers = []) {
        if (answers.length === 0) {
            answersPreview.innerHTML = '<div class="help-text">Las respuestas aparecerán aquí.</div>';
            return;
        }

        answersPreview.innerHTML = answers.map(item => {
            const confidence = item.confidence ? ` (${item.confidence}%)` : '';
            return `<div class="answer-item">
                <div class="answer-q">${item.number || 1}. ${escapeHtml(item.question || '')}</div>
                <div class="answer-a">✓ ${escapeHtml(item.correctAnswer || '')}${confidence}</div>
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
