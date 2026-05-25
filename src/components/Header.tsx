// import { Wifi, WifiOff, Cpu } from 'lucide-react';

// interface HeaderProps {
//   status?: 'Active' | 'Inactive';
// }

// export function Header({ status = 'Inactive' }: HeaderProps) {
//   const isActive = status === 'Active';

//   return (
//     <header style={{
//       display: 'flex',
//       alignItems: 'center',
//       justifyContent: 'space-between',
//       padding: '0.6rem 1.5rem',
//       backgroundColor: 'var(--tb-surface)',
//       borderBottom: '1px solid var(--tb-border)',
//       flexShrink: 0,
//     }}>
//       {/* Logo */}
//       <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
//         <div style={{
//           width: '1.75rem', height: '1.75rem',
//           display: 'flex', alignItems: 'center', justifyContent: 'center',
//           borderRadius: '0.375rem',
//           backgroundColor: 'var(--tb-cyan-dim)',
//           border: '1px solid rgba(34,211,238,0.25)',
//         }}>
//           <Cpu style={{ width: '0.875rem', height: '0.875rem', color: 'var(--tb-cyan)' }} />
//         </div>
//         <span style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 700, fontSize: '0.8rem', letterSpacing: '0.15em', color: 'var(--tb-text)' }}>
//           TURTLE<span style={{ color: 'var(--tb-cyan)' }}>BOT</span>
//           <span style={{ color: 'var(--tb-muted)', fontWeight: 400, marginLeft: '0.5rem', fontSize: '0.65rem' }}>BURGER</span>
//         </span>
//       </div>

//       {/* Connection status */}
//       <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
//         <div style={{
//           width: '6px', height: '6px', borderRadius: '9999px',
//           backgroundColor: isActive ? 'var(--tb-cyan)' : 'var(--tb-red)',
//           boxShadow: isActive ? 'var(--tb-cyan-glow)' : 'none',
//           animation: 'pulse 2s infinite',
//         }} />
//         <span style={{
//           fontFamily: 'ui-monospace, monospace',
//           fontSize: '0.65rem',
//           letterSpacing: '0.15em',
//           color: isActive ? 'var(--tb-cyan)' : 'var(--tb-red)',
//         }}>
//           {isActive ? 'CONNECTED' : 'OFFLINE'}
//         </span>
//         {isActive
//           ? <Wifi    style={{ width: '0.875rem', height: '0.875rem', color: 'var(--tb-cyan)' }} />
//           : <WifiOff style={{ width: '0.875rem', height: '0.875rem', color: 'var(--tb-red)'  }} />
//         }
//       </div>
//     </header>
//   );
// }