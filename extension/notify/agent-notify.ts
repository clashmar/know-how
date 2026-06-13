import { ExtensionAPI } from '@mariozechner/pi-coding-agent';

const NOTIFY_THRESHOLD_MS = 30_000;

/** Registers a terminal bell notification when a long agent task completes. */
export function registerAgentNotify(pi: ExtensionAPI): void {
    let startTime = 0;

    pi.on('before_agent_start', () => {
        startTime = Date.now();
    });

    pi.on('agent_end', () => {
        const elapsed = Date.now() - startTime;
        if (elapsed > NOTIFY_THRESHOLD_MS) {
            process.stdout.write('\x07');
        }
    });
}
