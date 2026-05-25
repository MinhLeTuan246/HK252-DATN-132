import { useState } from 'react';
import { MainTab } from './components/MainTab';
import { InstructionTab } from './components/InstructionTab';
import { SpecTab } from './components/SpecTab';
import { Cpu, BookOpen, Layers } from 'lucide-react';

type Tab = 'main' | 'instruction' | 'spec';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('main');

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'main',        label: 'Main',        icon: <Cpu      style={{ width: '0.75rem', height: '0.75rem' }} /> },
    { id: 'instruction', label: 'Instruction', icon: <BookOpen style={{ width: '0.75rem', height: '0.75rem' }} /> },
    { id: 'spec',        label: 'Spec',        icon: <Layers   style={{ width: '0.75rem', height: '0.75rem' }} /> },
  ];

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      backgroundColor: 'var(--tb-bg)',
      color: 'var(--tb-text)',
    }}>
      {/* ── Header ── */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.6rem 1.5rem',
        backgroundColor: 'var(--tb-surface)',
        borderBottom: '1px solid var(--tb-border)',
        flexShrink: 0,          /* critical: never let the header collapse */
        minHeight: '3rem',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <div style={{
            width: '1.75rem', height: '1.75rem',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: '0.375rem',
            backgroundColor: 'var(--tb-cyan-dim)',
            border: '1px solid rgba(34,211,238,0.25)',
            flexShrink: 0,
          }}>
            <Cpu style={{ width: '0.875rem', height: '0.875rem', color: 'var(--tb-cyan)' }} />
          </div>
          <span style={{
            fontFamily: 'ui-monospace, monospace',
            fontWeight: 700,
            fontSize: '0.8rem',
            letterSpacing: '0.15em',
            color: 'var(--tb-text)',
            whiteSpace: 'nowrap',
          }}>
            TURTLE
            <span style={{ color: 'var(--tb-cyan)' }}>BOT</span>
            3
            <span style={{ color: 'var(--tb-muted)', fontWeight: 400, marginLeft: '0.5rem', fontSize: '0.65rem' }}>
              BURGER
            </span>
          </span>
        </div>

        {/* Tab nav */}
        <nav style={{
          display: 'flex',
          gap: '0.25rem',
          backgroundColor: 'rgba(0,0,0,0.3)',
          border: '1px solid var(--tb-border)',
          borderRadius: '0.5rem',
          padding: '0.25rem',
          flexShrink: 0,
        }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`tb-tab${activeTab === tab.id ? ' tb-tab-active' : ''}`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Right spacer — keeps tabs centred */}
        <div style={{ width: '9rem', flexShrink: 0 }} />
      </header>

      {/* ── Main content — takes all remaining height ── */}
      <main style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
        {activeTab === 'main'        && <MainTab />}
        {activeTab === 'instruction' && <InstructionTab />}
        {activeTab === 'spec'        && <SpecTab />}
      </main>
    </div>
  );
}