/**
 * @fileoverview Test Environment Setup
 *
 * This module configures the testing environment for the Linux Tutorial CMS
 * using Vitest and React Testing Library. It provides global test utilities,
 * mocks, and cleanup procedures for consistent and reliable test execution.
 *
 * Features:
 * - React Testing Library integration with Jest DOM matchers
 * - Global test cleanup after each test
 * - Mock implementations for browser APIs
 * - localStorage simulation for testing
 * - MatchMedia polyfill for responsive design testing
 *
 * Testing Tools:
 * - Vitest: Fast unit testing framework
 * - React Testing Library: Component testing utilities
 * - Jest DOM: Additional DOM matchers
 * - vi (Vitest mock functions): Mock implementations
 *
 * Browser API Mocks:
 * - localStorage: Simulates browser storage
 * - matchMedia: Enables CSS media query testing
 * - window object mocks for SSR compatibility
 *
 * Performance:
 * - Efficient cleanup to prevent test interference
 * - Reusable mock implementations
 * - Minimal overhead for test setup
 *
 * @version 1.0.0
 * @since 2024
 * @author LinuxTutorialCMS Team
 * @see {@link https://vitest.dev/} Vitest documentation
 * @see {@link https://testing-library.com/docs/react-testing-library/intro} React Testing Library
 */

import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

/**
 * Global test cleanup function.
 * Automatically runs after each test to ensure test isolation
 * and prevent memory leaks or state pollution between tests.
 *
 * @function afterEach
 * @description Cleans up React Testing Library DOM after each test
 * @see {@link https://testing-library.com/docs/react-testing-library/api#cleanup} Cleanup documentation
 */
afterEach(() => {
  cleanup();
});

/**
 * Mock implementation of window.matchMedia API.
 * Enables testing of responsive design components and media queries.
 * Provides default implementation that returns non-matching media queries.
 *
 * @description Object.defineProperty window.matchMedia
 * @property {Function} value - Mock function that returns media query list object
 * @property {boolean} writable - Allows property to be overwritten in tests
 *
 * @example
 * // In your tests, you can customize the mock:
 * test('responsive behavior', () => {
 *   window.matchMedia = vi.fn().mockImplementation(query => ({
 *     matches: query === '(max-width: 768px)',
 *     media: query,
 *     onchange: null,
 *     addListener: vi.fn(),
 *     removeListener: vi.fn(),
 *     addEventListener: vi.fn(),
 *     removeEventListener: vi.fn(),
 *     dispatchEvent: vi.fn(),
 *   }));
 *
 *   render(<ResponsiveComponent />);
 *   // Test responsive behavior
 * });
 *
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/Window/matchMedia} MDN matchMedia documentation
 */
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

/**
 * Mock implementation of localStorage API.
 * Enables testing of storage functionality in a Node.js environment.
 * Provides in-memory storage that persists during test execution.
 *
 * @description globalThis.localStorage mock
 * @property {Object} globalThis.localStorage - Mock localStorage object
 *
 * Mock Methods:
 * - getItem: Retrieves stored value by key
 * - setItem: Stores value with specified key
 * - removeItem: Removes value by key
 * - clear: Removes all stored values
 *
 * @example
 * // Testing localStorage functionality
 * test('saves user preference', () => {
 *   const { savePreference } = require('./utils/storage');
 *
 *   savePreference('theme', 'dark');
 *   expect(localStorage.getItem('theme')).toBe('dark');
 *
 *   localStorage.clear(); // Clean up for next test
 * });
 *
 * @example
 * // Customizing localStorage behavior in tests
 * test('handles storage errors', () => {
 *   localStorage.setItem = vi.fn(() => {
 *     throw new Error('Storage quota exceeded');
 *   });
 *
 *   expect(() => saveLargeData()).toThrow('Storage quota exceeded');
 * });
 *
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage} MDN localStorage documentation
 */
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
globalThis.localStorage = localStorageMock;