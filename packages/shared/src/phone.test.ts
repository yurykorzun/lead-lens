import { describe, expect, it } from 'vitest';
import { formatPhone, phoneHref } from './phone.js';

describe('formatPhone', () => {
  it.each([
    ['(215) 884-2295', '(215) 884-2295'],
    ['+1 347-527-6853', '(347) 527-6853'],
    ['13312852745', '(331) 285-2745'],
    ['4159009908', '(415) 900-9908'],
    ['  4709339363 ', '(470) 933-9363'],
  ])('shows the US number %s as %s', (input, shown) => {
    expect(formatPhone(input)).toBe(shown);
  });

  it.each([
    ['994505267737'], // 12 digits, foreign without a +
    ['+49 30 123456'], // 10 digits, but a German number
    ['+44 20 7946 0958'],
    ['1215884229'], // area code 121 does not exist - a typo stays visible
    ['0158842295'],
    ['555-1234'],
    ['(732) 297-0600 ext 2'],
  ])('leaves %s as typed', input => {
    expect(formatPhone(input)).toBe(input);
  });

  it('is empty for nothing or only spaces', () => {
    expect(formatPhone(undefined)).toBe('');
    expect(formatPhone(null)).toBe('');
    expect(formatPhone('   ')).toBe('');
  });
});

describe('phoneHref', () => {
  it('dials a US number with +1', () => {
    expect(phoneHref('(415) 900-9908')).toBe('tel:+14159009908');
    expect(phoneHref('+1 347-527-6853')).toBe('tel:+13475276853');
  });

  it('keeps a foreign + and drops an extension', () => {
    expect(phoneHref('+44 20 7946 0958')).toBe('tel:+442079460958');
    expect(phoneHref('(732) 297-0600 ext 2')).toBe('tel:7322970600');
  });

  it('is empty when there is nothing to dial', () => {
    expect(phoneHref('   ')).toBe('');
    expect(phoneHref(undefined)).toBe('');
  });
});
