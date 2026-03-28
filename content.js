let config = {
    minInterval: 3000,
    maxInterval: 5000,
    targetDomain: 'lat.fictionexpress.com',
    enabled: true,
    downloadEnabled: true
};

function loadConfig() {
    const defaults = typeof DEFAULT_CONFIG !== 'undefined' ? DEFAULT_CONFIG : config;

    chrome.storage.local.get(['minInterval', 'maxInterval', 'targetDomain', 'enabled', 'redirectEnabled', 'downloadEnabled'], (result) => {
        config.minInterval = parseInt(result.minInterval) || defaults.minInterval;
        config.maxInterval = parseInt(result.maxInterval) || defaults.maxInterval;
        config.targetDomain = result.targetDomain || defaults.targetDomain;
        config.enabled = result.enabled !== undefined ? result.enabled : defaults.enabled;
        config.redirectEnabled = result.redirectEnabled !== undefined ? result.redirectEnabled : defaults.redirectEnabled;
        config.downloadEnabled = result.downloadEnabled !== undefined ? result.downloadEnabled : defaults.downloadEnabled;
        config.youtubeUrl = defaults.youtubeUrl;
        config.githubUrl = defaults.githubUrl;

        const currentUrl = window.location.href;
        const currentHost = window.location.hostname;

        const isFictionExpress = currentUrl.startsWith('https://lat.fictionexpress.com');
        const isTargetDomain = !isFictionExpress && config.targetDomain && currentHost.includes(config.targetDomain);

        if (config.enabled && (isFictionExpress || isTargetDomain)) {
            if (currentUrl.includes('/lector/')) {
                if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', initAutoFic);
                } else {
                    initAutoFic();
                }
            } else {
                if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', preventPause);
                } else {
                    preventPause();
                }
            }
        }
    });
}

function preventPause() {
    if (!document.body) {
        setTimeout(preventPause, 100);
        return;
    }

    const PAUSE_CLASS = 'ventanaInactiva';

    if (document.body.classList.contains(PAUSE_CLASS)) {
        document.body.classList.remove(PAUSE_CLASS);
    }

    const originalAdd = DOMTokenList.prototype.add;
    DOMTokenList.prototype.add = function (...tokens) {
        const filteredTokens = tokens.filter(token => token !== PAUSE_CLASS);
        if (filteredTokens.length > 0) {
            return originalAdd.apply(this, filteredTokens);
        }
    };

    const bodyObserver = new MutationObserver(() => {
        if (document.body && document.body.classList.contains(PAUSE_CLASS)) {
            document.body.classList.remove(PAUSE_CLASS);
        }
        // También buscamos elementos hijos que puedan ser el overlay de pausa
        const overlays = document.querySelectorAll(`.${PAUSE_CLASS}, [class*="overlay-pausa"], [class*="modal-pausa"]`);
        overlays.forEach(el => el.remove());
    });
    bodyObserver.observe(document.body, { attributes: true, childList: true, subtree: true, attributeFilter: ['class'] });

    const popupObserver = new MutationObserver(() => {
        const pauseDialog = document.querySelector('.popup, [class*="pause"], [class*="inactiv"]');
        if (pauseDialog && (pauseDialog.textContent.toLowerCase().includes('pausa') || pauseDialog.textContent.toLowerCase().includes('inactiva'))) {
            pauseDialog.click();
            const btn = pauseDialog.querySelector('button, a, .continue, .close, [class*="btn"], [class*="botn"]');
            if (btn) btn.click();
            pauseDialog.remove(); // Forzamos la eliminación
        }
    });
    popupObserver.observe(document.body, { childList: true, subtree: true });

    // Bloquear eventos de pérdida de foco
    window.addEventListener('blur', (e) => {
        e.stopImmediatePropagation();
        // Fingir que seguimos enfocados
        window.dispatchEvent(new Event('focus'));
    }, true);

    document.addEventListener('visibilitychange', (e) => {
        e.stopImmediatePropagation();
    }, true);

    try {
        Object.defineProperty(document, 'hidden', { get: () => false, configurable: true });
        Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true });
        Object.defineProperty(document, 'webkitVisibilityState', { get: () => 'visible', configurable: true });
    } catch (e) { }

    setInterval(() => {
        if (!config.enabled) return;
        // Eliminar cualquier clase de pausa que pueda haber reaparecido
        if (document.body.classList.contains(PAUSE_CLASS)) document.body.classList.remove(PAUSE_CLASS);

        const x = Math.floor(Math.random() * window.innerWidth);
        const y = Math.floor(Math.random() * window.innerHeight);
        document.dispatchEvent(new MouseEvent('mousemove', { clientX: x, clientY: y, bubbles: true }));
        window.dispatchEvent(new Event('focus'));
    }, 2000); // Más frecuente

    setInterval(() => {
        if (!config.enabled) return;
        const delta = Math.random() > 0.5 ? 5 : -5; // Scroll más sutil pero constante
        window.scrollBy({ top: delta, behavior: 'smooth' });
    }, 10000);
}

