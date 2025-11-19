import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ThemeToggle from '../ThemeToggle';
import { ThemeProvider } from '../../context/ThemeContext';
describe('ThemeToggle', () => {
  it('renders toggle button', () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    );
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });
  it('toggles theme on click', () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    );
    const button = screen.getByRole('button');
    fireEvent.click(button);
    expect(localStorage.setItem).toHaveBeenCalled();
  });
});
