import useStore from '../state/store';

const TRANSITION = 'background-color 500ms, border-color 500ms';

export default function ThemeToggle() {
  const currentTheme = useStore((s) => s.currentTheme);
  const theme = useStore((s) => s.theme);
  const toggleTheme = useStore((s) => s.toggleTheme);

  const isDark = currentTheme === 'dark';

  return (
    <button
      onClick={toggleTheme}
      style={{
        position: 'fixed',
        top: 12,
        right: 12,
        zIndex: 20,
        width: 52,
        height: 28,
        borderRadius: 14,
        border: `1px solid ${theme.panelBorder}`,
        background: theme.panelBg,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        cursor: 'pointer',
        padding: 0,
        display: 'flex',
        alignItems: 'center',
        transition: TRANSITION,
        outline: 'none',
      }}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
    >
      {/* Sliding knob */}
      <div style={{
        width: 22,
        height: 22,
        borderRadius: '50%',
        background: isDark ? '#2a2a3a' : '#e8e4df',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 12,
        lineHeight: 1,
        transform: isDark ? 'translateX(3px)' : 'translateX(27px)',
        transition: 'transform 300ms ease, background 300ms ease',
      }}>
        {isDark ? '☾' : '☀'}
      </div>
    </button>
  );
}
