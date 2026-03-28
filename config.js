const DEFAULT_CONFIG = {
    minInterval: 62000,
    maxInterval: 122000,
    targetDomain: 'lat.fictionexpress.com',
    enabled: true,
    redirectEnabled: true,
    downloadEnabled: true,
    youtubeUrl: 'https://www.youtube.com/@hack_version',
    githubUrl: 'https://github.com/Luis000923/AutoFic.git',
    // Cambiar a 'http://localhost:8000' para desarrollo local
    apiBaseUrl: 'https://free-quiz.varios.store'
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = DEFAULT_CONFIG;
}
