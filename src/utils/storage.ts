import { AppState } from '../types';

const STORAGE_KEY = 'pos-app-state';

export function loadState(): AppState | null {
  try {
    const serialized = localStorage.getItem(STORAGE_KEY);
    if (!serialized) return null;
    return JSON.parse(serialized);
  } catch (error) {
    console.error('Failed to load state from localStorage:', error);
    return null;
  }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('Failed to save state to localStorage:', error);
  }
}

export function clearState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('pos-session');
  } catch (error) {
    console.error('Failed to clear state from localStorage:', error);
  }
}

export function saveSession(userId: string, shiftId: string | null): void {
  try {
    localStorage.setItem('pos-session', JSON.stringify({ userId, shiftId }));
  } catch (error) {
    console.error('Failed to save session:', error);
  }
}

export function loadSession(): { userId: string; shiftId: string | null } | null {
  try {
    const serialized = localStorage.getItem('pos-session');
    if (!serialized) return null;
    return JSON.parse(serialized);
  } catch (error) {
    return null;
  }
}
