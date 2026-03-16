import { describe, it, expect } from 'vitest';
import { generatePdfHtml, exportDataAsPdf } from '../lib/pdf-export';

describe('PDF Export', () => {
  it('generates valid HTML with correct row count', () => {
    const html = generatePdfHtml({
      title: 'Test Report',
      headers: ['name', 'status', 'priority'],
      rows: [
        { name: 'Task 1', status: 'done', priority: 'high' },
        { name: 'Task 2', status: 'todo', priority: 'low' },
        { name: 'Task 3', status: 'in_progress', priority: 'medium' },
      ],
    });

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Test Report');
    expect(html).toContain('3 row(s)');
    expect(html).toContain('Task 1');
    expect(html).toContain('Task 2');
    expect(html).toContain('Task 3');
    // Headers
    expect(html).toContain('name');
    expect(html).toContain('status');
    expect(html).toContain('priority');
  });

  it('escapes HTML entities in values', () => {
    const html = generatePdfHtml({
      title: '<script>alert("xss")</script>',
      headers: ['text'],
      rows: [{ text: '<b>bold</b> & "quoted"' }],
    });

    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&lt;b&gt;bold&lt;/b&gt;');
    expect(html).toContain('&amp;');
    expect(html).toContain('&quot;quoted&quot;');
  });

  it('handles empty rows', () => {
    const html = generatePdfHtml({
      title: 'Empty',
      headers: ['col'],
      rows: [],
    });
    expect(html).toContain('0 row(s)');
    expect(html).toContain('<tbody>');
  });

  it('converts CSV data to PDF HTML', () => {
    const csv = 'id,title,status\n1,Buy milk,done\n2,Write code,in_progress';
    const html = exportDataAsPdf({
      csv,
      entity: 'tasks',
      generatedAt: '2026-03-15T00:00:00Z',
    });

    expect(html).toContain('tasks Export');
    expect(html).toContain('2 row(s)');
    expect(html).toContain('Buy milk');
    expect(html).toContain('Write code');
  });

  it('handles CSV with quoted fields', () => {
    const csv = 'name,desc\n"Smith, John","He said ""hello"""\nJane,Simple';
    const html = exportDataAsPdf({
      csv,
      entity: 'test',
      generatedAt: '2026-03-15T00:00:00Z',
    });

    expect(html).toContain('Smith, John');
    expect(html).toContain('He said &quot;hello&quot;');
    expect(html).toContain('Jane');
  });

  it('handles empty CSV gracefully', () => {
    const html = exportDataAsPdf({
      csv: '',
      entity: 'empty',
      generatedAt: '2026-03-15T00:00:00Z',
    });
    expect(html).toContain('0 row(s)');
  });
});
