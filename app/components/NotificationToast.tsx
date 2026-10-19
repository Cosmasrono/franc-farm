import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Info } from 'lucide-react';

interface NotificationToastProps {
  message: string;
  type: 'success' | 'error' | 'info';
  duration?: number; // Duration in milliseconds, defaults to 4000 (4 seconds)
  onClose: () => void;
}

export default function NotificationToast({ message, type, duration = 4000, onClose }: NotificationToastProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  if (!isVisible) return null;

  let icon;
  let bgColor;
  let textColor;

  switch (type) {
    case 'success':
      icon = <CheckCircle className="w-6 h-6" />;
      bgColor = 'bg-green-500';
      textColor = 'text-white';
      break;
    case 'error':
      icon = <XCircle className="w-6 h-6" />;
      bgColor = 'bg-red-500';
      textColor = 'text-white';
      break;
    case 'info':
      icon = <Info className="w-6 h-6" />;
      bgColor = 'bg-blue-500';
      textColor = 'text-white';
      break;
    default:
      icon = <Info className="w-6 h-6" />;
      bgColor = 'bg-gray-500';
      textColor = 'text-white';
  }

  return (
    <div
      className={`fixed top-4 right-4 z-50 flex items-center gap-3 p-4 rounded-lg shadow-lg transform transition-transform duration-300 ease-out
        ${isVisible ? 'translate-x-0' : 'translate-x-full'} ${bgColor} ${textColor}`}
    >
      {icon}
      <span className="font-semibold">{message}</span>
      <button onClick={onClose} className="ml-auto p-1 rounded-full hover:bg-white hover:bg-opacity-20 transition">
        <XCircle className="w-4 h-4" />
      </button>
    </div>
  );
}
