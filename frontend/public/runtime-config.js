(function () {
    function normalizeUrl(url) {
        return String(url || '').trim().replace(/\/+$/, '');
    }

    function isLocalHost(hostname) {
        return (
            hostname === 'localhost' ||
            hostname === '127.0.0.1' ||
            hostname === '::1'
        );
    }

    function getLocalBackendFallback() {
        if (typeof window === 'undefined' || !window.location) {
            return 'http://localhost:5001';
        }

        const {
            protocol,
            hostname,
            port,
            origin
        } = window.location;

        if (
            protocol === 'file:' ||
            origin === 'null' ||
            protocol === 'about:'
        ) {
            return 'http://localhost:5001';
        }

        if (
            (protocol === 'http:' || protocol === 'https:') &&
            isLocalHost(hostname) &&
            port !== '5001'
        ) {
            return `${protocol}//${hostname}:5001`;
        }

        return normalizeUrl(
            origin || 'http://localhost:5001'
        );
    }

    function getApiBase() {
        const productionApiBase =
    'https://tmlive-avtn.vercel.app';

        const productionFrontendHost =
    'tmliveweb.vercel.app';

        if (
            typeof window !== 'undefined' &&
            window.location &&
            window.location.hostname === productionFrontendHost
        ) {
            return productionApiBase;
        }

        return normalizeUrl(
            localStorage.getItem('tm_api_base') ||
            window.TM_API_BASE ||
            getLocalBackendFallback()
        );
    }

    function getSocketUrl() {
        const savedSocket = normalizeUrl(
            localStorage.getItem('tm_socket_url') ||
            window.TM_SOCKET_URL ||
            ''
        );

        if (savedSocket) {
            return savedSocket;
        }

        const apiBase = getApiBase();

        if (!apiBase) {
            return window.location.origin;
        }

        return normalizeUrl(
            apiBase.replace(/\/api$/i, '')
        );
    }

    function setApiBase(apiBase) {
        const normalized = normalizeUrl(apiBase);

        if (!normalized) {
            localStorage.removeItem('tm_api_base');
            localStorage.removeItem('tm_socket_url');

            return {
                apiBase: '',
                socketUrl: ''
            };
        }

        const socketUrl =
            normalizeUrl(
                normalized.replace(/\/api$/i, '')
            ) || normalized;

        localStorage.setItem('tm_api_base', normalized);
        localStorage.setItem('tm_socket_url', socketUrl);

        return {
            apiBase: normalized,
            socketUrl: socketUrl
        };
    }

    function apiUrl(path) {
        const base = getApiBase();
        return base ? base + path : path;
    }

    window.getDeploymentApiBase = getApiBase;
    window.getDeploymentSocketUrl = getSocketUrl;
    window.setDeploymentBase = setApiBase;
    window.deploymentApiUrl = apiUrl;
})();