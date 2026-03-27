document.addEventListener('DOMContentLoaded', () => {
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
});
