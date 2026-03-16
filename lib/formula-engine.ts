// ============================================================
// Formula Engine — Safe expression evaluator for formula and
// rollup custom fields. NO eval() or Function() used.
// ============================================================

export interface FormulaConfig {
  expression: string;
  resultType: 'number' | 'text' | 'boolean' | 'date';
}

export interface RollupConfig {
  sourceRelation: 'subtasks' | 'child_tasks' | 'related_tasks';
  sourceField: string;
  aggregation: 'sum' | 'avg' | 'min' | 'max' | 'count' | 'percent_done';
  resultType: 'number' | 'percentage';
}

// ─── Tokenizer ──────────────────────────────────────────

type TokenType = 'number' | 'string' | 'field' | 'operator' | 'paren' | 'comma' | 'function';

interface Token {
  type: TokenType;
  value: string;
}

export function tokenize(expression: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < expression.length) {
    const ch = expression[i];

    // Whitespace
    if (/\s/.test(ch)) { i++; continue; }

    // Numbers (including decimals)
    if (/[0-9.]/.test(ch)) {
      let num = '';
      while (i < expression.length && /[0-9.]/.test(expression[i])) { num += expression[i]; i++; }
      tokens.push({ type: 'number', value: num });
      continue;
    }

    // Field references: {fieldName}
    if (ch === '{') {
      let field = '';
      i++; // skip {
      while (i < expression.length && expression[i] !== '}') { field += expression[i]; i++; }
      i++; // skip }
      tokens.push({ type: 'field', value: field });
      continue;
    }

    // String literals
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let str = '';
      i++; // skip opening quote
      while (i < expression.length && expression[i] !== quote) { str += expression[i]; i++; }
      i++; // skip closing quote
      tokens.push({ type: 'string', value: str });
      continue;
    }

    // Operators
    if ('+-*/%'.includes(ch)) {
      tokens.push({ type: 'operator', value: ch });
      i++;
      continue;
    }

    // Comparison operators
    if (ch === '>' || ch === '<' || ch === '=' || ch === '!') {
      let op = ch;
      if (i + 1 < expression.length && expression[i + 1] === '=') { op += '='; i++; }
      tokens.push({ type: 'operator', value: op });
      i++;
      continue;
    }

    // Parentheses
    if (ch === '(' || ch === ')') {
      tokens.push({ type: 'paren', value: ch });
      i++;
      continue;
    }

    // Comma
    if (ch === ',') {
      tokens.push({ type: 'comma', value: ',' });
      i++;
      continue;
    }

    // Function names / identifiers
    if (/[a-zA-Z_]/.test(ch)) {
      let name = '';
      while (i < expression.length && /[a-zA-Z0-9_]/.test(expression[i])) { name += expression[i]; i++; }
      // Check if followed by ( — then it's a function
      if (i < expression.length && expression[i] === '(') {
        tokens.push({ type: 'function', value: name.toUpperCase() });
      } else {
        // Treat as field reference without braces
        tokens.push({ type: 'field', value: name });
      }
      continue;
    }

    // Unknown character — skip
    i++;
  }

  return tokens;
}

// ─── Recursive Descent Parser & Evaluator ───────────────

type Value = number | string | boolean | null;

class FormulaEvaluator {
  private tokens: Token[];
  private pos = 0;
  private fields: Record<string, any>;

  constructor(tokens: Token[], fields: Record<string, any>) {
    this.tokens = tokens;
    this.fields = fields;
  }

  private peek(): Token | null {
    return this.pos < this.tokens.length ? this.tokens[this.pos] : null;
  }

  private consume(): Token {
    return this.tokens[this.pos++];
  }

  evaluate(): Value {
    if (this.tokens.length === 0) return null;
    const result = this.parseExpression();
    return result;
  }

  private parseExpression(): Value {
    let left = this.parseTerm();

    while (this.peek()?.type === 'operator' && (this.peek()!.value === '+' || this.peek()!.value === '-')) {
      const op = this.consume().value;
      const right = this.parseTerm();
      if (op === '+') {
        if (typeof left === 'string' || typeof right === 'string') {
          left = String(left ?? '') + String(right ?? '');
        } else {
          left = (Number(left) || 0) + (Number(right) || 0);
        }
      } else {
        left = (Number(left) || 0) - (Number(right) || 0);
      }
    }

    // Comparison operators
    if (this.peek()?.type === 'operator' && ['>', '<', '>=', '<=', '==', '!=', '='].includes(this.peek()!.value)) {
      const op = this.consume().value;
      const right = this.parseTerm();
      const l = Number(left) || 0;
      const r = Number(right) || 0;
      switch (op) {
        case '>': return l > r;
        case '<': return l < r;
        case '>=': return l >= r;
        case '<=': return l <= r;
        case '==': case '=': return left === right;
        case '!=': return left !== right;
      }
    }

    return left;
  }

