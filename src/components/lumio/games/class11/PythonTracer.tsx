'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Pause, SkipForward, RotateCcw, StepForward, Terminal, Variable, FileCode2 } from 'lucide-react';
import { GameShell, type GameProps } from '../GameShell';
import { PredictFirst, ChapterRef, LabReport } from './shared';
import { cn } from '@/lib/utils';

/**
 * Python Tracer Lab: a small, honestly documented Python-subset interpreter
 * written from scratch in TypeScript (no eval, no Function, no external
 * libraries). The whole run is precomputed as a list of steps, then replayed
 * step by step so learners can watch variables and output evolve.
 */

/* ============================ values ============================ */

type Val =
  | { t: 'int'; v: number }
  | { t: 'float'; v: number }
  | { t: 'str'; v: string }
  | { t: 'bool'; v: boolean }
  | { t: 'list'; v: Val[] }
  | { t: 'none' };

class PyError extends Error {}

const BREAK_SIG = { sig: 'break' as const };
const CONT_SIG = { sig: 'continue' as const };
const CAP_SIG = { sig: 'cap' as const };

const MAX_STEPS = 10000;
const MAX_RANGE = 100000;

function fmtFloat(v: number): string {
  return Number.isInteger(v) ? v.toFixed(1) : String(v);
}

/** Python str() semantics (what print shows). */
function fmtVal(x: Val): string {
  switch (x.t) {
    case 'int': return String(x.v);
    case 'float': return fmtFloat(x.v);
    case 'str': return x.v;
    case 'bool': return x.v ? 'True' : 'False';
    case 'none': return 'None';
    case 'list': return '[' + x.v.map(reprVal).join(', ') + ']';
  }
}

/** Python repr() semantics (what lists show inside). */
function reprVal(x: Val): string {
  if (x.t === 'str') return "'" + x.v + "'";
  return fmtVal(x);
}

function typeName(x: Val): string {
  return x.t === 'none' ? 'NoneType' : x.t;
}

function truthy(x: Val): boolean {
  switch (x.t) {
    case 'bool': return x.v;
    case 'int':
    case 'float': return x.v !== 0;
    case 'str':
    case 'list': return x.v.length > 0;
    case 'none': return false;
  }
}

function numOf(x: Val, op: string): number {
  if (x.t === 'int' || x.t === 'float') return x.v;
  if (x.t === 'bool') return x.v ? 1 : 0;
  throw new PyError(`unsupported operand type for '${op}'`);
}

function isIntLike(x: Val): boolean {
  return x.t === 'int' || x.t === 'bool';
}

/** Python-style index value from an int-like Val (bool counts as 1/0). */
function valToInt(x: Val): number {
  if (x.t === 'int' || x.t === 'float') return x.v;
  if (x.t === 'bool') return x.v ? 1 : 0;
  return 0;
}

function mkNum(v: number, int: boolean): Val {
  return int ? { t: 'int', v } : { t: 'float', v };
}

function deepEq(a: Val, b: Val): boolean {
  if (a.t === 'list' && b.t === 'list') {
    if (a.v.length !== b.v.length) return false;
    return a.v.every((item, i) => deepEq(item, b.v[i]));
  }
  if (a.t === 'str' && b.t === 'str') return a.v === b.v;
  if (a.t === 'none' && b.t === 'none') return true;
  if (isIntLike(a) || a.t === 'float') {
    if (isIntLike(b) || b.t === 'float') return numOf(a, '==') === numOf(b, '==');
    return false;
  }
  return false;
}

function binOp(op: string, a: Val, b: Val): Val {
  if (op === '+') {
    if (a.t === 'str' && b.t === 'str') return { t: 'str', v: a.v + b.v };
    if (a.t === 'list' && b.t === 'list') return { t: 'list', v: [...a.v, ...b.v] };
    const x = numOf(a, op);
    const y = numOf(b, op);
    return mkNum(x + y, isIntLike(a) && isIntLike(b));
  }
  if (op === '*') {
    if (a.t === 'str' && isIntLike(b)) {
      const n = numOf(b, op);
      return { t: 'str', v: n <= 0 ? '' : a.v.repeat(Math.min(n, MAX_RANGE)) };
    }
    if (a.t === 'list' && isIntLike(b)) {
      const n = numOf(b, op);
      const out: Val[] = [];
      for (let i = 0; i < Math.max(0, Math.min(n, MAX_RANGE)); i++) out.push(...a.v);
      return { t: 'list', v: out };
    }
    const x = numOf(a, op);
    const y = numOf(b, op);
    return mkNum(x * y, isIntLike(a) && isIntLike(b));
  }
  if (op === '-') {
    const x = numOf(a, op);
    const y = numOf(b, op);
    return mkNum(x - y, isIntLike(a) && isIntLike(b));
  }
  if (op === '/') {
    const x = numOf(a, op);
    const y = numOf(b, op);
    if (y === 0) throw new PyError('division by zero');
    return { t: 'float', v: x / y };
  }
  if (op === '//') {
    const x = numOf(a, op);
    const y = numOf(b, op);
    if (y === 0) throw new PyError('integer division or modulo by zero');
    return mkNum(Math.floor(x / y), isIntLike(a) && isIntLike(b));
  }
  if (op === '%') {
    const x = numOf(a, op);
    const y = numOf(b, op);
    if (y === 0) throw new PyError('integer division or modulo by zero');
    const r = x - Math.floor(x / y) * y;
    return mkNum(r, isIntLike(a) && isIntLike(b));
  }
  if (op === '**') {
    const x = numOf(a, op);
    const y = numOf(b, op);
    const r = Math.pow(x, y);
    if (!Number.isFinite(r)) throw new PyError('result of ** is too large for this tracer');
    return mkNum(r, isIntLike(a) && isIntLike(b) && y >= 0);
  }
  throw new PyError(`unknown operator '${op}'`);
}

