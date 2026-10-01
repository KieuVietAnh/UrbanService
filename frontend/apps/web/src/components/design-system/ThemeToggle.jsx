import { Sun, Moon } from 'lucide-react';
import clsx from './clsx';
import { useTheme } from '../../contexts/ThemeContext';

function ThemeToggle({ className }) {
  const { theme, toggle } = useTheme();

  return (
    <button
      onClick={toggle}
      aria-label="Toggle theme"
      title="Toggle theme"
      className={clsx('inline-flex items-center justify-center p-2 rounded-md focus-visible:outline-none', className)}
    >
      {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}

export default ThemeToggle;
