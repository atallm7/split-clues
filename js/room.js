// Small questions about a room that several screens ask.

export function otherSeat(seat) {
  return seat === 'a' ? 'b' : 'a';
}

// True if that player has the game open and in view right now.
export function isHere(room, seat) {
  const marks = room.presence && room.presence[seat];
  return !!marks && Object.keys(marks).length > 0;
}