function compareVals(op: string, a: Val, b: Val): Val {
  if (op === '==' || op === '!=') {
    const eq = deepEq(a, b);
    return { t: 'bool', v: op === '==' ? eq : !eq };
  }
  const bothNum = (isIntLike(a) || a.t === 'float') && (isIntLike(b) || b.t === 'float');
  if (bothNum) {
    const x = numOf(a, op);
    const y = numOf(b, op);
    switch (op) {
      case '<': return { t: 'bool', v: x < y };
      case '<=': return { t: 'bool', v: x <= y };
      case '>': return { t: 'bool', v: x > y };
      case '>=': return { t: 'bool', v: x >= y };
    }
  }
  if (a.t === 'str' && b.t === 'str') {
    switch (op) {
      case '<': return { t: 'bool', v: a.v < b.v };
      case '<=': return { t: 'bool', v: a.v <= b.v };
      case '>': return { t: 'bool', v: a.v > b.v };
      case '>=': return { t: 'bool', v: a.v >= b.v };
    }
  }
  throw new PyError(`cannot compare ${typeName(a)} and ${typeName(b)} with '${op}'`);
}

/* ============================ tokenizer ============================ */

interface Tok {
  k: 'num' | 'str' | 'name' | 'kw' | 'op';
  s: string;
  num?: number;
  isFloat?: boolean;
}

const KW = new Set(['if', 'elif', 'else', 'while', 'for', 'in', 'break', 'continue', 'pass', 'and', 'or', 'not', 'True', 'False', 'None']);
const OPS2 = ['**', '//', '==', '!=', '<=', '>=', '+=', '-=', '*='];
const OPS1 = '+-*/%<>=()[],.:'.split('');

function tokenizeLine(text: string, line: number): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === ' ') {
      i++;
      continue;
    }
    if (c === '#') break;
    if (c === "'" || c === '"') {
      if (i > 0 && /[A-Za-z_]/.test(text[i - 1])) {
        throw new PyError(text[i - 1].toLowerCase() === 'f' ? `line ${line}: f-strings are not supported in this tracer` : `line ${line}: missing operator before the string`);
      }
      const end = text.indexOf(c, i + 1);
      if (end === -1) throw new PyError(`line ${line}: string is not closed`);
      toks.push({ k: 'str', s: text.slice(i + 1, end) });
      i = end + 1;
      continue;
    }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(text[i + 1] ?? ''))) {
      let j = i;
      let seenDot = false;
      while (j < text.length && (/[0-9]/.test(text[j]) || (text[j] === '.' && !seenDot))) {
        if (text[j] === '.') seenDot = true;
        j++;
      }
      const s = text.slice(i, j);
      toks.push({ k: 'num', s, num: parseFloat(s), isFloat: seenDot });
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < text.length && /[A-Za-z0-9_]/.test(text[j])) j++;
      const s = text.slice(i, j);
      toks.push({ k: KW.has(s) ? 'kw' : 'name', s });
      i = j;
      continue;
    }
    const two = OPS2.find((op) => text.startsWith(op, i));
    if (two) {
      toks.push({ k: 'op', s: two });
      i += two.length;
      continue;
    }
    if (OPS1.includes(c)) {
      toks.push({ k: 'op', s: c });
      i++;
      continue;
    }
    throw new PyError(`line ${line}: unexpected character '${c}'`);
  }
  return toks;
}

/* ============================ expression AST + parser ============================ */

type Expr =
  | { k: 'lit'; val: Val }
  | { k: 'name'; name: string }
  | { k: 'list'; items: Expr[] }
  | { k: 'un'; e: Expr }
  | { k: 'not'; e: Expr }
  | { k: 'bin'; op: string; l: Expr; r: Expr }
  | { k: 'cmp'; op: string; l: Expr; r: Expr }
  | { k: 'and'; l: Expr; r: Expr }
  | { k: 'or'; l: Expr; r: Expr }
  | { k: 'call'; name: string; args: Expr[] }
  | { k: 'index'; obj: Expr; i: Expr }
  | { k: 'method'; obj: Expr; name: string; args: Expr[] };

class ExprParser {
  private toks: Tok[];
  private pos = 0;
  private line: number;
  private static CMP = new Set(['==', '!=', '<', '<=', '>', '>=']);

  constructor(toks: Tok[], line: number) {
    this.toks = toks;
    this.line = line;
  }

  private peek(): Tok | null {
    return this.pos < this.toks.length ? this.toks[this.pos] : null;
  }

  /** Advance one token. Public: the statement parser drives it externally. */
  next(): Tok {
    const t = this.peek();
    if (!t) throw new PyError(`line ${this.line}: unexpected end of line`);
    this.pos++;
    return t;
  }

  private fail(msg: string): never {
    throw new PyError(`line ${this.line}: ${msg}`);
  }

  expectOp(s: string): void {
    const t = this.next();
    if (t.k !== 'op' || t.s !== s) this.fail(`expected '${s}'`);
  }

  expectEnd(): void {
    if (this.pos < this.toks.length) this.fail(`unexpected '${this.toks[this.pos].s}' after the statement`);
  }

  parseExpr(): Expr {
    return this.parseOr();
  }

  private parseOr(): Expr {
    let l = this.parseAnd();
    for (;;) {
      const t = this.peek();
      if (t && t.k === 'kw' && t.s === 'or') {
        this.next();
        l = { k: 'or', l, r: this.parseAnd() };
      } else return l;
    }
  }

  private parseAnd(): Expr {
    let l = this.parseNot();
    for (;;) {
      const t = this.peek();
      if (t && t.k === 'kw' && t.s === 'and') {
        this.next();
        l = { k: 'and', l, r: this.parseNot() };
      } else return l;
    }
  }

  private parseNot(): Expr {
    const t = this.peek();
    if (t && t.k === 'kw' && t.s === 'not') {
      this.next();
      return { k: 'not', e: this.parseNot() };
    }
    return this.parseCmp();
  }

  private parseCmp(): Expr {
    let l = this.parseArith();
    for (;;) {
      const t = this.peek();
      if (t && t.k === 'op' && ExprParser.CMP.has(t.s)) {
        this.next();
        l = { k: 'cmp', op: t.s, l, r: this.parseArith() };
      } else return l;
    }
  }

  private parseArith(): Expr {
    let l = this.parseTerm();
    for (;;) {
      const t = this.peek();
      if (t && t.k === 'op' && (t.s === '+' || t.s === '-')) {
        this.next();
        l = { k: 'bin', op: t.s, l, r: this.parseTerm() };
      } else return l;
    }
  }

  private parseTerm(): Expr {
    let l = this.parseUnary();
    for (;;) {
      const t = this.peek();
      if (t && t.k === 'op' && (t.s === '*' || t.s === '/' || t.s === '//' || t.s === '%')) {
        this.next();
        l = { k: 'bin', op: t.s, l, r: this.parseUnary() };
      } else return l;
    }
  }

