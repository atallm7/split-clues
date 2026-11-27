// What this phone remembers between visits: your name, the room you are in,
// and which of the two players you are in it. Kept on the phone only.
//
// Note for iPhone: Safari and a Home Screen icon each keep their own copy, which
// is why the room id also lives in the page address (see main.js).

const KEY = 'split-clues/v1';

function read() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY));
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}

function write(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Private browsing or storage turned off: the game still works, it just forgets.
  }
}

export function myName() {
  return read().name || '';
}

export function setMyName(name) {
  write({ ...read(), name });
}

// 'a', 'b', or null if this phone has not said who it is in that room.
export function seatFor(roomId) {
  const seat = (read().rooms || {})[roomId];
  return seat === 'a' || seat === 'b' ? seat : null;
}

export function rememberRoom(roomId, seat) {
  const data = read();
  write({ ...data, rooms: { ...(data.rooms || {}), [roomId]: seat }, last: roomId });
}

export function forgetRoom(roomId) {
  const data = read();
  const rooms = { ...(data.rooms || {}) };
  delete rooms[roomId];
  write({ ...data, rooms, last: data.last === roomId ? null : data.last });
}

// The room this phone was last in, or null.
export function lastRoom() {
  const data = read();
  return data.last && seatFor(data.last) ? data.last : null;
}
