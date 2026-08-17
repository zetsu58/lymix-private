'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { cleanRoomId } = require('../src/agora_router');

test('Agora room id accepts stable Lymix identifiers', () => {
  assert.equal(cleanRoomId('room_123-TR'), 'room_123-TR');
  assert.equal(cleanRoomId('  room42  '), 'room42');
});

test('Agora room id rejects unsafe or oversized identifiers', () => {
  assert.throws(() => cleanRoomId(''), /ROOM_ID_INVALID/);
  assert.throws(() => cleanRoomId('room name'), /ROOM_ID_INVALID/);
  assert.throws(() => cleanRoomId('../room'), /ROOM_ID_INVALID/);
  assert.throws(() => cleanRoomId('x'.repeat(65)), /ROOM_ID_INVALID/);
});
