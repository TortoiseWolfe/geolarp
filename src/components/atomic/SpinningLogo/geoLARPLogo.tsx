import React from 'react';
import Image from 'next/image';

export interface geoLARPLogoProps {
  className?: string;
  width?: number;
  height?: number;
}

export const geoLARPLogo: React.FC<geoLARPLogoProps> = ({
  className = 'w-full h-full',
  width = 400,
  height = 400,
}) => {
  return (
    <Image
      src="/geolarp-logo.svg"
      alt="geoLARP Logo"
      width={width}
      height={height}
      className={className}
      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
      priority
    />
  );
};

geoLARPLogo.displayName = 'geoLARPLogo';
