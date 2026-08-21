"use client"
import Image from 'next/image'
import { CSSProperties } from 'react'

interface IconProps {
  name: string
  size?: number
  className?: string
  alt?: string
  style?: CSSProperties
  strokeWidth?: number
  color?: string
  fill?: string
}

export function Icon({ name, size = 24, className = '', alt = '', style }: IconProps) {
  return (
    <Image
      src={`/icons/${name}.png`}
      width={size}
      height={size}
      alt={alt}
      className={className}
      style={{ display: 'inline-block', ...style }}
      unoptimized
    />
  )
}
