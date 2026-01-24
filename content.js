let config = {
    minInterval: 3000,
    maxInterval: 5000,
    targetDomain: 'lat.fictionexpress.com',
    enabled: true
};

function loadConfig() {
    const defaults = typeof DEFAULT_CONFIG !== 'undefined' ? DEFAULT_CONFIG : config;

    chrome.storage.local.get(['minInterval', 'maxInterval', 'targetDomain', 'enabled', 'redirectEnabled'], (result) => {
        config.minInterval = parseInt(result.minInterval) || defaults.minInterval;
        config.maxInterval = parseInt(result.maxInterval) || defaults.maxInterval;
        config.targetDomain = result.targetDomain || defaults.targetDomain;
        config.enabled = result.enabled !== undefined ? result.enabled : defaults.enabled;
        config.redirectEnabled = result.redirectEnabled !== undefined ? result.redirectEnabled : defaults.redirectEnabled;
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
    });
    bodyObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });

    const popupObserver = new MutationObserver(() => {
        const pauseDialog = document.querySelector('.popup, [class*="pause"], [class*="inactiv"]');
        if (pauseDialog && pauseDialog.textContent.toLowerCase().includes('pausa')) {
            pauseDialog.click();
            const btn = pauseDialog.querySelector('button, a, .continue, .close');
            if (btn) btn.click();
        }
    });
    popupObserver.observe(document.body, { childList: true, subtree: true });

    try {
        Object.defineProperty(document, 'hidden', { get: () => false, configurable: true });
        Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true });
    } catch (e) { }

    setInterval(() => {
        if (!config.enabled) return;
        const x = Math.floor(Math.random() * window.innerWidth);
        const y = Math.floor(Math.random() * window.innerHeight);
        document.dispatchEvent(new MouseEvent('mousemove', { clientX: x, clientY: y, bubbles: true }));
        window.dispatchEvent(new Event('focus'));
    }, 5000 + Math.random() * 5000);

    setInterval(() => {
        if (!config.enabled) return;
        const delta = Math.random() > 0.5 ? 20 : -20;
        window.scrollBy({ top: delta, behavior: 'smooth' });
    }, 15000 + Math.random() * 10000);
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

        setTimeout(() => {
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

chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'UPDATE_CONFIG') location.reload();
});
