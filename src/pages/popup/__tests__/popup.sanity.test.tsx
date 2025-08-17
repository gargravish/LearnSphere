/**
 * @jest-environment jsdom
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import Popup from '../Popup';

describe('Popup sanity', () => {
  test('Popup renders without crashing', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    expect(() => {
      act(() => {
        root.render(<Popup />);
      });
    }).not.toThrow();
  });
});