  private parseUnary(): Expr {
    const t = this.peek();
    if (t && t.k === 'op' && t.s === '-') {
      this.next();
      return { k: 'un', e: this.parseUnary() };
    }
    return this.parsePower();
  }

  private parsePower(): Expr {
    const l = this.parsePostfix();
    const t = this.peek();
    if (t && t.k === 'op' && t.s === '**') {
      this.next();
      return { k: 'bin', op: '**', l, r: this.parseUnary() };
    }
    return l;
  }

  private parsePostfix(): Expr {
    let e = this.parseAtom();
    for (;;) {
      const t = this.peek();
      if (!t) return e;
      if (t.k === 'op' && t.s === '[') {
        this.next();
        const idx = this.parseExpr();
        this.expectOp(']');
        e = { k: 'index', obj: e, i: idx };
      } else if (t.k === 'op' && t.s === '.') {
        this.next();
        const nt = this.next();
        if (nt.k !== 'name') this.fail('expected a method name after the dot');
        this.expectOp('(');
        const args = this.parseArgs();
        e = { k: 'method', obj: e, name: nt.s, args };
      } else if (t.k === 'op' && t.s === '(') {
        if (e.k !== 'name') this.fail('only simple calls like print(x) are supported');
        this.next();
        const args = this.parseArgs();
        e = { k: 'call', name: e.name, args };
      } else return e;
    }
  }

  private parseArgs(): Expr[] {
    const args: Expr[] = [];
    const first = this.peek();
    if (first && first.k === 'op' && first.s === ')') {
      this.next();
      return args;
    }
    for (;;) {
      args.push(this.parseExpr());
      const t = this.next();
      if (t.k === 'op' && t.s === ')') return args;
      if (!(t.k === 'op' && t.s === ',')) this.fail(`expected ',' or ')' in the argument list`);
    }
  }

  private parseAtom(): Expr {
    const t = this.next();
    if (t.k === 'num') {
      return { k: 'lit', val: t.isFloat ? { t: 'float', v: t.num as number } : { t: 'int', v: t.num as number } };
    }
    if (t.k === 'str') return { k: 'lit', val: { t: 'str', v: t.s } };
    if (t.k === 'kw') {
      if (t.s === 'True') return { k: 'lit', val: { t: 'bool', v: true } };
      if (t.s === 'False') return { k: 'lit', val: { t: 'bool', v: false } };
      if (t.s === 'None') return { k: 'lit', val: { t: 'none' } };
      this.fail(`unexpected keyword '${t.s}'`);
    }
    if (t.k === 'name') return { k: 'name', name: t.s };
    if (t.k === 'op' && t.s === '[') {
      const items: Expr[] = [];
      const first = this.peek();
      if (first && first.k === 'op' && first.s === ']') {
        this.next();
        return { k: 'list', items };
      }
      for (;;) {
        items.push(this.parseExpr());
        const t2 = this.next();
        if (t2.k === 'op' && t2.s === ']') return { k: 'list', items };
        if (!(t2.k === 'op' && t2.s === ',')) this.fail(`expected ',' or ']' in the list`);
      }
    }
    if (t.k === 'op' && t.s === '(') {
      const e = this.parseExpr();
      this.expectOp(')');
      return e;
    }
    this.fail(`unexpected '${t.s}'`);
  }
}

/* ============================ statements ============================ */

type Stmt =
  | { k: 'assign'; line: number; text: string; name: string; op: '=' | '+=' | '-=' | '*='; e: Expr }
  | { k: 'expr'; line: number; text: string; e: Expr }
  | { k: 'if'; line: number; text: string; branches: { test: Expr; body: Stmt[]; line: number; text: string }[]; orelse: Stmt[] }
  | { k: 'while'; line: number; text: string; test: Expr; body: Stmt[] }
  | { k: 'for'; line: number; text: string; varName: string; iter: Expr; body: Stmt[] }
  | { k: 'break'; line: number; text: string }
  | { k: 'continue'; line: number; text: string }
  | { k: 'pass'; line: number; text: string };

interface SrcLine {
  indent: number;
  text: string;
  lineno: number;
}

function preprocess(src: string): SrcLine[] {
  const lines: SrcLine[] = [];
  src.replace(/\r/g, '').split('\n').forEach((raw, idx) => {
    // strip comments outside strings
    let cut = raw.length;
    let quote: string | null = null;
    for (let i = 0; i < raw.length; i++) {
      const c = raw[i];
      if (quote) {
        if (c === quote) quote = null;
      } else if (c === "'" || c === '"') {
        quote = c;
      } else if (c === '#') {
        cut = i;
        break;
      }
    }
    const body = raw.slice(0, cut);
    const indentPart = body.match(/^[ \t]*/);
    const indentStr = indentPart ? indentPart[0] : '';
    if (indentStr.includes('\t') && indentStr.includes(' ')) {
      throw new PyError(`line ${idx + 1}: mixed tabs and spaces in the indentation`);
    }
    const indent = indentStr.includes('\t') ? indentStr.length * 4 : indentStr.length;
    const text = body.slice(indentStr.length).trim();
    if (text.length === 0) return;
    lines.push({ indent, text, lineno: idx + 1 });
  });
  return lines;
}

function checkNoBlock(lines: SrcLine[], next: number, indent: number, line: number): void {
  if (next < lines.length && lines[next].indent > indent) {
    throw new PyError(`line ${line}: an indented block cannot follow this simple statement`);
  }
}

function parseBlock(lines: SrcLine[], start: number, parentIndent: number): { stmts: Stmt[]; next: number } {
  if (start >= lines.length || lines[start].indent <= parentIndent) {
    throw new PyError(`line ${start < lines.length ? lines[start].lineno : lines.length}: expected an indented block after the ':'`);
  }
  const blockIndent = lines[start].indent;
  const stmts: Stmt[] = [];
  let i = start;
  while (i < lines.length && lines[i].indent === blockIndent) {
    const r = parseStmt(lines, i, blockIndent);
    stmts.push(r.stmt);
    i = r.next;
  }
  if (i < lines.length && lines[i].indent > blockIndent) {
    throw new PyError(`line ${lines[i].lineno}: unexpected indent`);
  }
  return { stmts, next: i };
}

