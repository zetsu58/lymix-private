'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { cleanRoomId, buildChannelName } = require('../src/agora_router');

test('Agora room id accepts stable Lymix identifiers', () => {
  assert.equal(cleanRoomId('room_123-TR'), 'room_123-TR');
  assert.equal(cleanRoomId('  room42  '), 'room42');
  assert.equal(buildChannelName('room42'), 'lymix_room42');
});

test('Agora room id rejects unsafe identifiers', () => {
  assert.throws(() => cleanRoomId(''), /ROOM_ID_INVALID/);
  assert.throws(() => cleanRoomId('room name'), /ROOM_ID_INVALID/);
  assert.throws(() => cleanRoomId('../room'), /ROOM_ID_INVALID/);
  assert.throws(() => cleanRoomId('x'.repeat(129)), /ROOM_ID_INVALID/);
});

test('Agora channel name hashes long valid room ids into <=64 bytes', () => {
  const room = 'x'.repeat(100);
  const first = buildChannelName(room);
  const second = buildChannelName(room);
  assert.equal(first, second);
  assert.ok(first.startsWith('lymix_'));
  assert.ok(Buffer.byteLength(first, 'utf8') <= 64);
});
