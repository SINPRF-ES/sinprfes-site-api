import { AppState, AppStateStatus, NativeEventSubscription } from 'react-native';
import { checkUpdates, applyOtaUpdate, reportUpdateAutoCheck, UpdateCheckResult } from './updateService';
import { logDebug } from '../utils/filiadoUtils';

export type UpdateListener = (result: UpdateCheckResult | null) => void;

class UpdateAutoScheduler {
    private intervalId: ReturnType<typeof setInterval> | null = null;
    private appStateSubscription: NativeEventSubscription | null = null;
    private lastCheckTime: number = 0;
    private isChecking: boolean = false;
    private listeners: Set<UpdateListener> = new Set();
    private lastResult: UpdateCheckResult | null = null;
    private SIX_HOURS_MS = 6 * 60 * 60 * 1000;
    private DEBOUNCE_MS = 5 * 60 * 1000; // 5 minutos de debounce para evitar spam

    /**
     * Adiciona um listener para mudanças no status de atualização.
     */
    subscribe(listener: UpdateListener) {
        this.listeners.add(listener);
        // Notifica imediatamente com o último resultado conhecido (se já houver um)
        if (this.lastResult !== null) {
            listener(this.lastResult);
        }
        return () => this.listeners.delete(listener);
    }

    /**
     * Inicia o agendador automático.
     * Deve ser chamado após o login ou restauração de sessão.
     */
    start() {
        if (this.intervalId) return;

        logDebug('UpdateAutoScheduler.start', { status: 'initializing' });

        // 1. Verificação imediata (reason: login)
        this.runCheck('login');

        // 2. Agendamento a cada 6 horas
        this.intervalId = setInterval(() => {
            this.runCheck('interval_6h');
        }, this.SIX_HOURS_MS);

        // 3. Listener de foreground
        this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange);
    }

    /**
     * Para o agendador e limpa listeners.
     */
    stop() {
        logDebug('UpdateAutoScheduler.stop', { status: 'stopping' });

        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }

        if (this.appStateSubscription) {
            this.appStateSubscription.remove();
            this.appStateSubscription = null;
        }
    }

    private handleAppStateChange = (nextAppState: AppStateStatus) => {
        if (nextAppState === 'active') {
            this.runCheck('foreground');
        }
    };

    private async runCheck(reason: 'login' | 'interval_6h' | 'foreground') {
        const now = Date.now();

        // Anti-spam / Debounce
        if (this.isChecking) return;

        // Não rodar se o último check foi há menos de 5 min (exceto se for login direto)
        if (reason !== 'login' && now - this.lastCheckTime < this.DEBOUNCE_MS) {
             return;
        }

        this.isChecking = true;
        this.lastCheckTime = now;

        try {
            logDebug('UpdateAutoScheduler.runCheck.start', { reason });

            // Reporta o início da verificação automática para o backend
            await reportUpdateAutoCheck('start', { reason });

            const result = await checkUpdates('auto');
            this.lastResult = result;
            this.listeners.forEach(l => l(result));

            if (result?.hasUpdate && result.type === 'OTA') {
                logDebug('UpdateAutoScheduler.runCheck.otaFound', { reason });
                await reportUpdateAutoCheck('ota_found', { reason, manifest: result.manifest?.versionName });

                // Aplica a atualização (isso causará um reload automático do app)
                await applyOtaUpdate();
            } else {
                logDebug('UpdateAutoScheduler.runCheck.noUpdate', { reason });
                await reportUpdateAutoCheck('no_update', { reason });
            }
        } catch (error: any) {
            logDebug('UpdateAutoScheduler.runCheck.error', { reason, error: error.message });
            await reportUpdateAutoCheck('error', { reason, error: error.message });
        } finally {
            this.isChecking = false;
        }
    }
}

export const updateAutoScheduler = new UpdateAutoScheduler();
