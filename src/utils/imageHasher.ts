/**
 * Utility to calculate average perceptual hash (aHash) of an image entirely client-side using Canvas.
 * Returns a 64-character binary string representing the 8x8 image hash.
 */
export function generateImageHash(base64OrUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous"; // Enable CORS in case it's an Unsplash URL
    img.src = base64OrUrl;
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 8;
        canvas.height = 8;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not get 2D canvas context"));
          return;
        }

        // Draw image onto the tiny 8x8 canvas
        ctx.drawImage(img, 0, 0, 8, 8);
        const imgData = ctx.getImageData(0, 0, 8, 8);
        const data = imgData.data;

        // Convert to grayscale and calculate the mean intensity
        let sum = 0;
        const grays: number[] = [];
        for (let i = 0; i < 64; i++) {
          const r = data[i * 4];
          const g = data[i * 4 + 1];
          const b = data[i * 4 + 2];
          const gray = 0.299 * r + 0.587 * g + 0.114 * b;
          grays.push(gray);
          sum += gray;
        }
        const average = sum / 64;

        // Build binary hash
        let hash = "";
        for (let i = 0; i < 64; i++) {
          hash += grays[i] >= average ? "1" : "0";
        }
        resolve(hash);
      } catch (err) {
        resolve(fallbackHash(base64OrUrl));
      }
    };
    img.onerror = () => {
      resolve(fallbackHash(base64OrUrl));
    };
  });
}

export function fallbackHash(str: string): string {
  // A simple deterministic hash function of the string to avoid crashing when CORS blocks the canvas read
  let hashVal = 0;
  for (let i = 0; i < str.length; i++) {
    hashVal = (hashVal << 5) - hashVal + str.charCodeAt(i);
    hashVal |= 0; // Convert to 32bit integer
  }
  let binaryStr = "";
  for (let i = 0; i < 64; i++) {
    binaryStr += (Math.abs(hashVal ^ i) % 2) === 0 ? "1" : "0";
  }
  return binaryStr;
}

/**
 * Computes similarity (0 to 1) between two binary hashes.
 */
export function compareHashes(hash1: string, hash2: string): number {
  if (!hash1 || !hash2 || hash1.length !== hash2.length || hash1.length === 0) return 0;
  let matches = 0;
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] === hash2[i]) {
      matches++;
    }
  }
  return matches / hash1.length;
}

/**
 * Haversine formula to compute distance in meters between two GPS coordinates
 */
export function getDistanceInMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // in meters
}
