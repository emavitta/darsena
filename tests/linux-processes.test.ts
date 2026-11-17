import test from 'node:test'
import assert from 'node:assert/strict'
import { parseSsListeners } from '../desktop/processes.js'

// Real lines from the lab server (`ss -H -ltnpe`), plus synthetic edge cases.
const SAMPLE = `
LISTEN 0      511                                 127.0.0.1:4870  0.0.0.0:* uid:116 ino:143142216 sk:14020 cgroup:/system.slice/magolab.service <->
LISTEN 0      128                                 127.0.0.1:5037  0.0.0.0:* uid:116 ino:117872608 sk:1400d cgroup:/system.slice/magolab-adb.service <->
LISTEN 0      511                                         *:5190  *:*       users:(("MainThread",pid=2286747,fd=26)) uid:1001 ino:4907904 sk:d003 cgroup:/user.slice/user-1001.slice <->
LISTEN 0      511                                 127.0.0.1:5174  0.0.0.0:* users:(("node",pid=1234,fd=22)) uid:1001 ino:1 sk:1 <->
LISTEN 0      511                                     [::1]:5174  [::]:*    users:(("node",pid=1234,fd=23)) uid:1001 ino:2 sk:2 <->
LISTEN 0      511                                     [::1]:9999  [::]:*    users:(("node",pid=77,fd=3)) uid:1001 ino:3 sk:3 <->
`

test('parses sockets of other users without guessing a process', () => {
  const rows = parseSsListeners(SAMPLE)
  const adb = rows.find((r) => r.port === 5037)
  assert.ok(adb)
  assert.equal(adb.pid, 0)
  assert.equal(adb.command, '')
  assert.equal(adb.uid, 116)
})

test('parses own processes with pid and name', () => {
  const rows = parseSsListeners(SAMPLE)
  const wtc = rows.find((r) => r.port === 5190)
  assert.ok(wtc)
  assert.equal(wtc.pid, 2286747)
  assert.equal(wtc.command, 'MainThread')
  assert.equal(wtc.uid, 1001)
})

test('merges the IPv4 and IPv6 sockets of one holder on one port', () => {
  const rows = parseSsListeners(SAMPLE).filter((r) => r.port === 5174)
  assert.equal(rows.length, 1)
  assert.equal(rows[0]!.address, '127.0.0.1, ::1')
  assert.equal(rows[0]!.ipv6Only, undefined)
})

test('flags a socket bound only to ::1', () => {
  const row = parseSsListeners(SAMPLE).find((r) => r.port === 9999)
  assert.ok(row)
  assert.equal(row.ipv6Only, true)
})