function parseStmt(lines: SrcLine[], i: number, indent: number): { stmt: Stmt; next: number } {
  const ln = lines[i];
  if (ln.indent !== indent) throw new PyError(`line ${ln.lineno}: unexpected indent`);
  const toks = tokenizeLine(ln.text, ln.lineno);
  if (toks.length === 0) throw new PyError(`line ${ln.lineno}: empty statement`);
  const first = toks[0];
  if (first.k === 'kw') {
    if (first.s === 'if' || first.s === 'elif') {
      const p = new ExprParser(toks, ln.lineno);
      p.next();
      const test = p.parseExpr();
      p.expectOp(':');
      p.expectEnd();
      const blk = parseBlock(lines, i + 1, indent);
      const branches = [{ test, body: blk.stmts, line: ln.lineno, text: ln.text }];
      let next = blk.next;
      while (next < lines.length && lines[next].indent === indent) {
        const t2 = tokenizeLine(lines[next].text, lines[next].lineno);
        if (t2.length > 0 && t2[0].k === 'kw' && t2[0].s === 'elif') {
          const p2 = new ExprParser(t2, lines[next].lineno);
          p2.next();
          const t = p2.parseExpr();
          p2.expectOp(':');
          p2.expectEnd();
          const b = parseBlock(lines, next + 1, indent);
          branches.push({ test: t, body: b.stmts, line: lines[next].lineno, text: lines[next].text });
          next = b.next;
        } else if (t2.length > 0 && t2[0].k === 'kw' && t2[0].s === 'else') {
          const p2 = new ExprParser(t2, lines[next].lineno);
          p2.next();
          p2.expectOp(':');
          p2.expectEnd();
          const b = parseBlock(lines, next + 1, indent);
          return { stmt: { k: 'if', line: ln.lineno, text: ln.text, branches, orelse: b.stmts }, next: b.next };
        } else break;
      }
      return { stmt: { k: 'if', line: ln.lineno, text: ln.text, branches, orelse: [] }, next };
    }
    if (first.s === 'else') {
      throw new PyError(`line ${ln.lineno}: 'else' without a matching 'if'`);
    }
    if (first.s === 'while') {
      const p = new ExprParser(toks, ln.lineno);
      p.next();
      const test = p.parseExpr();
      p.expectOp(':');
      p.expectEnd();
      const blk = parseBlock(lines, i + 1, indent);
      return { stmt: { k: 'while', line: ln.lineno, text: ln.text, test, body: blk.stmts }, next: blk.next };
    }
    if (first.s === 'for') {
      const p = new ExprParser(toks, ln.lineno);
      p.next();
      const nameTok = p.next();
      if (nameTok.k !== 'name') throw new PyError(`line ${ln.lineno}: expected a loop variable name after 'for'`);
      const inTok = p.next();
      if (!(inTok.k === 'kw' && inTok.s === 'in')) throw new PyError(`line ${ln.lineno}: expected 'in' in the for loop header`);
      const iter = p.parseExpr();
      p.expectOp(':');
      p.expectEnd();
      const blk = parseBlock(lines, i + 1, indent);
      return { stmt: { k: 'for', line: ln.lineno, text: ln.text, varName: nameTok.s, iter, body: blk.stmts }, next: blk.next };
    }
    if (first.s === 'break' || first.s === 'continue' || first.s === 'pass') {
      const p = new ExprParser(toks, ln.lineno);
      p.next();
      p.expectEnd();
      checkNoBlock(lines, i + 1, indent, ln.lineno);
      return { stmt: { k: first.s, line: ln.lineno, text: ln.text }, next: i + 1 };
    }
    // True/False/None/and/or/not at statement start fall through to expression
  }
  const p = new ExprParser(toks, ln.lineno);
  let stmt: Stmt;
  if (
    toks.length >= 2 &&
    toks[0].k === 'name' &&
    toks[1].k === 'op' &&
    (toks[1].s === '=' || toks[1].s === '+=' || toks[1].s === '-=' || toks[1].s === '*=')
  ) {
    const op = toks[1].s as '=' | '+=' | '-=' | '*=';
    p.next();
    p.next();
    const e = p.parseExpr();
    p.expectEnd();
    stmt = { k: 'assign', line: ln.lineno, text: ln.text, name: toks[0].s, op, e };
  } else {
    const e = p.parseExpr();
    p.expectEnd();
    stmt = { k: 'expr', line: ln.lineno, text: ln.text, e };
  }
  checkNoBlock(lines, i + 1, indent, ln.lineno);
  return { stmt, next: i + 1 };
}

function parseProgram(lines: SrcLine[]): Stmt[] {
  const stmts: Stmt[] = [];
  let i = 0;
  while (i < lines.length) {
    if (lines[i].indent !== 0) throw new PyError(`line ${lines[i].lineno}: unexpected indent`);
    const r = parseStmt(lines, i, 0);
    stmts.push(r.stmt);
    i = r.next;
  }
  return stmts;
}

/* ============================ interpreter ============================ */

interface SnapshotVar {
  name: string;
  type: string;
  value: string;
}

interface TraceStep {
  line: number;
  desc: string;
  vars: SnapshotVar[];
  output: string;
}

interface TraceResult {
  steps: TraceStep[];
  error: string | null;
  truncated: boolean;
  finalOutput: string;
  sourceLines: string[];
}

