'use client';

// ============================================================
// Onboarding Wizard — 5-step getting started flow for new users.
// ============================================================

import React, { useState, useEffect } from 'react';
import { useI18n } from '@/lib/i18n';
import {
  getOnboardingState, completeOnboardingStep, skipOnboarding,
  getOnboardingProgress, STEP_COUNT,
  type OnboardingState, type OnboardingSteps,
} from '@/lib/onboarding';
import { Rocket, Building2, Users, CheckSquare, Eye, X, ChevronRight, ChevronLeft, Sparkles } from 'lucide-react';

interface Props {
  userId: string;
  open: boolean;
  onClose: () => void;
}

const STEP_ICONS = [Rocket, Building2, Users, CheckSquare, Eye];

const STEPS: { id: keyof OnboardingSteps; en: string; es: string; descEn: string; descEs: string }[] = [
  { id: 'welcome', en: 'Welcome', es: 'Bienvenido', descEn: 'Welcome to SOLIS OS! Let\'s set up your workspace.', descEs: '¡Bienvenido a SOLIS OS! Configuremos tu espacio de trabajo.' },
  { id: 'createSpace', en: 'Create a Space', es: 'Crear un Espacio', descEn: 'Spaces organize your team\'s work. Create your first one.', descEs: 'Los Espacios organizan el trabajo de tu equipo. Crea el primero.' },
  { id: 'inviteMembers', en: 'Invite Members', es: 'Invitar Miembros', descEn: 'Collaboration is better with your team. Invite them now or skip.', descEs: 'La colaboración es mejor con tu equipo. Invítalos ahora o salta este paso.' },
  { id: 'createFirstTask', en: 'Create a Task', es: 'Crear una Tarea', descEn: 'Tasks are the core of your work. Create your first one.', descEs: 'Las tareas son el núcleo de tu trabajo. Crea la primera.' },
  { id: 'exploreViews', en: 'Explore Views', es: 'Explorar Vistas', descEn: 'Switch between List, Board, Calendar, Gantt and more!', descEs: '¡Cambia entre Lista, Tablero, Calendario, Gantt y más!' },
];

export default function OnboardingWizard({ userId, open, onClose }: Props) {
  const { lang } = useI18n();
  const [state, setState] = useState<OnboardingState | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open || !userId) return;
    getOnboardingState(userId).then(s => {
      setState(s);
      setActiveStep(s.currentStep);
      setLoading(false);
    });
  }, [open, userId]);

  if (!open || loading || !state) return null;

  const progress = getOnboardingProgress(state);
  const StepIcon = STEP_ICONS[activeStep] || Rocket;
  const step = STEPS[activeStep];
  const isLastStep = activeStep === STEP_COUNT - 1;

  const handleComplete = async () => {
    if (!step) return;
    const updated = await completeOnboardingStep(userId, step.id);
    setState(updated);
    if (isLastStep || updated.completed) {
      onClose();
    } else {
      setActiveStep(prev => prev + 1);
    }
  };

  const handleSkip = async () => {
    await skipOnboarding(userId);
    onClose();
  };

  const handlePrev = () => {
    if (activeStep > 0) setActiveStep(prev => prev - 1);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleSkip} />
      <div className="relative w-full max-w-lg mx-4 bg-[var(--bg-base)] rounded-2xl shadow-xl border border-[var(--border)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2.5">
            <Sparkles className="h-5 w-5 text-[var(--accent)]" />
            <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">
              {lang === 'es' ? 'Primeros Pasos' : 'Getting Started'}
            </h2>
          </div>
          <button onClick={handleSkip} className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)] transition">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="px-6 pt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium text-[var(--text-muted)]">
              {lang === 'es' ? `Paso ${activeStep + 1} de ${STEP_COUNT}` : `Step ${activeStep + 1} of ${STEP_COUNT}`}
            </span>
            <span className="text-[11px] font-bold text-[var(--accent)]">{progress}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--accent)] transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Step indicators */}
        <div className="flex items-center justify-center gap-2 px-6 py-3">
          {STEPS.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setActiveStep(i)}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold transition ${
                i === activeStep
                  ? 'bg-[var(--accent)] text-[var(--accent-text)]'
                  : state.steps[s.id]
                    ? 'bg-[var(--success)]/20 text-[var(--success)]'
                    : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'
              }`}
            >
              {state.steps[s.id] ? '✓' : i + 1}
            </button>
          ))}
        </div>

        {/* Step content */}
        <div className="px-6 py-6 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[var(--accent)]/10 mb-4">
            <StepIcon className="h-8 w-8 text-[var(--accent)]" />
          </div>
          <h3 className="text-[17px] font-bold text-[var(--text-primary)] mb-2">
            {lang === 'es' ? step?.es : step?.en}
          </h3>
          <p className="text-[14px] text-[var(--text-secondary)] max-w-sm mx-auto">
            {lang === 'es' ? step?.descEs : step?.descEn}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--border-subtle)]">
          <button
            onClick={handlePrev}
            disabled={activeStep === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] disabled:opacity-30 transition"
          >
            <ChevronLeft className="h-4 w-4" />
            {lang === 'es' ? 'Anterior' : 'Back'}
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSkip}
              className="px-4 py-2 rounded-lg text-[13px] font-medium text-[var(--text-muted)] hover:bg-[var(--bg-hover)] transition"
            >
              {lang === 'es' ? 'Saltar todo' : 'Skip all'}
            </button>
            <button
              onClick={handleComplete}
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-[13px] font-semibold bg-[var(--accent)] text-[var(--accent-text)] hover:opacity-90 transition"
            >
              {isLastStep
                ? (lang === 'es' ? '¡Listo!' : 'Done!')
                : (lang === 'es' ? 'Completar paso' : 'Complete step')}
              {!isLastStep && <ChevronRight className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
