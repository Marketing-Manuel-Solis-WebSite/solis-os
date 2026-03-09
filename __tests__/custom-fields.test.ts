import { describe, it, expect, vi } from 'vitest';

// Mock Firebase modules before importing custom-fields
vi.mock('../lib/firebase', () => ({
  db: {},
  auth: {},
  storage: {},
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  serverTimestamp: vi.fn(),
}));

const {
  validateCustomFieldValues,
  getActiveFields,
  getFieldsByGroup,
  generateFieldId,
} = await import('../lib/custom-fields');

type CustomFieldDef = import('../lib/custom-fields').CustomFieldDef;

function makeDef(overrides: Partial<CustomFieldDef>): CustomFieldDef {
  return {
    id: 'field1',
    name: 'Test Field',
    nameEs: 'Campo de prueba',
    type: 'text',
    group: 'default',
    required: false,
    order: 0,
    archived: false,
    isLegacy: false,
    ...overrides,
  };
}

describe('validateCustomFieldValues', () => {
  it('returns empty errors for valid data', () => {
    const defs = [makeDef({ id: 'name', type: 'text' })];
    const errors = validateCustomFieldValues({ name: 'hello' }, defs);
    expect(Object.keys(errors)).toHaveLength(0);
  });

  it('returns error for required missing field', () => {
    const defs = [makeDef({ id: 'name', type: 'text', required: true })];
    const errors = validateCustomFieldValues({}, defs);
    expect(errors.name).toBeDefined();
  });

  it('validates number type', () => {
    const defs = [makeDef({ id: 'qty', type: 'number' })];
    const errors = validateCustomFieldValues({ qty: 'not_a_number' }, defs);
    expect(errors.qty).toBeDefined();
  });

  it('validates number min/max', () => {
    const defs = [makeDef({ id: 'qty', type: 'number', validation: { min: 1, max: 100 } })];
    expect(Object.keys(validateCustomFieldValues({ qty: 50 }, defs))).toHaveLength(0);
    expect(validateCustomFieldValues({ qty: 0 }, defs).qty).toBeDefined();
    expect(validateCustomFieldValues({ qty: 101 }, defs).qty).toBeDefined();
  });

  it('validates currency as numeric', () => {
    const defs = [makeDef({ id: 'price', type: 'currency' })];
    expect(Object.keys(validateCustomFieldValues({ price: 99.99 }, defs))).toHaveLength(0);
    expect(validateCustomFieldValues({ price: 'abc' }, defs).price).toBeDefined();
  });

  it('validates email format', () => {
    const defs = [makeDef({ id: 'email', type: 'email' })];
    expect(Object.keys(validateCustomFieldValues({ email: 'user@test.com' }, defs))).toHaveLength(0);
    expect(validateCustomFieldValues({ email: 'bad' }, defs).email).toBeDefined();
  });

  it('validates URL format', () => {
    const defs = [makeDef({ id: 'link', type: 'url' })];
    expect(Object.keys(validateCustomFieldValues({ link: 'https://example.com' }, defs))).toHaveLength(0);
    expect(validateCustomFieldValues({ link: 'not-a-url' }, defs).link).toBeDefined();
  });

  it('validates rating range', () => {
    const defs = [makeDef({ id: 'stars', type: 'rating' })];
    expect(Object.keys(validateCustomFieldValues({ stars: 3 }, defs))).toHaveLength(0);
    expect(validateCustomFieldValues({ stars: 6 }, defs).stars).toBeDefined();
    expect(validateCustomFieldValues({ stars: -1 }, defs).stars).toBeDefined();
  });

  it('validates single_select against options', () => {
    const defs = [makeDef({
      id: 'type', type: 'single_select',
      options: [{ id: 'a', label: 'A', color: '#000' }, { id: 'b', label: 'B', color: '#fff' }],
    })];
    expect(Object.keys(validateCustomFieldValues({ type: 'a' }, defs))).toHaveLength(0);
    expect(validateCustomFieldValues({ type: 'invalid' }, defs).type).toBeDefined();
  });

  it('validates multi_select against options', () => {
    const defs = [makeDef({
      id: 'tags', type: 'multi_select',
      options: [{ id: 'x', label: 'X', color: '#000' }],
    })];
    expect(Object.keys(validateCustomFieldValues({ tags: ['x'] }, defs))).toHaveLength(0);
    expect(validateCustomFieldValues({ tags: ['x', 'invalid'] }, defs).tags).toBeDefined();
  });

  it('validates boolean type', () => {
    const defs = [makeDef({ id: 'done', type: 'boolean' })];
    expect(Object.keys(validateCustomFieldValues({ done: true }, defs))).toHaveLength(0);
    expect(Object.keys(validateCustomFieldValues({ done: 'true' }, defs))).toHaveLength(0);
    expect(validateCustomFieldValues({ done: 'maybe' }, defs).done).toBeDefined();
  });

  it('ignores unknown fields', () => {
    const defs = [makeDef({ id: 'name', type: 'text' })];
    const errors = validateCustomFieldValues({ name: 'ok', unknown_field: 'value' }, defs);
    expect(Object.keys(errors)).toHaveLength(0);
  });

  it('ignores archived fields', () => {
    const defs = [makeDef({ id: 'old', type: 'text', required: true, archived: true })];
    const errors = validateCustomFieldValues({}, defs);
    expect(Object.keys(errors)).toHaveLength(0);
  });

  it('skips empty non-required values', () => {
    const defs = [makeDef({ id: 'opt', type: 'number' })];
    const errors = validateCustomFieldValues({ opt: '' }, defs);
    expect(Object.keys(errors)).toHaveLength(0);
  });
});

describe('getActiveFields', () => {
  it('filters out archived fields and sorts by order', () => {
    const defs = [
      makeDef({ id: 'b', order: 2, archived: false }),
      makeDef({ id: 'a', order: 1, archived: false }),
      makeDef({ id: 'c', order: 0, archived: true }),
    ];
    const active = getActiveFields(defs);
    expect(active).toHaveLength(2);
    expect(active[0].id).toBe('a');
    expect(active[1].id).toBe('b');
  });
});

describe('getFieldsByGroup', () => {
  it('groups active fields by group id', () => {
    const defs = [
      makeDef({ id: 'a', group: 'legal', order: 0 }),
      makeDef({ id: 'b', group: 'legal', order: 1 }),
      makeDef({ id: 'c', group: 'client', order: 0 }),
      makeDef({ id: 'd', group: 'client', order: 1, archived: true }),
    ];
    const grouped = getFieldsByGroup(defs);
    expect(grouped.legal).toHaveLength(2);
    expect(grouped.client).toHaveLength(1);
  });
});

describe('generateFieldId', () => {
  it('creates a slug from the name', () => {
    const id = generateFieldId('My Custom Field!');
    expect(id).toMatch(/^my_custom_field_[a-z0-9]+$/);
  });

  it('truncates long names', () => {
    const id = generateFieldId('A very long field name that exceeds the thirty character limit');
    const base = id.split('_').slice(0, -1).join('_');
    expect(base.length).toBeLessThanOrEqual(30);
  });
});