function runProgram(src: string): TraceResult {
  const sourceLines = src.replace(/\r/g, '').split('\n');
  const out: string[] = [];
  const steps: TraceStep[] = [];
  const vars = new Map<string, Val>();
  let curLine = 0;

  function snapshot(): SnapshotVar[] {
    const arr: SnapshotVar[] = [];
    for (const [name, v] of vars) arr.push({ name, type: typeName(v), value: fmtVal(v) });
    return arr;
  }

  function emit(line: number, desc: string): void {
    if (steps.length >= MAX_STEPS) throw CAP_SIG;
    steps.push({ line, desc, vars: snapshot(), output: out.join('\n') });
  }

  function evalExpr(e: Expr): Val {
    switch (e.k) {
      case 'lit':
        return e.val;
      case 'name': {
        const v = vars.get(e.name);
        if (!v) throw new PyError(`line ${curLine}: name '${e.name}' is not defined`);
        return v;
      }
      case 'list':
        return { t: 'list', v: e.items.map((it) => evalExpr(it)) };
      case 'un': {
        const v = evalExpr(e.e);
        const n = numOf(v, '-');
        return mkNum(-n, v.t === 'int' || v.t === 'bool');
      }
      case 'not':
        return { t: 'bool', v: !truthy(evalExpr(e.e)) };
      case 'bin':
        return binOp(e.op, evalExpr(e.l), evalExpr(e.r));
      case 'cmp':
        return compareVals(e.op, evalExpr(e.l), evalExpr(e.r));
      case 'and': {
        const l = evalExpr(e.l);
        return truthy(l) ? evalExpr(e.r) : l;
      }
      case 'or': {
        const l = evalExpr(e.l);
        return truthy(l) ? l : evalExpr(e.r);
      }
      case 'call':
        return callBuiltin(e.name, e.args.map((a) => evalExpr(a)));
      case 'index': {
        const obj = evalExpr(e.obj);
        const idx = evalExpr(e.i);
        if (!isIntLike(idx)) throw new PyError(`line ${curLine}: list and string indices must be integers`);
        if (obj.t === 'list') {
          let i = valToInt(idx);
          if (i < 0) i += obj.v.length;
          if (i < 0 || i >= obj.v.length) throw new PyError(`line ${curLine}: list index out of range`);
          return obj.v[i];
        }
        if (obj.t === 'str') {
          let i = valToInt(idx);
          if (i < 0) i += obj.v.length;
          if (i < 0 || i >= obj.v.length) throw new PyError(`line ${curLine}: string index out of range`);
          return { t: 'str', v: obj.v[i] };
        }
        throw new PyError(`line ${curLine}: only lists and strings can be indexed`);
      }
      case 'method': {
        const obj = evalExpr(e.obj);
        if (e.name !== 'append') throw new PyError(`line ${curLine}: only the list method append(x) is supported`);
        if (obj.t !== 'list') throw new PyError(`line ${curLine}: append(x) works on lists only`);
        if (e.args.length !== 1) throw new PyError(`line ${curLine}: append(x) takes exactly one argument`);
        obj.v.push(evalExpr(e.args[0]));
        return { t: 'none' };
      }
    }
  }

  function callBuiltin(name: string, args: Val[]): Val {
    if (name === 'print') {
      out.push(args.map((a) => fmtVal(a)).join(' '));
      return { t: 'none' };
    }
    if (name === 'len') {
      if (args.length !== 1) throw new PyError(`line ${curLine}: len() takes exactly one argument`);
      const v = args[0];
      if (v.t === 'str' || v.t === 'list') return { t: 'int', v: v.v.length };
      throw new PyError(`line ${curLine}: len() works on strings and lists only`);
    }
    if (name === 'str') {
      if (args.length !== 1) throw new PyError(`line ${curLine}: str() takes exactly one argument`);
      return { t: 'str', v: fmtVal(args[0]) };
    }
    if (name === 'int') {
      if (args.length !== 1) throw new PyError(`line ${curLine}: int() takes exactly one argument`);
      const v = args[0];
      if (v.t === 'int') return v;
      if (v.t === 'float') return { t: 'int', v: Math.trunc(v.v) };
      if (v.t === 'bool') return { t: 'int', v: v.v ? 1 : 0 };
      if (v.t === 'str' && /^[+-]?\d+$/.test(v.v.trim())) return { t: 'int', v: parseInt(v.v.trim(), 10) };
      throw new PyError(`line ${curLine}: invalid value for int()`);
    }
    if (name === 'float') {
      if (args.length !== 1) throw new PyError(`line ${curLine}: float() takes exactly one argument`);
      const v = args[0];
      if (v.t === 'int' || v.t === 'float') return { t: 'float', v: v.v };
      if (v.t === 'bool') return { t: 'float', v: v.v ? 1 : 0 };
      if (v.t === 'str' && /^[+-]?(\d+\.?\d*|\.\d+)$/.test(v.v.trim())) return { t: 'float', v: parseFloat(v.v.trim()) };
      throw new PyError(`line ${curLine}: invalid value for float()`);
    }
    if (name === 'range') {
      throw new PyError(`line ${curLine}: range() is only supported directly in a for loop header`);
    }
    throw new PyError(`line ${curLine}: only print, len, str, int and float calls are supported (no functions)`);
  }

  function evalIterable(iter: Expr, line: number): Val[] {
    if (iter.k === 'call' && iter.name === 'range') {
      const args = iter.args.map((a) => evalExpr(a));
      if (args.length < 1 || args.length > 3) throw new PyError(`line ${line}: range() takes 1 to 3 arguments`);
      if (!args.every((a) => isIntLike(a))) throw new PyError(`line ${line}: range() arguments must be integers`);
      let start = 0;
      let stop = 0;
      let step = 1;
      if (args.length === 1) stop = numOf(args[0], 'range');
      if (args.length === 2) {
        start = numOf(args[0], 'range');
        stop = numOf(args[1], 'range');
      }
      if (args.length === 3) {
        start = numOf(args[0], 'range');
        stop = numOf(args[1], 'range');
        step = numOf(args[2], 'range');
      }
      if (step === 0) throw new PyError(`line ${line}: range() step cannot be 0`);
      const count =
        step > 0
          ? Math.max(0, Math.ceil((stop - start) / step))
          : Math.max(0, Math.ceil((start - stop) / -step));
      if (count > MAX_RANGE) throw new PyError(`line ${line}: range() is too large for this tracer (limit ${MAX_RANGE})`);
      const items: Val[] = [];
      for (let i = 0; i < count; i++) items.push({ t: 'int', v: start + i * step });
      return items;
    }
    const v = evalExpr(iter);
    if (v.t === 'list') return v.v;
    if (v.t === 'str') return v.v.split('').map((ch) => ({ t: 'str' as const, v: ch }));
    throw new PyError(`line ${line}: for loops need a list, a string or range()`);
  }

  function execStmts(list: Stmt[]): void {
    for (const s of list) execStmt(s);
  }

  function execStmt(s: Stmt): void {
    curLine = s.line;
    switch (s.k) {
      case 'assign': {
        let val = evalExpr(s.e);
        if (s.op !== '=') {
          const cur = vars.get(s.name);
          if (!cur) throw new PyError(`line ${s.line}: name '${s.name}' is not defined`);
          val = binOp(s.op[0], cur, val);
        }
        vars.set(s.name, val);
        emit(s.line, s.text);
        break;
      }
      case 'expr': {
        evalExpr(s.e);
        emit(s.line, s.text);
        break;
      }
      case 'if': {
        let taken = false;
        for (const br of s.branches) {
          curLine = br.line;
          const c = evalExpr(br.test);
          emit(br.line, `${br.text.replace(/:\s*$/, '')} -> ${truthy(c) ? 'True' : 'False'}`);
          if (truthy(c)) {
            execStmts(br.body);
            taken = true;
            break;
          }
        }
        if (!taken) {
          if (s.orelse.length > 0) {
            emit(s.line, `${s.text.replace(/:\s*$/, '')} -> else branch`);
            execStmts(s.orelse);
          } else {
            emit(s.line, `${s.text.replace(/:\s*$/, '')} -> no branch taken`);
          }
        }
        break;
      }
      case 'while': {
        for (;;) {
          curLine = s.line;
          const c = evalExpr(s.test);
          emit(s.line, `${s.text.replace(/:\s*$/, '')} -> ${truthy(c) ? 'True' : 'False'}`);
          if (!truthy(c)) break;
          try {
            execStmts(s.body);
          } catch (sig) {
            if (sig === BREAK_SIG) break;
            if (sig !== CONT_SIG) throw sig;
          }
        }
        break;
      }
      case 'for': {
        const items = evalIterable(s.iter, s.line);
        for (const item of items) {
          curLine = s.line;
          vars.set(s.varName, item);
          emit(s.line, `${s.text.replace(/:\s*$/, '')} with ${s.varName} = ${fmtVal(item)}`);
          try {
            execStmts(s.body);
          } catch (sig) {
            if (sig === BREAK_SIG) break;
            if (sig !== CONT_SIG) throw sig;
          }
        }
        break;
      }
      case 'break':
        emit(s.line, s.text);
        throw BREAK_SIG;
      case 'continue':
        emit(s.line, s.text);
        throw CONT_SIG;
      case 'pass':
        emit(s.line, s.text);
        break;
    }
  }

  let error: string | null = null;
  let truncated = false;
  try {
    const prog = parseProgram(preprocess(src));
    execStmts(prog);
  } catch (sig) {
    if (sig === CAP_SIG) truncated = true;
    else if (sig === BREAK_SIG || sig === CONT_SIG) error = `'${sig === BREAK_SIG ? 'break' : 'continue'}' outside a loop`;
    else if (sig instanceof PyError) error = sig.message;
    else error = 'Unexpected error while tracing';
  }

  return {
    steps,
    error,
    truncated,
    finalOutput: out.join('\n'),
    sourceLines,
  };
}

