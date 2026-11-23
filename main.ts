import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const IN = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const OUT = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const KEYS = ['HALT','PUSH8','PUSH32','POP','DUP','SWAP','OVER','ROT','ADD','SUB','MUL',
  'DIV','MOD','DIVU','MODU','NEG','AND','OR','XOR','NOT','SHL','SHR','SHRU','EQ','LT',
  'LTU','JMP','JZ','JNZ','CALL','RET','LOAD','STORE','PRINT','PUTC','IN','EXIT'];
const SHAPE = { HALT:[0,0,0], PUSH8:[1,0,1], PUSH32:[4,0,1], POP:[0,1,0], DUP:[0,1,2],
  SWAP:[0,2,2], OVER:[0,2,3], ROT:[0,3,3], ADD:[0,2,1], SUB:[0,2,1], MUL:[0,2,1],
  DIV:[0,2,1], MOD:[0,2,1], DIVU:[0,2,1], MODU:[0,2,1], NEG:[0,1,1], AND:[0,2,1],
  OR:[0,2,1], XOR:[0,2,1], NOT:[0,1,1], SHL:[0,2,1], SHR:[0,2,1], SHRU:[0,2,1],
  EQ:[0,2,1], LT:[0,2,1], LTU:[0,2,1], JMP:[2,0,0], JZ:[2,1,0], JNZ:[2,1,0],
  CALL:[2,0,0], RET:[0,0,0], LOAD:[0,1,1], STORE:[0,2,0], PRINT:[0,1,0], PUTC:[0,1,0],
  IN:[0,0,1], EXIT:[0,1,0] };
const NAME = new Int8Array(256).fill(-1);
for (const [op, k] of [[0,'HALT'],[1,'PUSH8'],[2,'PUSH32'],[3,'POP'],[4,'DUP'],[5,'SWAP'],
  [6,'OVER'],[7,'ROT'],[0x10,'ADD'],[0x11,'SUB'],[0x12,'MUL'],[0x13,'DIV'],[0x14,'MOD'],
  [0x15,'DIVU'],[0x16,'MODU'],[0x17,'NEG'],[0x18,'AND'],[0x19,'OR'],[0x1a,'XOR'],
  [0x1b,'NOT'],[0x1c,'SHL'],[0x1d,'SHR'],[0x1e,'SHRU'],[0x20,'EQ'],[0x21,'LT'],
  [0x22,'LTU'],[0x30,'JMP'],[0x31,'JZ'],[0x32,'JNZ'],[0x33,'CALL'],[0x34,'RET'],
  [0x40,'LOAD'],[0x41,'STORE'],[0x50,'PRINT'],[0x51,'PUTC'],[0x52,'IN'],[0x53,'EXIT']])
  NAME[op] = KEYS.indexOf(k);

