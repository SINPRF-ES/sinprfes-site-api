/**
 * Path Resolver for SINPRF-ES V2
 * Handles BASE_PATH detection for both subdomain (dev.sinprfes.org.br)
 * and path prefix (sinprfes.org.br/dev/) modes.
 */
(function() {
    const isPathPrefix = window.location.pathname.startsWith('/dev/');
    const BASE_PATH = isPathPrefix ? '/dev' : '';

    window.PathResolver = {
        basePath: BASE_PATH,

        /**
         * Resolves a path to include the base path if necessary.
         * @param {string} path - The relative or absolute path (e.g., '/index.html' or 'img/logo.png')
         * @returns {string} The resolved path.
         */
        resolve(path) {
            if (!path) return '';
            if (path.startsWith('http') || path.startsWith('//') || path.startsWith('data:')) return path;

            // Normalize path to have a leading slash if it doesn't
            const normalizedPath = path.startsWith('/') ? path : '/' + path;

            // If we are in path prefix mode, we prepend /dev
            // If we are in subdomain mode, BASE_PATH is empty, so it remains root-relative
            return BASE_PATH + normalizedPath;
        },

        /**
         * Navigates to a path using the resolver.
         * @param {string} path
         */
        navigate(path) {
            window.location.href = this.resolve(path);
        }
    };
})();