/* ============================ curated programs ============================ */

interface Curated {
  id: string;
  name: string;
  code: string;
}

const PROGRAMS: Curated[] = [
  {
    id: 'p1',
    name: '1. Countdown (while)',
    code: `n = 5
while n > 0:
    print(n)
    n = n - 1
print("Liftoff!")`,
  },
  {
    id: 'p2',
    name: '2. Running total (for + range)',
    code: `total = 0
for i in range(1, 6):
    total += i
    print(i, total)
print("sum =", total)`,
  },
  {
    id: 'p3',
    name: '3. Pattern sorting (if/elif/else)',
    code: `for n in range(1, 11):
    if n % 3 == 0:
        print(n, "Fizz")
    elif n % 5 == 0:
        print(n, "Buzz")
    else:
        print(n)`,
  },
  {
    id: 'p4',
    name: '4. Build a list of squares',
    code: `squares = []
for x in range(1, 6):
    squares.append(x * x)
print(squares)
print(len(squares), "squares")`,
  },
  {
    id: 'p5',
    name: '5. Reverse a string',
    code: `word = "python"
rev = ""
for ch in word:
    rev = ch + rev
print(rev)`,
  },
  {
    id: 'p6',
    name: '6. Find a value (while + break)',
    code: `nums = [4, 8, 15, 16, 23, 42]
target = 15
pos = -1
i = 0
while i < len(nums):
    if nums[i] == target:
        pos = i
        print("found", target, "at index", i)
        break
    i += 1
if pos == -1:
    print("not found")
else:
    print("search finished")`,
  },
];

/* ============================ component ============================ */

interface ReportRow {
  program: string;
  predicted: string;
  actual: string;
  verdict: string;
}

