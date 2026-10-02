(() => {
  const SELECTOR = 'select:not([data-native-dropdown]):not(.lunar-dropdown-ignore)';
  let openControl = null;
  let optionButtons = [];

  function getMenu(control) { return control?._menu || null; }
  function getTrigger(control) { return control?.querySelector('.lunar-select-trigger') || null; }

  function close(control) {
    if (!control) return;
    const menu = getMenu(control);
    const trigger = getTrigger(control);
    control.classList.remove('is-open');
    menu?.classList.remove('is-visible');
    trigger?.setAttribute('aria-expanded', 'false');
    if (openControl === control) openControl = null;
  }

  function closeAll(except = null) {
    document.querySelectorAll('.lunar-select.is-open').forEach(control => {
      if (control !== except) close(control);
    });
  }

  function position(control) {
    const trigger = getTrigger(control);
    const menu = getMenu(control);
    if (!trigger || !menu) return;
    const rect = trigger.getBoundingClientRect();
    const margin = 8;
    const gap = 6;
    const width = Math.max(rect.width, 160);
    const maxHeight = Math.min(320, Math.max(44, Math.floor(window.innerHeight * .55)));
    menu.style.width = `${width}px`;
    menu.style.maxHeight = `${maxHeight}px`;

    const left = Math.max(margin, Math.min(window.innerWidth - width - margin, rect.left));
    menu.style.left = `${left}px`;

    const measuredHeight = Math.min(maxHeight, Math.max(44, menu.scrollHeight || 44));
    const below = window.innerHeight - rect.bottom - margin;
    const above = rect.top - margin;
    let top = rect.bottom + gap;
    if (below < Math.min(measuredHeight, 220) && above > below) {
      top = rect.top - measuredHeight - gap;
    }
    menu.style.top = `${Math.max(margin, Math.min(window.innerHeight - measuredHeight - margin, top))}px`;
  }

  function sync(control) {
    const select = control._native;
    const menu = getMenu(control);
    const label = control.querySelector('.lunar-select-label');
    if (!select) return;
    const options = [...select.options];
    const selected = options[select.selectedIndex];
    if (label) label.textContent = selected ? selected.textContent : '';
    menu?.querySelectorAll('.lunar-select-option').forEach(button => {
      const selectedNow = Number(button.dataset.index) === select.selectedIndex;
      button.classList.toggle('is-selected', selectedNow);
      button.setAttribute('aria-selected', selectedNow ? 'true' : 'false');
    });
  }

  function rebuild(control) {
    const select = control._native;
    const menu = getMenu(control);
    if (!select || !menu) return;
    menu.innerHTML = '';
    [...select.options].forEach((option, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'lunar-select-option';
      button.dataset.index = String(index);
      button.textContent = option.textContent;
      button.disabled = option.disabled;
      button.setAttribute('role', 'option');
      button.addEventListener('click', event => {
        event.stopPropagation();
        if (option.disabled) return;
        select.selectedIndex = index;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        sync(control);
        close(control);
        getTrigger(control)?.focus();
      });
      menu.appendChild(button);
    });
    sync(control);
  }

  function open(control) {
    closeAll(control);
    const menu = getMenu(control);
    const trigger = getTrigger(control);
    if (!menu || !trigger) return;
    control.classList.add('is-open');
    menu.classList.add('is-visible');
    trigger.setAttribute('aria-expanded', 'true');
    position(control);
    openControl = control;
    optionButtons = [...menu.querySelectorAll('.lunar-select-option:not(:disabled)')];
    const selected = menu.querySelector('.is-selected:not(:disabled)') || optionButtons[0];
    selected?.focus({ preventScroll: true });
  }

  function toggle(control) {
    if (control.classList.contains('is-open')) close(control); else open(control);
  }

  function enhance(select) {
    if (!(select instanceof HTMLSelectElement) || select.closest('.lunar-select')) return;
    if (!select.parentElement) return;

    const control = document.createElement('div');
    control.className = 'lunar-select';
    control.dataset.for = select.name || select.id || '';
    control._native = select;

    select.classList.add('lunar-select-native');
    select.setAttribute('aria-hidden', 'true');
    select.tabIndex = -1;

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'lunar-select-trigger';
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.innerHTML = '<span class="lunar-select-label"></span><i class="fa-solid fa-chevron-down lunar-select-chevron" aria-hidden="true"></i>';

    const menu = document.createElement('div');
    menu.className = 'lunar-select-menu';
    menu.setAttribute('role', 'listbox');
    menu.dataset.owner = select.id || select.name || `select-${Math.random().toString(36).slice(2)}`;
    control._menu = menu;

    trigger.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      toggle(control);
    });
    trigger.addEventListener('keydown', event => {
      if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open(control);
      } else if (event.key === 'Escape') {
        close(control);
      }
    });

    menu.addEventListener('keydown', event => {
      const current = document.activeElement;
      const index = optionButtons.indexOf(current);
      if (event.key === 'Escape') {
        event.preventDefault();
        close(control);
        trigger.focus();
        return;
      }
      if (event.key === 'ArrowDown' && optionButtons.length) {
        event.preventDefault();
        optionButtons[(index + 1 + optionButtons.length) % optionButtons.length].focus();
      }
      if (event.key === 'ArrowUp' && optionButtons.length) {
        event.preventDefault();
        optionButtons[(index - 1 + optionButtons.length) % optionButtons.length].focus();
      }
      if (event.key === 'Home' && optionButtons.length) {
        event.preventDefault();
        optionButtons[0].focus();
      }
      if (event.key === 'End' && optionButtons.length) {
        event.preventDefault();
        optionButtons.at(-1).focus();
      }
      if ((event.key === 'Enter' || event.key === ' ') && current?.classList.contains('lunar-select-option')) {
        event.preventDefault();
        current.click();
      }
    });

    control.append(trigger);
    select.insertAdjacentElement('afterend', control);
    document.body.appendChild(menu);
    rebuild(control);

    select.addEventListener('change', () => sync(control));
    const observer = new MutationObserver(() => rebuild(control));
    observer.observe(select, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] });
  }

  function scan(root = document) {
    root.querySelectorAll?.(SELECTOR).forEach(enhance);
  }

  document.addEventListener('click', event => {
    if (!event.target.closest('.lunar-select') && !event.target.closest('.lunar-select-menu')) closeAll();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeAll();
  });
  window.addEventListener('resize', () => openControl && position(openControl), { passive: true });
  window.addEventListener('scroll', () => openControl && position(openControl), { passive: true, capture: true });

  const start = () => {
    scan();
    const observer = new MutationObserver(records => {
      for (const record of records) for (const node of record.addedNodes) {
        if (node.nodeType === 1) scan(node);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
