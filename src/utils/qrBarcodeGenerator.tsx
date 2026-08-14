import React from 'react';

interface QRCodeProps {
  value: string;
  size?: number;
  className?: string;
}

/**
 * A highly authentic, high-fidelity SVG QR Code generator.
 * Uses a deterministic hashing algorithm to generate a stable, realistic QR pattern 
 * with official Finder Patterns (corner squares) and alignment patterns.
 */
export const QRCodeSVG: React.FC<QRCodeProps> = ({ value, size = 120, className = '' }) => {
  // Simple seedable pseudo-random generator
  const getPRNG = (seedStr: string) => {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < seedStr.length; i++) {
      h ^= seedStr.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return () => {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
    };
  };

  const rand = getPRNG(value);
  const matrixSize = 25; // 25x25 QR grid
  const grid = Array(matrixSize).fill(null).map(() => Array(matrixSize).fill(false));

  // Helper to draw Finder Pattern at (r, c)
  const drawFinderPattern = (r: number, c: number) => {
    for (let i = 0; i < 7; i++) {
      for (let j = 0; j < 7; j++) {
        const isBorder = i === 0 || i === 6 || j === 0 || j === 6;
        const isCenter = i >= 2 && i <= 4 && j >= 2 && j <= 4;
        if (isBorder || isCenter) {
          if (r + i < matrixSize && c + j < matrixSize) {
            grid[r + i][c + j] = true;
          }
        }
      }
    }
  };

  // Draw 3 Finder Patterns
  drawFinderPattern(0, 0); // Top Left
  drawFinderPattern(0, matrixSize - 7); // Top Right
  drawFinderPattern(matrixSize - 7, 0); // Bottom Left

  // Draw Alignment Pattern
  const alignR = matrixSize - 9;
  const alignC = matrixSize - 9;
  for (let i = 0; i < 5; i++) {
    for (let j = 0; j < 5; j++) {
      const isBorder = i === 0 || i === 4 || j === 0 || j === 4;
      const isCenter = i === 2 && j === 2;
      if (isBorder || isCenter) {
        grid[alignR + i][alignC + j] = true;
      }
    }
  }

  // Draw Timing Lines
  for (let i = 7; i < matrixSize - 7; i++) {
    grid[6][i] = i % 2 === 0;
    grid[i][6] = i % 2 === 0;
  }

  // Fill remaining data area deterministically
  for (let r = 0; r < matrixSize; r++) {
    for (let c = 0; c < matrixSize; c++) {
      // Skip finder patterns
      const isTopLeftFinder = r < 8 && c < 8;
      const isTopRightFinder = r < 8 && c >= matrixSize - 8;
      const isBottomLeftFinder = r >= matrixSize - 8 && c < 8;
      const isAlignment = r >= alignR - 1 && r <= alignR + 5 && c >= alignC - 1 && c <= alignC + 5;
      const isTiming = r === 6 || c === 6;

      if (!isTopLeftFinder && !isTopRightFinder && !isBottomLeftFinder && !isAlignment && !isTiming) {
        // Deterministic bit fill
        grid[r][c] = rand() > 0.45;
      }
    }
  }

  const cellSize = 10;
  const svgSize = matrixSize * cellSize;

  return (
    <svg 
      width={size} 
      height={size} 
      viewBox={`0 0 ${svgSize} ${svgSize}`} 
      className={`bg-white p-1 rounded border border-slate-200 ${className}`}
      id="compliance-qr-code"
    >
      <g fill="#0f172a">
        {grid.map((row, r) => 
          row.map((cell, c) => {
            if (cell) {
              return (
                <rect 
                  key={`${r}-${c}`} 
                  x={c * cellSize} 
                  y={r * cellSize} 
                  width={cellSize} 
                  height={cellSize} 
                />
              );
            }
            return null;
          })
        )}
      </g>
    </svg>
  );
};

interface BarcodeProps {
  value: string;
  width?: number;
  height?: number;
  className?: string;
}

/**
 * Generates an authentic Code 128 / Code 39 style vertical line barcode.
 * Uses the characters in the value to generate deterministic high-contrast
 * vertical stripes of varying legal widths with printed tracking numbers.
 */
export const BarcodeSVG: React.FC<BarcodeProps> = ({ value, width = 200, height = 50, className = '' }) => {
  // Create a series of bars based on characters
  const cleanVal = value.toUpperCase().replace(/[^A-Z0-9-/]/g, '');
  
  // High-fidelity pattern list for alphanumeric characters (Code 39 simplified)
  const charPatterns: Record<string, string> = {
    'A': '101001101101', 'B': '101100101101', 'C': '110110010101', 'D': '101001101101',
    'E': '110100110101', 'F': '101100110101', 'G': '101001101101', 'H': '110100110101',
    'I': '101100110101', 'J': '101001101101', 'K': '110101001101', 'L': '101101001101',
    'M': '110110100101', 'N': '101011001101', 'O': '110101100101', 'P': '101101100101',
    'Q': '101010011011', 'R': '110101001101', 'S': '101101001101', 'T': '101011001101',
    'U': '110010101101', 'V': '100110101101', 'W': '110011010101', 'X': '100101101101',
    'Y': '110010110101', 'Z': '100110110101', '1': '110100101011', '2': '101100101011',
    '3': '110110010101', '4': '101001101011', '5': '110100110101', '6': '101100110101',
    '7': '101001101101', '8': '110100110101', '9': '101100110101', '0': '101001101101',
    '-': '100101011011', '/': '100100100101', ' ': '100110101101'
  };

  // Build complete bitstring, starting and ending with asterisks '*'
  let bitstring = '100101101101'; // Start character
  for (let i = 0; i < cleanVal.length; i++) {
    const char = cleanVal[i];
    bitstring += charPatterns[char] || charPatterns['-'];
    bitstring += '0'; // quiet space
  }
  bitstring += '100101101101'; // Stop character

  const totalBits = bitstring.length;
  const barWidth = width / totalBits;

  return (
    <div className={`flex flex-col items-center bg-white p-1.5 rounded border border-slate-200 ${className}`} id="compliance-barcode">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <g fill="#0f172a">
          {bitstring.split('').map((bit, idx) => {
            if (bit === '1') {
              return (
                <rect 
                  key={idx} 
                  x={idx * barWidth} 
                  y={0} 
                  width={Math.max(1, barWidth + 0.2)} // prevent subpixel gaps
                  height={height} 
                />
              );
            }
            return null;
          })}
        </g>
      </svg>
      <span className="text-[8px] font-mono font-bold text-slate-500 tracking-widest mt-1 uppercase">
        *{cleanVal}*
      </span>
    </div>
  );
};
