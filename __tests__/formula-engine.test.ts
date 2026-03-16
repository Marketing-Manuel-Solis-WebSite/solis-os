import { describe, it, expect } from 'vitest';
import { evaluateFormula, evaluateRollup, tokenize } from '../lib/formula-engine';

describe('tokenize', () => {
  it('tokenizes simple arithmetic', () => {
    const tokens = tokenize('1 + 2');
    expect(tokens).toHaveLength(3);
    expect(tokens[0]).toEqual({ type: 'number', value: '1' });
    expect(tokens[1]).toEqual({ type: 'operator', value: '+' });
    expect(tokens[2]).toEqual({ type: 'number', value: '2' });
  });

  it('tokenizes field references', () => {
    const tokens = tokenize('{price} * {quantity}');
    expect(tokens).toHaveLength(3);
    expect(tokens[0]).toEqual({ type: 'field', value: 'price' });
    expect(tokens[2]).toEqual({ type: 'field', value: 'quantity' });
  });

  it('tokenizes function calls', () => {
    const tokens = tokenize('ROUND({x}, 2)');
    expect(tokens[0]).toEqual({ type: 'function', value: 'ROUND' });
    expect(tokens[1]).toEqual({ type: 'paren', value: '(' });
  });
});

describe('evaluateFormula', () => {
  it('evaluates simple addition', () => {
    expect(evaluateFormula('1 + 2', {})).toBe(3);
  });

  it('evaluates multiplication', () => {
    expect(evaluateFormula('3 * 4', {})).toBe(12);
  });

  it('evaluates field references', () => {
    expect(evaluateFormula('{price} * {qty}', { price: 10, qty: 5 })).toBe(50);
  });

  it('handles division by zero safely', () => {
    expect(evaluateFormula('10 / 0', {})).toBe(0);
  });

  it('handles missing fields as null', () => {
    expect(evaluateFormula('{missing}', {})).toBe(null);
  });

  it('evaluates ROUND function', () => {
    expect(evaluateFormula('ROUND(3.14159, 2)', {})).toBe(3.14);
  });

  it('evaluates ABS function', () => {
    expect(evaluateFormula('ABS(-42)', {})).toBe(42);
  });

  it('evaluates IF function', () => {
    expect(evaluateFormula('IF({status} == 1, 100, 0)', { status: 1 })).toBe(100);
    expect(evaluateFormula('IF({status} == 1, 100, 0)', { status: 0 })).toBe(0);
  });

  it('evaluates nested expressions', () => {
    expect(evaluateFormula('({a} + {b}) * 2', { a: 3, b: 4 })).toBe(14);
  });

  it('evaluates CONCAT function', () => {
    expect(evaluateFormula('CONCAT("Hello", " ", "World")', {})).toBe('Hello World');
  });

  it('handles string + number concatenation', () => {
    expect(evaluateFormula('"Total: " + {amount}', { amount: 42 })).toBe('Total: 42');
  });

  it('evaluates MIN and MAX', () => {
    expect(evaluateFormula('MIN(10, 5, 8)', {})).toBe(5);
    expect(evaluateFormula('MAX(10, 5, 8)', {})).toBe(10);
  });

  it('evaluates complex formula', () => {
    const result = evaluateFormula(
      'ROUND({price} * {qty} * (1 - {discount} / 100), 2)',
      { price: 99.99, qty: 3, discount: 15 }
    );
    expect(result).toBe(254.97);
  });

  it('returns null for empty expression', () => {
    expect(evaluateFormula('', {})).toBe(null);
  });
});

describe('evaluateRollup', () => {
  it('sums values', () => {
    const children = [{ hours: 5 }, { hours: 3 }, { hours: 7 }];
    expect(evaluateRollup({ sourceRelation: 'subtasks', sourceField: 'hours', aggregation: 'sum', resultType: 'number' }, children)).toBe(15);
  });

  it('averages values', () => {
    const children = [{ score: 80 }, { score: 90 }, { score: 100 }];
    expect(evaluateRollup({ sourceRelation: 'subtasks', sourceField: 'score', aggregation: 'avg', resultType: 'number' }, children)).toBe(90);
  });

  it('counts children', () => {
    const children = [{ a: 1 }, { a: 2 }, { a: 3 }];
    expect(evaluateRollup({ sourceRelation: 'subtasks', sourceField: 'a', aggregation: 'count', resultType: 'number' }, children)).toBe(3);
  });

  it('calculates percent done', () => {
    const children = [{ status: 'done' }, { status: 'done' }, { status: 'todo' }, { status: 'todo' }];
    expect(evaluateRollup({ sourceRelation: 'subtasks', sourceField: 'status', aggregation: 'percent_done', resultType: 'percentage' }, children)).toBe(50);
  });

  it('returns 0 count for empty children', () => {
    expect(evaluateRollup({ sourceRelation: 'subtasks', sourceField: 'x', aggregation: 'count', resultType: 'number' }, [])).toBe(0);
  });

  it('returns null for empty children on sum', () => {
    expect(evaluateRollup({ sourceRelation: 'subtasks', sourceField: 'x', aggregation: 'sum', resultType: 'number' }, [])).toBe(null);
  });
});