function findNextButton() {
    const elements = Array.from(document.querySelectorAll('span, div, button, a'));
    let bestCandidate = null;
    let maxScore = -1;

    for (const el of elements) {
        const rect = el.getBoundingClientRect();
        if (rect.top < 100) continue;
        if (rect.width === 0 || rect.height === 0) continue;

        const text = el.textContent.trim().toLowerCase();
        const className = (el.className || '').toString().toLowerCase();
        const id = (el.id || '').toLowerCase();
        const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();

        let score = 0;

        if (text === 'siguiente' || text === 'next' || text === 'vote' || text === 'votar') score += 100;
        if (ariaLabel.includes('siguiente') || ariaLabel.includes('next') || ariaLabel.includes('vote') || ariaLabel.includes('votar')) score += 80;
        if (className.includes('next') || className.includes('siguiente') || className.includes('vote') || className.includes('votar')) score += 50;
        if (className.includes('right') || id.includes('right')) score += 20;

        if (rect.left > window.innerWidth / 2) {
            score += 30;
            if (rect.left > window.innerWidth * 0.7) score += 20;
        }

        if (el.querySelector('span.ico') || className.includes('ico')) {
            score += 40;
        }

        if (text === 'a' || text.includes('serif') || className.includes('font') || className.includes('theme')) {
            score -= 200;
        }

        if (text.includes('anterior') || text.includes('prev') || ariaLabel.includes('prev')) {
            score -= 200;
        }

        if (score > maxScore) {
            maxScore = score;
            bestCandidate = el;
        }
    }

    if (bestCandidate && maxScore > 20) {
        return bestCandidate;
    }

    const backups = document.querySelectorAll('.navigate-next, .next-page, .btn-next, .vote-btn, .btn-vote, .votar-btn');
    if (backups.length > 0) return backups[0];

    return null;
}

function clickNext() {
    if (!config.enabled) return;

    const pausePopup = document.querySelector('.popup, [class*="pause"], [class*="inactiv"]');
    if (pausePopup && pausePopup.textContent.toLowerCase().includes('pausa')) {
        const btn = pausePopup.querySelector('button, a, .continue, .close, [role="button"]');
        if (btn) {
            btn.click();
            setTimeout(clickNext, 1000);
            return;
        }
    }

    const btn = findNextButton();
    if (btn) {
        const isVoteBtn = btn.textContent.toLowerCase().includes('vote') ||
            btn.textContent.toLowerCase().includes('votar') ||
            (btn.getAttribute('aria-label') || '').toLowerCase().includes('vote');

        btn.scrollIntoView({ behavior: 'smooth', block: 'center' });

        setTimeout(async () => {
            try {
                const opts = { bubbles: true, cancelable: true, view: window, buttons: 1 };
                btn.dispatchEvent(new PointerEvent('pointerdown', opts));
                btn.dispatchEvent(new PointerEvent('pointerup', opts));
                btn.dispatchEvent(new MouseEvent('mousedown', opts));
                btn.dispatchEvent(new MouseEvent('mouseup', opts));
                btn.dispatchEvent(new MouseEvent('click', opts));

                if (isVoteBtn) {
                    if (countdownElement) {
                        countdownElement.style.background = 'linear-gradient(135deg, #FF0000, #CC0000)';
                        const timeEl = document.getElementById('autofic-time');
                        if (timeEl) timeEl.textContent = '¡VOTADO! 🎥';
                    }

                    if (config.redirectEnabled) {
                        setTimeout(() => {
                            window.open(config.youtubeUrl, '_blank');
                        }, 2000);
                    } else {
                        scheduleNext();
                    }
                } else {
                    scheduleNext();
                }
            } catch (err) {
                scheduleNext();
            }
        }, 500);
    } else {
        showPauseWidget();
    }
}

