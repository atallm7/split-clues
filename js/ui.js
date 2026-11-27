// Bits of interface shared by every screen: short messages, the connection
// notice, and the slide-up sheet used for confirmations.

import { h } from './dom.js';

// ---------- Toasts: short messages that fade on their own ----------

export function toast(text, { ms = 2600 } = {}) {
  const box = document.getElementById('toasts');
  const el = h('div', { class: 'toast' }, text);
  box.replaceChildren(el); // one at a time: a new message replaces the old one
  setTimeout(() => {
    el.classList.add('is-leaving');
    setTimeout(() => el.remove(), 300);
  }, ms);
}

// ---------- Connection notice ----------

// kind: 'warn' while the link is down, 'ok' for the brief "back" message.
export function setPill(text, kind = 'warn') {
  const pill = document.getElementById('pill');
  if (!text) {
    pill.hidden = true;
    return;
  }
  pill.textContent = text;
  pill.dataset.kind = kind;
  pill.hidden = false;
}

// ---------- Sheet ----------

// openSheet({ title, body, actions: [{ label, kind: 'primary' | 'ghost' | 'danger', onSelect }] })
// Tapping outside the sheet, or any action, closes it.
export function openSheet({ title, body, actions = [] }) {
  const close = () => {
    if (overlay.classList.contains('is-leaving')) return;
    overlay.classList.add('is-leaving');
    setTimeout(() => overlay.remove(), 220);
  };
  const sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('h2', { class: 'sheet__title' }, title),
    body ? h(typeof body === 'string' ? 'p' : 'div', { class: 'sheet__body' }, body) : null,
    h('div', { class: 'actions' }, actions.filter(Boolean).map((action) => h('button', {
      class: `btn btn--${action.kind || 'ghost'}`,
      type: 'button',
      onclick: () => { close(); if (action.onSelect) action.onSelect(); },
    }, action.label))),
  );
  const overlay = h('div', { class: 'overlay', onclick: (event) => { if (event.target === overlay) close(); } }, sheet);
  document.body.append(overlay);
  return close;
}

// ---------- Names ----------

export const NAME_MAX = 16;

// Tidy what someone typed as their name. Returns '' if there is nothing usable.
export function cleanName(raw) {
  return String(raw || '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);
}

// The name box used on the title and join screens.
export function nameField(value = '') {
  return h('input', {
    class: 'field',
    type: 'text',
    name: 'name',
    value,
    placeholder: 'Your name',
    maxlength: NAME_MAX,
    autocomplete: 'given-name',
    autocapitalize: 'words',
    autocorrect: 'off',
    spellcheck: 'false',
    enterkeyhint: 'go',
    'aria-label': 'Your name',
  });
}

// Shake a field that was left empty and put the cursor in it.
export function nudge(field) {
  field.classList.remove('is-nudged');
  void field.getBoundingClientRect();
  field.classList.add('is-nudged');
  field.focus();
}
