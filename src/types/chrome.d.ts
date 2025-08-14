declare global {
  interface Window {
    chrome?: {
      tabCapture: {
        capture(options: {
          audio: boolean;
          video: boolean;
        }, callback: (stream: MediaStream | null) => void): void;
      };
    };
  }
}
