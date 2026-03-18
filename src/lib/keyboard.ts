// keyboard.ts — search-clear and help-button handlers extracted from PeopleLayout.astro.
// Functions accept DOM elements as arguments for testability.

export function initSearchClear(
  input: HTMLInputElement,
  clearBtn: HTMLButtonElement,
): void {
  input.addEventListener('input', () => {
    clearBtn.style.display = input.value ? 'flex' : 'none';
  });
  clearBtn.addEventListener('click', () => {
    input.value = '';
    clearBtn.style.display = 'none';
    input.dispatchEvent(new Event('input'));
    input.focus();
  });
}

export function initHelpButton(
  helpBtn: HTMLElement,
  modal: HTMLElement | null,
  backdrop: HTMLElement | null,
): void {
  helpBtn.addEventListener('click', () => {
    modal?.classList.add('visible');
    backdrop?.classList.add('visible');
  });
}