function showPauseWidget() {
    if (!countdownElement) startCountdown(0);

    countdownEndTime = null;
    countdownElement.style.background = 'linear-gradient(135deg, #f59e0b, #d97706)';

    const timeEl = document.getElementById('autofic-time');
    if (timeEl) {
        timeEl.style.fontSize = '14px';
        timeEl.innerHTML = `
            <div style="margin-bottom: 5px;">PAUSA</div>
            ${config.redirectEnabled ? '<div style="font-size: 10px; opacity: 0.9;">Redirigiendo...</div>' : ''}
        `;
    }

    if (config.redirectEnabled) {
        setTimeout(() => {
            if (!findNextButton()) {
                window.open(config.youtubeUrl, '_blank');
            } else {
                clickNext();
            }
        }, 3000);
    }
}

let countdownTimer = null;
let countdownEndTime = null;
let countdownElement = null;

function updateCountdown() {
    if (!countdownElement || !countdownEndTime) return;

    const remaining = Math.max(0, countdownEndTime - Date.now());
    const seconds = Math.ceil(remaining / 1000);

    const timeEl = document.getElementById('autofic-time');
    if (timeEl) {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        timeEl.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

        if (seconds <= 5) {
            countdownElement.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
        } else {
            countdownElement.style.background = 'linear-gradient(135deg, #6366f1, #8b5cf6)';
        }
    }

    if (remaining > 0) requestAnimationFrame(updateCountdown);
}

function startCountdown(ms) {
    if (!countdownElement) {
        countdownElement = document.createElement('div');
        countdownElement.id = 'autofic-widget';
        countdownElement.style.cssText = `
            position: fixed; top: 10px; right: 10px; z-index: 999999;
            color: white; padding: 10px 15px; border-radius: 10px;
            font-family: sans-serif; box-shadow: 0 4px 10px rgba(0,0,0,0.2);
            min-width: 120px; text-align: center; font-weight: bold;
        `;
        countdownElement.innerHTML = `
            <div style="font-size: 10px; opacity: 0.8;">AutoFic</div>
            <div id="autofic-time" style="font-size: 18px;">--:--</div>
        `;
        document.body.appendChild(countdownElement);
    }
    countdownEndTime = Date.now() + ms;
    updateCountdown();
}

function scheduleNext() {
    if (!config.enabled) return;
    const interval = Math.floor(Math.random() * (config.maxInterval - config.minInterval + 1)) + config.minInterval;
    startCountdown(interval);
    setTimeout(clickNext, interval);
}

function initAutoFic() {
    preventPause();
    scheduleNext();
}

loadConfig();

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'PING') {
        sendResponse({ ok: true });
        return true;
    }

    if (msg.type === 'UPDATE_CONFIG') location.reload();
    if (msg.type === 'DOWNLOAD_CHAPTER') {
        // Asegurarnos de que no esté pausado antes de extraer
        if (document.body.classList.contains('ventanaInactiva')) {
            document.body.classList.remove('ventanaInactiva');
        }
        setTimeout(extractAndDownload, 100);
    }
    if (msg.type === 'SHOW_QUESTIONS') {
        extractChapterContent().then(content => {
            showQuestionsPanel(content);
        });
    }

    if (msg.type === 'EXTRACT_QUIZ_QUESTION') {
        sendResponse(extractQuizQuestion());
        return true;
    }

    if (msg.type === 'APPLY_QUIZ_ANSWER') {
        sendResponse({ ok: applyQuizAnswer(msg.answerText || '') });
        return true;
    }
});

