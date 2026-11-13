import { useEffect, useRef, useState } from 'react';
import { localApi } from './local-api.js';

const memoryError = issue => ['NEEDS_FREE_MEMORY', 'MEMORY_LIMIT'].includes(issue?.code);

/** O painel só nasce de uma tentativa; uma nova tentativa o remove antes de conferir a RAM. */
export function useVoiceGeneration(jobs = [], onModeChanged) {
  const [plan, setPlan] = useState(null); const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null); const [status, setStatus] = useState('');
  const lastTask = useRef(null); const watched = useRef(new Set()); const handled = useRef(new Set());
  const showFailure = async issue => {
    const result = await localApi.voicePlan();
    setPlan({ ...result.plan, runtimeFailure: issue.code === 'MEMORY_LIMIT' });
  };
  useEffect(() => {
    const failed = jobs.filter(job => watched.current.has(job.id) && !handled.current.has(job.id) && job.state === 'failed' && memoryError(job));
    for (const job of failed) {
      handled.current.add(job.id);
      showFailure(job).catch(setError);
    }
  }, [jobs]);
  const attempt = async task => {
    if (!task) return null;
    lastTask.current = task; setPlan(null); setError(null); setStatus(''); setBusy(true);
    try {
      const { plan: next } = await localApi.voicePlan();
      if (next.status === 'needs-free-memory' || next.status === 'unsupported') { setPlan(next); return null; }
      if (next.status !== 'ready') throw new Error(next.reasons?.join(' ') || 'Não foi possível verificar os recursos de voz.');
      const job = await task();
      if (job?.id) watched.current.add(job.id);
      return job;
    } catch (issue) {
      if (memoryError(issue)) await showFailure(issue).catch(setError);
      else setError(issue);
      return null;
    } finally { setBusy(false); }
  };
  const refresh = async () => {
    try {
      const { plan: next } = await localApi.voicePlan();
      setPlan(next.status === 'needs-free-memory' || next.status === 'unsupported' ? next : null);
      return next;
    } catch (issue) { setError(issue); }
  };
  const useEconomy = async () => {
    setBusy(true); setError(null);
    try {
      const settings = await localApi.getSettings();
      await localApi.updateSettings({ baseRevision: settings.revision, voice: { mode: 'economy' } });
      setPlan(null); setStatus('Modo econômico selecionado. Tente gerar novamente.');
      await onModeChanged?.();
      const setup = await localApi.setupStatus();
      if (!setup.items.find(item => item.id === 'voxcpm2-q8')?.ready) setError(Object.assign(new Error('Instale o modo econômico para gerar a voz.'), { code: 'DEPENDENCY_MISSING', details: { missing: ['voxcpm2-q8'] } }));
    } catch (issue) { setError(issue); }
    finally { setBusy(false); }
  };
  return { plan, busy, error, status, attempt, refresh, retry: () => attempt(lastTask.current), useEconomy };
}