export function run(program, input) {
  const len = program.length, st = new Int32Array(256), cs = new Int32Array(64),
    mem = new Int32Array(256), out = new Uint8Array(65536);
  let sp = 0, cp = 0, ol = 0, ia = 0, pc = 0, st2 = 0;
  const done = (exit) => ({ stdout: out.subarray(0, ol), exit });
  for (;;) {
    if (st2 === 1e6) return done(10);
    if (pc < 0 || pc >= len) return done(9);
    const op = NAME[program[pc]];
    if (op < 0) return done(5);
    const key = KEYS[op], [imm, pops, pushes] = SHAPE[key];
    if (pc + imm >= len) return done(9);
    const nx = pc + 1 + imm;
    if (sp < pops) return done(2);
    if (sp - pops + pushes > 256) return done(3);
    st2++; pc = nx;
    switch (key) {
      case 'HALT': return done(0);
      case 'PUSH8': st[sp++] = (program[nx - 1] << 24) >> 24; break;
      case 'PUSH32': st[sp++] = program[nx - 4] | (program[nx - 3] << 8)
        | (program[nx - 2] << 16) | (program[nx - 1] << 24); break;
      case 'POP': sp--; break;
      case 'DUP': st[sp] = st[sp - 1]; sp++; break;
      case 'SWAP': { const t = st[sp - 1]; st[sp - 1] = st[sp - 2]; st[sp - 2] = t; break; }
      case 'OVER': st[sp] = st[sp - 2]; sp++; break;
      case 'ROT': { const c = st[sp - 3]; st[sp - 3] = st[sp - 2]; st[sp - 2] = st[sp - 1]; st[sp - 1] = c; break; }
      case 'NEG': st[sp - 1] = -st[sp - 1] | 0; break;
      case 'NOT': st[sp - 1] = ~st[sp - 1]; break;
      case 'ADD': case 'SUB': case 'MUL': case 'DIV': case 'MOD':
      case 'DIVU': case 'MODU': case 'AND': case 'OR': case 'XOR':
      case 'SHL': case 'SHR': case 'SHRU': case 'EQ': case 'LT': case 'LTU': {
        const b = st[sp - 1], a = st[sp - 2];
        let r;
        switch (key) {
          case 'ADD': r = (a + b) | 0; break;
          case 'SUB': r = (a - b) | 0; break;
          case 'MUL': r = Math.imul(a, b); break;
          case 'DIV': if (b === 0) return done(4); r = (a === -2147483648 && b === -1) ? a : (a / b) | 0; break;
          case 'MOD': if (b === 0) return done(4); r = b === -1 ? 0 : (a % b) | 0; break;
          case 'DIVU': if (b === 0) return done(4); r = Math.floor((a >>> 0) / (b >>> 0)) | 0; break;
          case 'MODU': if (b === 0) return done(4); r = ((a >>> 0) % (b >>> 0)) | 0; break;
          case 'AND': r = a & b; break;
          case 'OR': r = a | b; break;
          case 'XOR': r = a ^ b; break;
          case 'SHL': r = a << (b & 31); break;
          case 'SHR': r = a >> (b & 31); break;
          case 'SHRU': r = (a >>> (b & 31)) | 0; break;
          case 'EQ': r = a === b ? 1 : 0; break;
          case 'LT': r = a < b ? 1 : 0; break;
          case 'LTU': r = (a >>> 0) < (b >>> 0) ? 1 : 0; break;
        }
        sp -= 2; st[sp++] = r;
        break;
      }
      case 'JMP': case 'JZ': case 'JNZ': {
        const rel = ((program[nx - 2] | (program[nx - 1] << 8)) << 16) >> 16;
        let tk = true;
        if (key !== 'JMP') { const v = st[--sp]; tk = key === 'JZ' ? v === 0 : v !== 0; }
        if (tk) pc = nx + rel;
        break;
      }
      case 'CALL':
        if (cp === 64) return done(7);
        cs[cp++] = nx;
        pc = program[nx - 2] | (program[nx - 1] << 8);
        break;
      case 'RET':
        if (cp === 0) return done(8);
        pc = cs[--cp];
        break;
      case 'LOAD': {
        const ad = st[sp - 1];
        if (ad < 0 || ad >= 256) return done(6);
        st[sp - 1] = mem[ad];
        break;
      }
      case 'STORE': {
        const ad = st[sp - 1], v = st[sp - 2];
        if (ad < 0 || ad >= 256) return done(6);
        sp -= 2; mem[ad] = v;
        break;
      }
      case 'PRINT': {
        const t = String(st[sp - 1]);
        if (ol + t.length > 65536) return done(11);
        out.set(Buffer.from(t, 'latin1'), ol);
        ol += t.length; sp--;
        break;
      }
      case 'PUTC':
        if (ol + 1 > 65536) return done(11);
        out[ol++] = st[--sp] & 255;
        break;
      case 'IN': st[sp++] = ia < input.length ? input[ia++] : -1; break;
      case 'EXIT': return done(st[--sp] & 255);
    }
  }
}
for (const id of readdirSync(IN).sort()) {
  const { stdout, exit } = run(readFileSync(join(IN, id, 'program.bin')), readFileSync(join(IN, id, 'input.bin')));
  mkdirSync(join(OUT, id), { recursive: true });
  writeFileSync(join(OUT, id, 'stdout.bin'), stdout);
  writeFileSync(join(OUT, id, 'exit.txt'), `${exit}\n`);
}