  private parseTerm(): Value {
    let left = this.parseFactor();

    while (this.peek()?.type === 'operator' && ('*/%'.includes(this.peek()!.value))) {
      const op = this.consume().value;
      const right = this.parseFactor();
      const l = Number(left) || 0;
      const r = Number(right) || 0;
      if (op === '*') left = l * r;
      else if (op === '/') left = r !== 0 ? l / r : 0; // Safe division
      else if (op === '%') left = r !== 0 ? l % r : 0;
    }

    return left;
  }

  private parseFactor(): Value {
    const token = this.peek();
    if (!token) return null;

    // Unary minus
    if (token.type === 'operator' && token.value === '-') {
      this.consume();
      return -(Number(this.parseFactor()) || 0);
    }

    // Parenthesized expression
    if (token.type === 'paren' && token.value === '(') {
      this.consume(); // (
      const val = this.parseExpression();
      if (this.peek()?.value === ')') this.consume(); // )
      return val;
    }

    // Function call
    if (token.type === 'function') {
      return this.parseFunction();
    }

    // Number literal
    if (token.type === 'number') {
      this.consume();
      return parseFloat(token.value);
    }

    // String literal
    if (token.type === 'string') {
      this.consume();
      return token.value;
    }

    // Field reference
    if (token.type === 'field') {
      this.consume();
      const val = this.fields[token.value];
      if (val === undefined || val === null) return null;
      if (typeof val === 'number') return val;
      if (typeof val === 'boolean') return val;
      if (typeof val === 'string') {
        const num = parseFloat(val);
        return isNaN(num) ? val : num;
      }
      return val;
    }

    // Skip unknown tokens
    this.consume();
    return null;
  }

  private parseFunction(): Value {
    const name = this.consume().value; // function name
    this.consume(); // (
    const args: Value[] = [];
    while (this.peek() && this.peek()!.value !== ')') {
      args.push(this.parseExpression());
      if (this.peek()?.type === 'comma') this.consume();
    }
    if (this.peek()?.value === ')') this.consume(); // )

    return this.executeFunction(name, args);
  }

  private executeFunction(name: string, args: Value[]): Value {
    switch (name) {
      case 'IF':
        return args[0] ? args[1] ?? null : args[2] ?? null;
      case 'ABS':
        return Math.abs(Number(args[0]) || 0);
      case 'ROUND': {
        const val = Number(args[0]) || 0;
        const decimals = Number(args[1]) || 0;
        const factor = Math.pow(10, decimals);
        return Math.round(val * factor) / factor;
      }
      case 'FLOOR':
        return Math.floor(Number(args[0]) || 0);
      case 'CEIL':
        return Math.ceil(Number(args[0]) || 0);
      case 'MIN':
        return Math.min(...args.map(a => Number(a) || 0));
      case 'MAX':
        return Math.max(...args.map(a => Number(a) || 0));
      case 'CONCAT':
        return args.map(a => String(a ?? '')).join('');
      case 'LEN':
        return String(args[0] ?? '').length;
      case 'UPPER':
        return String(args[0] ?? '').toUpperCase();
      case 'LOWER':
        return String(args[0] ?? '').toLowerCase();
      case 'NOW':
        return Date.now();
      case 'DAYS_BETWEEN': {
        const d1 = Number(args[0]) || 0;
        const d2 = Number(args[1]) || 0;
        return Math.floor(Math.abs(d2 - d1) / (1000 * 60 * 60 * 24));
      }
      case 'COALESCE':
        return args.find(a => a !== null && a !== undefined && a !== '') ?? null;
      default:
        return null;
    }
  }
}

// ─── Public API ─────────────────────────────────────────

/**
 * Evaluate a formula expression against field values.
 * Safe — no eval() or Function() used.
 */
export function evaluateFormula(
  expression: string,
  fieldValues: Record<string, any>,
): Value {
  try {
    const tokens = tokenize(expression);
    const evaluator = new FormulaEvaluator(tokens, fieldValues);
    return evaluator.evaluate();
  } catch {
    return null;
  }
}

/**
 * Evaluate a rollup aggregation over child records.
 */
export function evaluateRollup(
  config: RollupConfig,
  children: Record<string, any>[],
): number | null {
  if (!children || children.length === 0) {
    return config.aggregation === 'count' ? 0 : null;
  }

  const values = children
    .map(c => c[config.sourceField])
    .filter(v => v !== undefined && v !== null)
    .map(Number)
    .filter(n => !isNaN(n));

  switch (config.aggregation) {
    case 'sum':
      return values.reduce((a, b) => a + b, 0);
    case 'avg':
      return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
    case 'min':
      return values.length > 0 ? Math.min(...values) : null;
    case 'max':
      return values.length > 0 ? Math.max(...values) : null;
    case 'count':
      return children.length;
    case 'percent_done': {
      const done = children.filter(c => c.status === 'done' || c.done === true).length;
      return Math.round((done / children.length) * 100);
    }
    default:
      return null;
  }
}