function extractQuizQuestion() {
    const quizRoot = document.querySelector('#quiz') || document;
    const questionEl = quizRoot.querySelector('h3.larga, h3, .pregunta, .question, [class*="pregunta"]');

    if (!questionEl) {
        return null;
    }

    const question = cleanText(questionEl.textContent || '');
    const form = quizRoot.querySelector('form.btnC.casillas, form[data-tipo="formSimple"], form');
    const scope = form || quizRoot;

    const candidates = Array.from(scope.querySelectorAll('label, li, button, .opcion, .option, p, div, span'));
    const options = [];

    for (const el of candidates) {
        const text = cleanText(el.textContent || '');
        if (!text || text.length < 4 || text.length > 180) continue;
        if (text === question) continue;
        if (text.toLowerCase().includes('recuerda que')) continue;
        if (!options.includes(text)) {
            options.push(text);
        }
    }

    const filtered = options.filter(opt => !isMostlyNumber(opt)).slice(0, 6);
    const urlMatch = window.location.href.match(/\/quiz\/(\d+)\//i);

    return {
        question,
        options: filtered,
        questionNumber: urlMatch ? parseInt(urlMatch[1], 10) : null,
    };
}

function applyQuizAnswer(answerText) {
    const target = normalizeText(answerText);
    if (!target) return false;

    const quizRoot = document.querySelector('#quiz') || document;
    const form = quizRoot.querySelector('form.btnC.casillas, form[data-tipo="formSimple"], form');
    const scope = form || quizRoot;
    const options = Array.from(scope.querySelectorAll('label, li, button, .opcion, .option, p, div, span, input[type="radio"], input[type="checkbox"]'));

    let bestEl = null;
    let bestScore = 0;

    for (const el of options) {
        const text = cleanText(el.textContent || el.getAttribute('value') || '');
        if (!text) continue;

        const score = textSimilarity(normalizeText(text), target);
        if (score > bestScore) {
            bestScore = score;
            bestEl = el;
        }
    }

    if (!bestEl || bestScore < 0.35) {
        return false;
    }

    const clickable = bestEl.closest('label, button, li, div') || bestEl;
    clickable.scrollIntoView({ behavior: 'smooth', block: 'center' });

    try {
        clickable.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        if (clickable instanceof HTMLInputElement) {
            clickable.checked = true;
            clickable.dispatchEvent(new Event('change', { bubbles: true }));
        }
        return true;
    } catch (e) {
        return false;
    }
}

function textSimilarity(a, b) {
    if (!a || !b) return 0;
    const wa = a.split(' ').filter(Boolean);
    const wb = b.split(' ').filter(Boolean);
    if (!wa.length || !wb.length) return 0;

    let matches = 0;
    for (const w of wa) {
        if (wb.includes(w)) matches++;
    }
    return matches / Math.max(wa.length, wb.length);
}

function normalizeText(t) {
    return (t || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function cleanText(t) {
    return (t || '').replace(/\s+/g, ' ').trim();
}

function isMostlyNumber(t) {
    const clean = (t || '').replace(/\s+/g, '');
    if (!clean) return true;
    const digits = (clean.match(/[0-9]/g) || []).length;
    return digits > clean.length * 0.6;
}

async function extractAndDownload() {
    try {
        const content = await extractChapterContent();
        
        const titleEl = document.querySelector('.chapter-title, h1, h2, .reader-header h3') ||
            Array.from(document.querySelectorAll('div, span, p')).find(el => el.textContent.toLowerCase().includes('capítulo'));
        const chapterTitle = titleEl ? titleEl.textContent.trim().replace(/[\/\\?%*:|"<>]/g, '-') : 'Capitulo';

        const pageEl = document.querySelector('.page-number, .current-page, [class*="page-num"], .sc-pagination__info');
        const pageNum = pageEl ? pageEl.textContent.trim().replace(/\D/g, '') : 'Final';

        const sanitizedTitle = chapterTitle.substring(0, 50);
        const filename = `${sanitizedTitle}_Pag_${pageNum}.txt`;

        downloadTxt(content, filename);
    } catch (err) {
        console.error('AutoFic: Error al extraer texto:', err);
    }
}

async function extractChapterContent() {
    const elements = Array.from(document.querySelectorAll('p, .sc-reader-content p, .text-content p, .chapter-body p, div[style*="font-size"]'));
    const texts = elements
        .map(el => el.textContent.trim())
        .filter(txt => {
            return txt.length > 20 &&
                !txt.includes('Siguiente') &&
                !txt.includes('Configuración') &&
                !txt.includes('Anterior') &&
                !txt.includes('VOTAR') &&
                !txt.includes('Cerrar sesión');
        });

    const uniqueTexts = [];
    texts.forEach(txt => {
        if (!uniqueTexts.some(u => u.includes(txt) || txt.includes(u))) {
            uniqueTexts.push(txt);
        }
    });

    return uniqueTexts.join('\n\n');
}

function downloadTxt(text, filename) {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
    }, 150);
}

function showQuestionsPanel(chapterContent) {
    // Crear panel de preguntas
    const panelHTML = `
        <div id="autofic-questions-overlay" style="
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.7); z-index: 999998;
            display: flex; align-items: center; justify-content: center;
            font-family: 'Outfit', sans-serif;
        ">
            <div id="autofic-panel" style="
                background: white; border-radius: 15px; padding: 30px;
                max-width: 600px; width: 90%; max-height: 80vh;
                overflow-y: auto; box-shadow: 0 10px 40px rgba(0,0,0,0.3);
            ">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px;">
                    <h2 style="margin: 0; color: #1f2937; font-size: 24px;">Preguntas del Capítulo</h2>
                    <button id="close-questions-btn" style="
                        background: none; border: none; font-size: 28px;
                        cursor: pointer; color: #6b7280; padding: 0; width: 40px; height: 40px;
                    ">✕</button>
                </div>
                <div id="questions-container" style="margin-bottom: 20px;"></div>
                <div style="display: flex; gap: 10px; margin-top: 25px;">
                    <button id="submit-answers-btn" style="
                        flex: 1; padding: 12px 20px; background: linear-gradient(to right, #6366f1, #8b5cf6);
                        color: white; border: none; border-radius: 8px; cursor: pointer;
                        font-weight: 600; font-size: 14px; transition: all 0.3s;
                    ">Enviar Respuestas</button>
                    <button id="download-with-answers-btn" style="
                        flex: 1; padding: 12px 20px; background: linear-gradient(to right, #10b981, #059669);
                        color: white; border: none; border-radius: 8px; cursor: pointer;
                        font-weight: 600; font-size: 14px; transition: all 0.3s;
                    ">Descargar (.txt)</button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', panelHTML);

    // Generar preguntas basadas en el contenido
    const questions = generateQuestions(chapterContent);
    const questionsContainer = document.getElementById('questions-container');

    questions.forEach((q, idx) => {
        const questionHTML = `
            <div style="
                margin-bottom: 20px; padding: 15px;
                background: #f3f4f6; border-radius: 8px; border-left: 4px solid #6366f1;
            ">
                <p style="margin: 0 0 12px 0; color: #1f2937; font-weight: 600;">
                    ${idx + 1}. ${q.question}
                </p>
                ${q.options.map((opt, optIdx) => `
                    <label style="
                        display: block; margin-bottom: 8px; cursor: pointer;
                        padding: 10px; border-radius: 6px; transition: background 0.2s;
                    " onmouseover="this.style.background='#e5e7eb'" onmouseout="this.style.background='transparent'">
                        <input type="radio" name="question-${idx}" value="${optIdx}" style="margin-right: 8px; cursor: pointer;">
                        <span style="color: #374151;">${opt}</span>
                    </label>
                `).join('')}
            </div>
        `;
        questionsContainer.insertAdjacentHTML('beforeend', questionHTML);
    });

    // Event listeners
    document.getElementById('close-questions-btn').addEventListener('click', closeQuestionsPanel);
    document.getElementById('submit-answers-btn').addEventListener('click', () => submitAnswers(questions));
    document.getElementById('download-with-answers-btn').addEventListener('click', () => downloadWithAnswers(chapterContent, questions));

    document.getElementById('autofic-questions-overlay').addEventListener('click', (e) => {
        if (e.target.id === 'autofic-questions-overlay') {
            closeQuestionsPanel();
        }
    });
}

function generateQuestions(content) {
    const sentences = content.split('\n\n').filter(s => s.length > 50).slice(0, 5);
    
    const questionTemplates = [
        { q: '¿Cuál fue el tema principal tratado en este párrafo?', type: 'comprehension' },
        { q: '¿Quién fue el personaje principal mencionado?', type: 'character' },
        { q: '¿En qué lugar ocurrió la acción descrita?', type: 'location' },
        { q: '¿Cuál fue la emoción predominante en el capítulo?', type: 'emotion' },
        { q: '¿Cuál es el conflicto central presentado?', type: 'conflict' }
    ];

    const questions = [];
    const optionSets = [
        ['Opción A', 'Opción B', 'Opción C', 'Opción D'],
        ['Sí, definitivamente', 'Probablemente sí', 'Probablemente no', 'No, de ninguna manera'],
        ['Tristeza', 'Alegría', 'Miedo', 'Sorpresa'],
        ['En una ciudad', 'En el campo', 'En la montaña', 'En el mar'],
        ['Amor', 'Odio', 'Desconfianza', 'Amistad']
    ];

    for (let i = 0; i < Math.min(3, questionTemplates.length); i++) {
        questions.push({
            question: questionTemplates[i].q,
            options: optionSets[i],
            answer: null
        });
    }

    return questions;
}

function submitAnswers(questions) {
    let answered = 0;
    let correctAnswers = 0;

    questions.forEach((q, idx) => {
        const selected = document.querySelector(`input[name="question-${idx}"]:checked`);
        if (selected) {
            answered++;
            q.answer = selected.value;
            // Simulamos que la primera opción es siempre correcta para este ejemplo
            if (selected.value === '0') correctAnswers++;
        }
    });

    if (answered < questions.length) {
        alert(`Por favor responde todas las preguntas. Has respondido: ${answered}/${questions.length}`);
        return;
    }

    const score = Math.round((correctAnswers / questions.length) * 100);
    alert(`¡Cuestionario completado!\n\nRespuestas correctas: ${correctAnswers}/${questions.length}\nCalificación: ${score}%`);
}

function downloadWithAnswers(content, questions) {
    let answersText = '═══════════════════════════════════════\n';
    answersText += 'CONTENIDO DEL CAPÍTULO\n';
    answersText += '═══════════════════════════════════════\n\n';
    answersText += content + '\n\n';
    answersText += '═══════════════════════════════════════\n';
    answersText += 'RESPUESTAS DEL CUESTIONARIO\n';
    answersText += '═══════════════════════════════════════\n\n';

    questions.forEach((q, idx) => {
        answersText += `${idx + 1}. ${q.question}\n`;
        q.options.forEach((opt, optIdx) => {
            const selected = q.answer === optIdx.toString() ? ' ✓ SELECCIONADO' : '';
            answersText += `   [${String.fromCharCode(65 + optIdx)}] ${opt}${selected}\n`;
        });
        answersText += '\n';
    });

    const titleEl = document.querySelector('.chapter-title, h1, h2');
    const chapterTitle = titleEl ? titleEl.textContent.trim().replace(/[\/\\?%*:|"<>]/g, '-') : 'Capitulo';
    const sanitizedTitle = chapterTitle.substring(0, 50);
    const filename = `${sanitizedTitle}_ConRespuestas.txt`;

    downloadTxt(answersText, filename);
    closeQuestionsPanel();
}

function closeQuestionsPanel() {
    const overlay = document.getElementById('autofic-questions-overlay');
    if (overlay) {
        overlay.style.opacity = '0';
        overlay.style.transition = 'opacity 0.3s';
        setTimeout(() => overlay.remove(), 300);
    }
}
