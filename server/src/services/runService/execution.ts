import { AIProviderError, resolveConfiguredProvider, type AIProvider } from '../../ai/provider';
import { authorizeRunDraft } from '../permissionService';
import { recordRunDenial, AuditUnavailableError } from '../auditService';
import { claimRun, completeRun, failRun, getOwnedRun } from './index';

export class RunExecutionError extends Error {
  constructor(
    public readonly status: 400 | 403 | 404 | 409 | 503,
    message: string,
  ) {
    super(message);
  }
}
type Mode = 'demo' | 'local';
export const createRunExecutor = (
  options: { providerForMode?: (mode: Mode) => AIProvider; timeoutMs?: number } = {},
) => {
  const timeoutMs = options.timeoutMs ?? 30000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000)
    throw new Error('Invalid run executor deadline');
  const providers = new Map<Mode, { configuration: string; provider: AIProvider }>();
  const occupied = new Set<Mode>();
  const active = new Map<
    string,
    { controller: AbortController; attemptId: string; version: number }
  >();
  const key = (owner: string, id: string) => owner.toLowerCase() + ':' + id.toLowerCase();
  const providerFor = (mode: Mode) => {
    if (mode === 'local' && process.env.NODE_ENV === 'production')
      throw new AIProviderError('DISABLED');
    const configuration = JSON.stringify([
      process.env.NODE_ENV,
      process.env.AI_PROVIDER,
      process.env.OLLAMA_BASE_URL,
      process.env.OLLAMA_MODEL,
    ]);
    const existing = providers.get(mode);
    if (existing) {
      // Replacing a hung provider would defeat its in-flight guard. Configuration changes require restart.
      if (existing.configuration !== configuration)
        throw new AIProviderError('INVALID_CONFIGURATION');
      return existing.provider;
    }
    const provider = options.providerForMode
      ? options.providerForMode(mode)
      : resolveConfiguredProvider(mode === 'demo' ? { mode: 'demo' } : {});
    if (
      (mode === 'demo' && provider.id !== 'demo') ||
      (mode === 'local' && provider.id !== 'ollama')
    )
      throw new AIProviderError('DISABLED');
    providers.set(mode, { configuration, provider });
    return provider;
  };
  const deny = async (
    owner: string,
    id: string,
    reason: Parameters<typeof recordRunDenial>[2],
    status: RunExecutionError['status'],
    message: string,
    action: 'execute' | 'cancel' = 'execute',
  ): Promise<never> => {
    await recordRunDenial(owner, id, reason, action);
    throw new RunExecutionError(status, message);
  };
  const execute = async (owner: string, id: string, mode: unknown, signal?: AbortSignal) => {
    const allowed = await authorizeRunDraft(owner, id);
    if (!allowed.allowed)
      return deny(
        owner,
        id,
        allowed.reason,
        allowed.reason === 'run-not-found' ? 404 : 403,
        allowed.reason === 'run-not-found' ? 'Run not found' : 'Run draft permission denied',
      );
    if (mode !== 'demo' && mode !== 'local')
      return deny(owner, id, 'invalid-mode', 400, 'Explicit demo or local mode is required');
    if (allowed.run.status !== 'queued')
      return deny(
        owner,
        id,
        'state-conflict',
        409,
        'Run is not queued; execution is never replayed',
      );
    if (occupied.has(mode))
      return deny(owner, id, 'capacity-unavailable', 409, 'Run execution capacity is busy');
    if (signal?.aborted) throw new RunExecutionError(409, 'Run request was interrupted');
    occupied.add(mode);
    let running: Awaited<ReturnType<typeof claimRun>> = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let interrupted: Promise<unknown> | undefined;
    let abortCause: 'expired' | 'interrupted' | undefined;
    let deniedAuthority = false;
    const controller = new AbortController();
    const interrupt = () => {
      abortCause ??= 'interrupted';
      controller.abort();
      if (running && !interrupted) {
        interrupted = Promise.resolve(
          failRun(owner, id, running.version, 'running', running.attemptId, abortCause),
        );
        // A late database failure must not become an unhandled rejection.
        void interrupted.catch(() => {});
      }
    };
    try {
      let provider: AIProvider;
      try {
        provider = providerFor(mode);
      } catch {
        return await deny(
          owner,
          id,
          'execution-disabled',
          503,
          'Selected run execution mode is unavailable',
        );
      }
      if (signal?.aborted) throw new RunExecutionError(409, 'Run request was interrupted');
      running = await claimRun(owner, id, allowed.run.version, timeoutMs, new Date(), mode);
      if (!running)
        return await deny(owner, id, 'state-conflict', 409, 'Run state or assignment changed');
      active.set(key(owner, id), {
        controller,
        attemptId: running.attemptId!,
        version: running.version,
      });
      signal?.addEventListener('abort', interrupt, { once: true });
      if (signal?.aborted) interrupt();
      timer = setTimeout(() => {
        abortCause ??= 'expired';
        controller.abort();
      }, timeoutMs);
      // The committed claim and its lifecycle audit precede any provider invocation.
      const current = await authorizeRunDraft(owner, id);
      if (!current.allowed) {
        deniedAuthority = true;
        await recordRunDenial(owner, id, current.reason);
        throw new RunExecutionError(403, 'Run draft permission denied');
      }
      controller.signal.throwIfAborted();
      if (
        current.run.status !== 'running' ||
        current.run.version !== running.version ||
        current.run.attemptId !== running.attemptId
      )
        throw new RunExecutionError(409, 'Run attempt is no longer current');
      const remaining = running.workDeadline!.getTime() - Date.now();
      if (remaining < 1) throw new AIProviderError('TIMEOUT');
      const result = await provider.chat(
        [
          {
            role: 'system',
            content:
              'Draft text for human review only. Do not use tools, run code, or change tasks or projects.',
          },
          { role: 'user', content: running.input },
        ],
        { signal: controller.signal, timeoutMs: Math.min(remaining, timeoutMs) },
      );
      controller.signal.throwIfAborted();
      if (
        typeof result.value !== 'string' ||
        !result.value.trim() ||
        result.provider !== (mode === 'demo' ? 'demo' : 'ollama') ||
        result.simulation !== (mode === 'demo')
      )
        throw new AIProviderError('INVALID_OUTPUT');
      const finalAuthority = await authorizeRunDraft(owner, id);
      if (!finalAuthority.allowed) {
        deniedAuthority = true;
        await recordRunDenial(owner, id, finalAuthority.reason);
        throw new RunExecutionError(403, 'Run draft permission changed');
      }
      controller.signal.throwIfAborted();
      if (interrupted) {
        await interrupted;
        throw new RunExecutionError(409, 'Run request was interrupted');
      }
      const completed = await completeRun(owner, id, running.version, running.attemptId!, {
        text: result.value,
        provider: result.provider,
        simulation: result.simulation,
        label: result.label,
      });
      if (!completed) throw new RunExecutionError(409, 'Run attempt expired or was cancelled');
      return completed;
    } catch (error) {
      controller.abort();
      if (running) {
        if (interrupted) await interrupted;
        else {
          const expired =
            abortCause === 'expired' ||
            Date.now() >= running.workDeadline!.getTime() ||
            (error instanceof AIProviderError && error.code === 'TIMEOUT');
          await failRun(
            owner,
            id,
            running.version,
            'running',
            running.attemptId,
            deniedAuthority
              ? 'permission-denied'
              : expired
                ? 'expired'
                : signal?.aborted
                  ? 'interrupted'
                  : 'provider-error',
          );
        }
      }
      if (error instanceof RunExecutionError || error instanceof AuditUnavailableError) throw error;
      throw new RunExecutionError(503, 'Run draft execution failed; no automatic retry');
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', interrupt);
      if (active.get(key(owner, id))?.controller === controller) active.delete(key(owner, id));
      occupied.delete(mode);
    }
  };
  const cancel = async (owner: string, id: string) => {
    const run = await getOwnedRun(owner, id);
    if (!run) return deny(owner, id, 'run-not-found', 404, 'Run not found', 'cancel');
    if (run.status !== 'queued' && run.status !== 'running')
      return deny(
        owner,
        id,
        'state-conflict',
        409,
        'Only queued or running work can be cancelled',
        'cancel',
      );
    const cancelled = await failRun(owner, id, run.version, run.status, run.attemptId, 'cancelled');
    if (!cancelled)
      return deny(
        owner,
        id,
        'state-conflict',
        409,
        'Run state changed before cancellation',
        'cancel',
      );
    // Persistence fences completion even when the attempt belongs to another process.
    const local = active.get(key(owner, id));
    if (local && local.attemptId === run.attemptId) local.controller.abort();
    return cancelled;
  };
  return { execute, cancel };
};
export const runExecutor = createRunExecutor();
