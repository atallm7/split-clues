// A surprise for your partner: a note and, if you like, a photo. It is kept
// beside the room and shown to them only on the last screen of an episode,
// once you have both finished it.

import { h, replaceChildren } from './dom.js';
import { toast, openSheet } from './ui.js';
import { loadSurpriseNote, loadSurprisePhoto, saveSurprise, removeSurprise } from './sync.js';

const NOTE_MAX = 500;
const PHOTO_SIDE = 1200; // longest side, in pixels
const PHOTO_CHARS = 450000; // about 340 KB once stored

// Shrinks a photo on the phone to a small JPEG, returned as a "data:" address.
export async function shrinkPhoto(file) {
  const address = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('not a picture'));
      img.src = address;
    });
    let side = PHOTO_SIDE;
    let quality = 0.82;
    let out = '';
    for (let attempt = 0; attempt < 5; attempt++) {
      const scale = Math.min(1, side / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
      out = canvas.toDataURL('image/jpeg', quality);
      if (out.length <= PHOTO_CHARS) break;
      side = Math.round(side * 0.75);
      quality -= 0.07;
    }
    return out;
  } finally {
    URL.revokeObjectURL(address);
  }
}

// Opens the sheet where you write (or change, or remove) your surprise.
// onChanged(hasSurprise) is called after a save or a removal.
export async function openSurpriseEditor({ roomId, episode, seat, partnerName, onChanged }) {
  let existing = null;
  try {
    existing = await loadSurpriseNote(roomId, episode.id, seat);
  } catch {
    return toast('Could not open your surprise. Check your connection.');
  }

  // photo: undefined = leave what is saved, null = remove it, text = a new one
  let photo;
  let hasPhoto = !!(existing && existing.hasPhoto);

  const note = h('textarea', {
    class: 'field field--area',
    maxlength: NOTE_MAX,
    rows: 4,
    placeholder: 'Write a note…',
    'aria-label': 'Your note',
  });
  note.value = existing ? existing.text || '' : '';

  const preview = h('img', { class: 'surprise__preview', alt: 'Your photo', hidden: true });
  const picker = h('input', { type: 'file', accept: 'image/*', hidden: true, 'aria-label': 'Choose a photo' });
  const choose = h('button', { class: 'btn btn--ghost btn--small', type: 'button', onclick: () => picker.click() });
  const drop = h('button', { class: 'btn btn--text', type: 'button', onclick: () => {
    photo = null;
    hasPhoto = false;
    showPhoto();
  } }, 'Remove photo');

  function showPhoto() {
    choose.textContent = hasPhoto ? 'Change photo' : 'Add a photo';
    drop.hidden = !hasPhoto;
    preview.hidden = !(hasPhoto && preview.src);
  }

  picker.addEventListener('change', async () => {
    const file = picker.files && picker.files[0];
    picker.value = '';
    if (!file) return;
    choose.disabled = true;
    choose.textContent = 'Preparing…';
    try {
      photo = await shrinkPhoto(file);
      hasPhoto = true;
      preview.src = photo;
    } catch {
      toast('That file could not be used as a photo.');
    }
    choose.disabled = false;
    showPhoto();
  });

  // Show the photo already saved, if there is one.
  if (hasPhoto) {
    loadSurprisePhoto(roomId, episode.id, seat).then((saved) => {
      if (saved && photo === undefined) {
        preview.src = saved;
        showPhoto();
      }
    }).catch(() => {});
  }
  showPhoto();

  openSheet({
    title: `A surprise for ${partnerName}`,
    body: h('div', { class: 'surprise' },
      h('p', null, `${partnerName} sees this only on the last screen, once you have both finished ${episode.title}.`),
      note,
      preview,
      h('div', { class: 'surprise__photo' }, choose, drop, picker),
    ),
    actions: [
      {
        label: 'Save the surprise',
        kind: 'primary',
        keepOpen: true,
        onSelect: async (close, button) => {
          const text = note.value.trim().slice(0, NOTE_MAX);
          if (!text && !hasPhoto) return toast('Write a note or add a photo first.');
          button.disabled = true;
          button.textContent = 'Saving…';
          try {
            await saveSurprise(roomId, episode.id, seat, { text, photo, hasPhoto });
            close();
            toast('Tucked away for the finish.');
            onChanged(true);
          } catch {
            button.disabled = false;
            button.textContent = 'Save the surprise';
            toast('Could not save. Check your connection and try again.');
          }
        },
      },
      existing ? {
        label: 'Take it back',
        kind: 'ghost',
        onSelect: () => removeSurprise(roomId, episode.id, seat)
          .then(() => { toast('Surprise removed.'); onChanged(false); })
          .catch(() => toast('Could not remove it. Check your connection.')),
      } : null,
      { label: 'Cancel', kind: 'ghost' },
    ],
  });
}

// For the last screen: an empty box that fills with your partner's surprise, if they left one.
export function surpriseView(roomId, episodeId, fromSeat, fromName) {
  const box = h('div', { class: 'gift', hidden: true });
  loadSurpriseNote(roomId, episodeId, fromSeat).then(async (found) => {
    if (!found) return;
    const picture = h('img', { class: 'gift__photo', alt: `A photo from ${fromName}`, hidden: true });
    replaceChildren(box,
      h('p', { class: 'gift__from' }, `${fromName} left you something`),
      picture,
      found.text ? h('p', { class: 'gift__text' }, found.text) : null,
    );
    box.hidden = false;
    if (found.hasPhoto) {
      const photo = await loadSurprisePhoto(roomId, episodeId, fromSeat);
      if (photo) {
        picture.src = photo;
        picture.hidden = false;
      }
    }
  }).catch(() => {});
  return box;
}