export function PythonTracerLab(props: GameProps) {
  const { won, onWin, onBack } = props;
  const [selectedId, setSelectedId] = useState(PROGRAMS[0].id);
  const [code, setCode] = useState(PROGRAMS[0].code);
  const [prediction, setPrediction] = useState('');
  const [committed, setCommitted] = useState(false);
  const [trace, setTrace] = useState<TraceResult | null>(null);
  const [stepIdx, setStepIdx] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [traceToken, setTraceToken] = useState(0);
  const [gradedToken, setGradedToken] = useState(-1);
  const [verdict, setVerdict] = useState('');
  const [verdictOk, setVerdictOk] = useState<boolean | null>(null);
  const [predictedIds, setPredictedIds] = useState<string[]>([]);
  const [report, setReport] = useState<ReportRow[]>([]);

  /* --- derived (above all effects) --- */
  const curProgram = useMemo(() => PROGRAMS.find((p) => p.id === selectedId) ?? null, [selectedId]);
  const isCustom = curProgram === null;
  const hasSteps = trace !== null && trace.steps.length > 0;
  const finished = hasSteps && stepIdx >= trace.steps.length - 1;
  const step = trace !== null && stepIdx >= 0 && stepIdx < trace.steps.length ? trace.steps[stepIdx] : null;
  const displayLines = trace !== null ? trace.sourceLines : code.replace(/\r/g, '').split('\n');

  function clearRuntime() {
    setTrace(null);
    setStepIdx(-1);
    setPlaying(false);
    setCommitted(false);
    setPrediction('');
    setVerdict('');
    setVerdictOk(null);
  }

  function selectProgram(id: string) {
    setSelectedId(id);
    const prog = PROGRAMS.find((p) => p.id === id);
    if (prog) setCode(prog.code);
    clearRuntime();
  }

  function commitPrediction() {
    if (prediction.trim().length === 0) {
      setVerdict('Type the final output you expect, then commit.');
      setVerdictOk(false);
      return;
    }
    setCommitted(true);
    setVerdict('Prediction locked. Step through the program to check it.');
    setVerdictOk(null);
  }

  function ensureTrace(): TraceResult | null {
    if (trace) return trace;
    const t = runProgram(code);
    setTrace(t);
    setTraceToken((x) => x + 1);
    setStepIdx(-1);
    return t;
  }

  function doStep() {
    const t = ensureTrace();
    if (!t || t.error || t.steps.length === 0) return;
    finishAt(t, stepIdx + 1);
  }

  function runToEnd() {
    const t = ensureTrace();
    if (!t || t.error || t.steps.length === 0) return;
    finishAt(t, t.steps.length - 1);
  }

  function togglePlay() {
    if (playing) {
      setPlaying(false);
      return;
    }
    const t = ensureTrace();
    if (!t || t.error || t.steps.length === 0) return;
    setPlaying(true);
  }

  function reset() {
    clearRuntime();
  }

  /**
   * Move the playhead to `target`, stopping auto-play and grading the locked
   * prediction when the run reaches its final step. Called from user handlers
   * and timer callbacks only — never synchronously inside an effect body.
   */
  function finishAt(t: TraceResult, target: number) {
    const last = t.steps.length - 1;
    const clamped = Math.min(Math.max(target, -1), last);
    setStepIdx(clamped);
    if (clamped >= last) {
      if (playing) setPlaying(false);
      gradePrediction(t);
    }
  }

  /** Grade the committed prediction against the finished trace (once per trace). */
  function gradePrediction(t: TraceResult) {
    if (t.error || t.steps.length === 0) return;
    if (!committed) return;
    if (gradedToken === traceToken) return;
    setGradedToken(traceToken);
    const predicted = prediction.trim();
    const ok = predicted === t.finalOutput.trim();
    const programName = curProgram ? curProgram.name : 'Custom program';
    setReport((rows) => [
      ...rows,
      {
        program: programName,
        predicted: predicted.length > 0 ? predicted.replace(/\n/g, ' | ') : '(blank)',
        actual: t.finalOutput.length > 0 ? t.finalOutput.replace(/\n/g, ' | ') : '(no output)',
        verdict: ok ? 'Matched' : 'Different',
      },
    ]);
    if (ok && curProgram && !predictedIds.includes(curProgram.id)) {
      const next = [...predictedIds, curProgram.id];
      setPredictedIds(next);
      if (next.length >= 3) onWin();
    }
    setVerdictOk(ok);
    setVerdict(
      ok
        ? 'Correct — the program printed exactly what you predicted.'
        : `Not quite. You predicted ${predicted.length > 0 ? predicted : '(nothing)'} but the program printed ${t.finalOutput.length > 0 ? t.finalOutput : '(nothing)'}.`
    );
  }

  /* Latest grading logic, readable from the auto-play timer callback. */
  const gradeRef = useRef(gradePrediction);
  useEffect(() => {
    gradeRef.current = gradePrediction;
  });

  /* --- auto-play timer (cleaned up on every change and unmount) --- */
  useEffect(() => {
    if (!playing || !trace || trace.error || trace.steps.length === 0) return;
    const last = trace.steps.length - 1;
    const id = window.setInterval(() => {
      if (stepIdx >= last) {
        // Reached the end: stop auto-play and grade from the timer callback
        // (async — never synchronously inside the effect body).
        setPlaying(false);
        gradeRef.current(trace);
        return;
      }
      setStepIdx(stepIdx + 1);
    }, 600);
    return () => window.clearInterval(id);
  }, [playing, trace, stepIdx]);

  const controlsDisabled = !committed || (trace !== null && trace.error !== null) || finished;

  return (
    <GameShell
      title="Python Tracer"
      blurb="Predict the output first, then step through the program line by line and watch the variables and output grow."
      modelNote="This tracer is a tiny Python-subset interpreter written for this lab (no eval, no external engine). Supported: int/float/str/bool/list literals, variables, = += -= *=, + - * / // % **, comparisons, and/or/not, if/elif/else, for-in over range/list/string, while, break/continue, print(a, b, ...), len(), str(), int(), float(), list.append(x) and indexing (negative too). Not supported: functions, f-strings, imports, dictionaries, chained comparisons like a < b < c. Runs are capped at 10,000 steps; possible infinite loops are stopped and reported honestly."
      xp={25}
      won={won}
      onBack={onBack}
    >
      <ChapterRef
        subject="Computer Science"
        chapter="Ch 5-6 — Getting Started with Python / Flow of Control"
        topic="Tracing loops and conditionals"
      />

      <div className="mt-4">
        <PredictFirst
          key="pt-predict"
          prompt="how many times does the body of for i in range(1, 10, 3) run?"
          options={[
            { label: '3 times', correct: true },
            { label: '4 times' },
            { label: '9 times' },
          ]}
          explain="range(1, 10, 3) yields 1, 4 and 7 — the next value 10 is not included, so the body runs 3 times."
          className="max-w-2xl"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* left: program + code + controls */}
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-background/50 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <FileCode2 className="size-4" aria-hidden="true" />
              Program:
              <select
                value={selectedId}
                onChange={(e) => selectProgram(e.target.value)}
                className="press min-h-[44px] rounded-xl border border-border bg-card px-2 text-sm"
                aria-label="Choose a program to trace"
              >
                {PROGRAMS.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
                <option value="custom">Custom program (edit below)</option>
              </select>
            </label>
          </div>

          {isCustom && (
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              <span>Your program (editing resets the trace and prediction):</span>
              <textarea
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  clearRuntime();
                }}
                rows={10}
                spellCheck={false}
                className="w-full rounded-xl border border-border bg-card p-3 font-mono text-sm"
                aria-label="Python subset program editor"
              />
            </label>
          )}

          <div>
            <p className="text-xs text-muted-foreground">
              {trace !== null && trace.error !== null
                ? 'The tracer could not run this program:'
                : 'Current line is highlighted:'}
            </p>
            <pre className="mt-1 max-h-72 overflow-y-auto rounded-xl border border-border bg-card p-3 font-mono text-sm leading-6">
              {displayLines.map((line, i) => {
                const no = i + 1;
                const active = step !== null && step.line === no;
                return (
                  <div
                    key={i}
                    className={cn(
                      'flex gap-3 rounded px-1',
                      active && 'bg-primary/15 font-semibold'
                    )}
                  >
                    <span className="w-8 shrink-0 select-none text-right text-muted-foreground tabular-nums">{no}</span>
                    <span className="whitespace-pre-wrap">{line.length > 0 ? line : ' '}</span>
                  </div>
                );
              })}
            </pre>
          </div>

          {trace !== null && trace.error !== null && (
            <p role="status" aria-live="polite" className="text-sm font-semibold text-amber-600">{trace.error}</p>
          )}
          {trace !== null && trace.error === null && trace.truncated && (
            <p role="status" aria-live="polite" className="text-sm font-semibold text-amber-600">
              Stopped honestly: the run passed 10,000 steps, so it was cut off (a possible infinite loop).
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={doStep}
              disabled={controlsDisabled}
              className="press inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-border bg-card px-3 text-sm font-medium hover:bg-accent/10 disabled:opacity-50"
            >
              <StepForward className="size-4" aria-hidden="true" /> Step
            </button>
            <button
              onClick={runToEnd}
              disabled={controlsDisabled}
              className="press inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-border bg-card px-3 text-sm font-medium hover:bg-accent/10 disabled:opacity-50"
            >
              <SkipForward className="size-4" aria-hidden="true" /> Run to end
            </button>
            <button
              onClick={togglePlay}
              disabled={!committed || (trace !== null && trace.error !== null) || finished}
              className="press inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-border bg-card px-3 text-sm font-medium hover:bg-accent/10 disabled:opacity-50"
            >
              {playing ? <Pause className="size-4" aria-hidden="true" /> : <Play className="size-4" aria-hidden="true" />}
              {playing ? 'Pause' : 'Auto-play (600 ms)'}
            </button>
            <button
              onClick={reset}
              className="press inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-border bg-card px-3 text-sm font-medium hover:bg-accent/10"
            >
              <RotateCcw className="size-4" aria-hidden="true" /> Reset
            </button>
            {hasSteps && !trace.error && (
              <span className="text-sm text-muted-foreground tabular-nums">
                step {Math.max(0, stepIdx + 1)} of {trace.steps.length}
              </span>
            )}
          </div>

          {!committed ? (
            <div className="rounded-2xl border border-primary/30 bg-primary/5 p-3">
              <p className="text-sm font-semibold">Predict first: what will this program print, exactly?</p>
              <label className="mt-2 flex flex-col gap-1.5 text-sm font-medium">
                <span>Predicted final output (one line per print):</span>
                <textarea
                  value={prediction}
                  onChange={(e) => setPrediction(e.target.value)}
                  rows={3}
                  spellCheck={false}
                  className="w-full rounded-xl border border-border bg-card p-2 font-mono text-sm"
                  aria-label="Your predicted final output"
                />
              </label>
              <button
                onClick={commitPrediction}
                className="press mt-2 inline-flex min-h-[44px] items-center rounded-xl border border-border bg-card px-3 text-sm font-medium hover:bg-accent/10"
              >
                Commit prediction
              </button>
              <p className="mt-2 text-xs text-muted-foreground">
                The prediction stays locked until the trace finishes. Curated programs that you predict correctly count
                toward the win (3 needed). Write each printed line on its own row.
              </p>
            </div>
          ) : (
            <p role="status" aria-live="polite" className={cn('text-sm font-semibold', verdictOk === true && 'text-emerald-600', verdictOk === false && 'text-amber-600', verdictOk === null && 'text-muted-foreground')}>
              {verdict}
            </p>
          )}
        </div>

        {/* right: variables + output + report */}
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-border bg-background/50 p-4">
            <h3 className="flex items-center gap-2 text-sm font-bold">
              <Variable className="size-4" aria-hidden="true" /> Variables
            </h3>
            {step === null ? (
              <p className="mt-2 text-sm text-muted-foreground">Commit a prediction and press Step to begin.</p>
            ) : step.vars.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">No variables yet.</p>
            ) : (
              <div className="mt-2 max-h-52 overflow-y-auto">
                <table className="w-full text-sm">
                  <caption className="sr-only">Variables at the current step</caption>
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th scope="col" className="px-2 py-1.5 font-semibold">Name</th>
                      <th scope="col" className="px-2 py-1.5 font-semibold">Type</th>
                      <th scope="col" className="px-2 py-1.5 font-semibold">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {step.vars.map((v) => (
                      <tr key={v.name} className="border-b border-border/60 last:border-0">
                        <td className="px-2 py-1.5 font-mono">{v.name}</td>
                        <td className="px-2 py-1.5 text-muted-foreground">{v.type}</td>
                        <td className="px-2 py-1.5 font-mono break-all">{v.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {step !== null && (
              <p className="mt-2 text-xs text-muted-foreground">
                Step description: <span className="font-mono">{step.desc}</span>
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-background/50 p-4">
            <h3 className="flex items-center gap-2 text-sm font-bold">
              <Terminal className="size-4" aria-hidden="true" /> Output
            </h3>
            <pre className="mt-2 max-h-52 overflow-y-auto whitespace-pre-wrap rounded-xl border border-border bg-card p-3 font-mono text-sm">
              {step !== null && step.output.length > 0 ? step.output : '(nothing printed yet)'}
            </pre>
            {trace !== null && trace.error === null && finished && (
              <p className="mt-2 text-xs text-muted-foreground">
                Final output shown above — compare it with your prediction.
              </p>
            )}
          </div>

          <LabReport
            title="Prediction report"
            columns={['Program', 'My prediction', 'Actual output', 'Verdict']}
            rows={report.map((r) => [r.program, r.predicted, r.actual, r.verdict])}
            note="Win condition: predict the exact final output of 3 curated programs."
          />

          <div className="rounded-2xl border border-border bg-background/50 p-4 text-xs text-muted-foreground">
            <p className="font-semibold text-foreground">Supported subset reminder</p>
            <p className="mt-1">
              int/float/str/bool/list literals; variables; = += -= *=; + - * / // % **; comparisons; and/or/not;
              if/elif/else; for over range/list/string; while; break/continue; print(a, b, ...); len(); str(); int();
              float(); list.append(x); indexing with negative indices. Indent blocks with 4 spaces (or tabs, consistently).
            </p>
            <p className="mt-1">No functions, f-strings, imports or dictionaries — the tracer says so if you try.</p>
          </div>
        </div>
      </div>
    </GameShell>
  );
}
