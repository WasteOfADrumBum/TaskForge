import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach } from 'vitest';

// Full-app tests render lazy-loaded pages; under parallel load the 1 s default for findBy*/waitFor
// is occasionally too tight. A longer ceiling only slows tests that would otherwise fail.
configure({ asyncUtilTimeout: 3000 });

afterEach(() => {
  cleanup();
});

// A plain function, not vi.fn(): tests that reset or restore mocks must not leave matchMedia
// returning undefined, because the theme provider reads it on every render.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// jsdom's <dialog> has no browser behavior for Escape: a browser fires `cancel` on the topmost
// modal dialog and closes it unless that event is cancelled. OneSmallUI's Dialog and Drawer rely on
// that native behavior, so emulate it (and the methods, if this jsdom lacks them).
if (typeof HTMLDialogElement !== 'undefined') {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
    this.dataset.testModal = 'true';
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    const modals = [...document.querySelectorAll('dialog[open]')].filter(
      (dialog) => (dialog as HTMLElement).dataset.modal !== 'false',
    ) as HTMLDialogElement[];
    const top = modals.at(-1);
    if (!top) return;
    const cancel = new Event('cancel', { cancelable: true });
    top.dispatchEvent(cancel);
    if (!cancel.defaultPrevented) top.close();
  });
}
