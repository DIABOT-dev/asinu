/**
 * OptimizedImage — Drop-in replacement for React Native Image.
 * Uses expo-image for better caching, lazy loading, and performance.
 */
import { Image, ImageProps } from 'expo-image';
import React from 'react';

const blurhash = 'L6PZfSi_.AyE_3t7t7R**0o#DgR4';

interface OptimizedImageProps extends Omit<ImageProps, 'source'> {
  source: ImageProps['source'];
  /** Enable blur placeholder while loading (default: true for remote images) */
  placeholder?: string;
}

export function OptimizedImage({ source, placeholder, style, ...props }: OptimizedImageProps) {
  const isRemote = typeof source === 'object' && 'uri' in source;

  return (
    <Image
      source={source}
      placeholder={isRemote ? (placeholder || blurhash) : undefined}
      transition={isRemote ? 200 : 0}
      cachePolicy="memory-disk"
      recyclingKey={typeof source === 'object' && 'uri' in source ? source.uri : undefined}
      style={style}
      {...props}
    />
  );
}
