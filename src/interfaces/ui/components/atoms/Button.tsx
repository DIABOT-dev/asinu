import React, { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
  children?: ReactNode;
  'data-testid'?: string;
}

export default function Button({ 
  variant = 'primary', 
  size = 'md', 
  className, 
  children, 
  'data-testid': testId,
  ...props 
}: ButtonProps) {
  return (
    <button
      className={cn(
        'btn',
        `btn-${variant}`,
        `btn-${size}`,
        className
      )}
      data-testid={testId}
      {...props}
    >
      {children}
    </button>
  );
}
