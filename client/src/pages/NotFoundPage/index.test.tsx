import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import NotFoundPage from './index';

describe('NotFoundPage', () => {
  it('renders the page not found message', () => {
    render(<NotFoundPage />);

    expect(screen.getByRole('heading', { name: /404 - page not found/i })).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to the TaskForge home page' })).toHaveAttribute(
      'href',
      '/',
    );
  });
});
