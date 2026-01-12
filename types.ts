export interface HandLandmark {
  x: number;
  y: number;
  z: number;
}

export interface HandResults {
  landmarks: HandLandmark[][];
  worldLandmarks: HandLandmark[][];
}

export interface ModelProps {
  url: string;
  rotation: [number, number, number];
  scale: number;
}
