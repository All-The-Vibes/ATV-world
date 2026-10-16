/** Fetches with caller cancellation and a timeout without relying on newer AbortSignal helpers. */
export async function fetchWithTimeout(
    input: RequestInfo | URL,
    init: RequestInit,
    signal: AbortSignal,
    timeoutMs: number,
): Promise<Response> {
    const controller = new AbortController();
    let timedOut = false;
    const abort = () => controller.abort();
    const timer = window.setTimeout(() => {
        timedOut = true;
        controller.abort();
    }, timeoutMs);

    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', abort, { once: true });

    try {
        return await fetch(input, { ...init, signal: controller.signal });
    } catch (error) {
        if (timedOut) throw new DOMException('Request timed out', 'TimeoutError');
        throw error;
    } finally {
        window.clearTimeout(timer);
        signal.removeEventListener('abort', abort);
    }
}
