import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initSearchClear, initHelpButton } from '../../src/lib/keyboard';

describe('initSearchClear', () => {
  let input: HTMLInputElement;
  let clearBtn: HTMLButtonElement;

  beforeEach(() => {
    input = document.createElement('input');
    clearBtn = document.createElement('button');
    clearBtn.style.display = 'none';
    document.body.appendChild(input);
    document.body.appendChild(clearBtn);
    initSearchClear(input, clearBtn);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('shows the clear button when input has a value', () => {
    input.value = 'hello';
    input.dispatchEvent(new Event('input'));
    expect(clearBtn.style.display).toBe('flex');
  });

  it('hides the clear button when input is empty', () => {
    input.value = 'hello';
    input.dispatchEvent(new Event('input'));
    input.value = '';
    input.dispatchEvent(new Event('input'));
    expect(clearBtn.style.display).toBe('none');
  });

  it('clears the input value when clear button is clicked', () => {
    input.value = 'hello';
    input.dispatchEvent(new Event('input'));
    clearBtn.click();
    expect(input.value).toBe('');
  });

  it('hides the clear button after clicking clear', () => {
    input.value = 'hello';
    input.dispatchEvent(new Event('input'));
    clearBtn.click();
    expect(clearBtn.style.display).toBe('none');
  });

  it('dispatches an input event after clearing so downstream handlers fire', () => {
    const spy = vi.fn();
    input.addEventListener('input', spy);
    input.value = 'hello';
    clearBtn.click();
    expect(spy).toHaveBeenCalled();
  });
});

describe('initHelpButton', () => {
  let helpBtn: HTMLButtonElement;
  let modal: HTMLElement;
  let backdrop: HTMLElement;

  beforeEach(() => {
    helpBtn = document.createElement('button');
    modal = document.createElement('div');
    backdrop = document.createElement('div');
    document.body.appendChild(helpBtn);
    document.body.appendChild(modal);
    document.body.appendChild(backdrop);
    initHelpButton(helpBtn, modal, backdrop);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('adds "visible" class to modal when help button is clicked', () => {
    helpBtn.click();
    expect(modal.classList.contains('visible')).toBe(true);
  });

  it('adds "visible" class to backdrop when help button is clicked', () => {
    helpBtn.click();
    expect(backdrop.classList.contains('visible')).toBe(true);
  });

  it('does not throw when modal or backdrop is null', () => {
    const btn2 = document.createElement('button');
    document.body.appendChild(btn2);
    initHelpButton(btn2, null, null);
    expect(() => btn2.click()).not.toThrow();
  });
});
