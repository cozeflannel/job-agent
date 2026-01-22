
const LOG_ENDPOINT = 'http://localhost:3000/log';

export const RemoteLogger = {
    log: async (message: string, data?: any) => {
        try {
            const payload = {
                level: 'INFO',
                message,
                data,
                source: 'EXTENSION'
            };

            // Use fetch to send to local bridge
            // catch error silently to avoid cluttering console if bridge not running
            await fetch(LOG_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            }).catch(() => { /* ignore connection errors */ });

        } catch (e) {
            // Fail silently
        }
    },

    error: async (message: string, error?: any) => {
        // Also log to console for standard debugging
        console.error(message, error);

        try {
            const payload = {
                level: 'ERROR',
                message,
                error: error instanceof Error ? error.message : error,
                stack: error instanceof Error ? error.stack : undefined,
                source: 'EXTENSION'
            };

            await fetch(LOG_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            }).catch(() => { /* ignore connection errors */ });

        } catch (e) {
            // Fail silently
        }
    }
};
