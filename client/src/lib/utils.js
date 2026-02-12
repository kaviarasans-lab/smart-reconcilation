import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function formatDate(date) {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(date) {
  if (!date) return '-';
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatCurrency(amount) {
  if (amount === null || amount === undefined) return '-';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

export function formatNumber(num) {
  if (num === null || num === undefined) return '0';
  return new Intl.NumberFormat('en-US').format(num);
}

export const statusColors = {
  matched: 'bg-green-100 text-green-800',
  partially_matched: 'bg-yellow-100 text-yellow-800',
  not_matched: 'bg-red-100 text-red-800',
  duplicate: 'bg-orange-100 text-orange-800',
};

export const statusLabels = {
  matched: 'Matched',
  partially_matched: 'Partially Matched',
  not_matched: 'Not Matched',
  duplicate: 'Duplicate',
};

export const chartColors = {
  matched: '#10b981',
  partially_matched: '#f59e0b',
  not_matched: '#ef4444',
  duplicate: '#f97316',
};
