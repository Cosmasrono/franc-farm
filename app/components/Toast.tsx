'use client';

import React from 'react';

interface ToastProps {
  message: string;
  type: 'success' | 'error';
}

export default function Toast({ message, type }: ToastProps) {
  return (
    <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 animate-slide-down">
      <div className={`px-6 py-4 rounded-lg shadow-lg ${
        type === 'success' 
          ? 'bg-green-100 text-green-800 border border-green-300' 
          : 'bg-red-100 text-red-800 border border-red-300'
      }`}>
        <p className="font-semibold">{message}</p>
      </div>
    </div>
  );
}