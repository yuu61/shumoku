import { ImageResponse } from 'next/og';

export const revalidate = false;

export async function GET() {
  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        height: '100%',
        backgroundColor: '#1F2328',
        padding: '60px',
      }}
    >
      {/* Logo */}
      <svg width="120" height="120" viewBox="0 0 1024 1024" fill="none">
        <rect x="64" y="64" width="896" height="896" rx="200" fill="#7FE4C1" />
        <g transform="translate(90,40) scale(1.25)">
          <path
            fill="#1F2328"
            d="M 380 340 H 450 V 505 H 700 V 555 H 510 V 645 H 450 V 645 H 380 Z"
          />
        </g>
      </svg>

      {/* Title */}
      <h1
        style={{
          color: '#ffffff',
          fontSize: '72px',
          fontWeight: 700,
          marginTop: '40px',
          marginBottom: '16px',
        }}
      >
        Shumoku
      </h1>

      {/* Tagline */}
      <p
        style={{
          color: '#7FE4C1',
          fontSize: '32px',
          fontWeight: 500,
          margin: 0,
        }}
      >
        Network diagrams, as code.
      </p>
    </div>,
    {
      width: 1200,
      height: 630,
    },
  );
}
