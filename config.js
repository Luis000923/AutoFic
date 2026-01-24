const DEFAULT_CONFIG = {
    minInterval: 62000,
    maxInterval: 122000,
    targetDomain: 'lat.fictionexpress.com',
    enabled: true,
    redirectEnabled: true,
    youtubeUrl: 'https://www.youtube.com/@hack_version',
    githubUrl: 'https://github.com/Luis000923/AutoFic.git'
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = DEFAULT_CONFIG;
}
