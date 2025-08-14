export class AudioCaptureService {
  private static checkMediaDevicesSupport() {
    if (!navigator.mediaDevices) {
      const isLocalhost = window.location.hostname === 'localhost' || 
                         window.location.hostname === '127.0.0.1';
      
      if (!isLocalhost && window.location.protocol !== 'https:') {
        throw new Error(
          'Audio capture requires a secure context (HTTPS) or localhost. ' +
          'Please access this page via HTTPS or use localhost.'
        );
      }
      throw new Error('mediaDevices API not supported in this browser');
    }

    if (!navigator.mediaDevices.getDisplayMedia) {
      throw new Error(
        'Screen sharing is not supported in this browser. ' +
        'Please use a modern version of Chrome, Firefox, or Edge.'
      );
    }
  }

  private static async tryGetDisplayMedia(): Promise<MediaStream> {
    console.log('Attempting to capture system audio via screen share...');
    const stream = await navigator.mediaDevices.getDisplayMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        sampleRate: 48000,
        channelCount: 2
      },
      video: {
        width: 1,
        height: 1,
        frameRate: 1
      }
    });

    if (!stream.getAudioTracks().length) {
      stream.getTracks().forEach(track => track.stop());
      throw new Error('Please select a window/tab that includes audio');
    }

    return stream;
  }

  private static async tryGetUserMedia(): Promise<MediaStream> {
    console.log('Attempting to capture system audio via getUserMedia...');
    return await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        sampleRate: 48000,
        channelCount: 2
      }
    });
  }

  static async captureSystemAudio(): Promise<MediaStream> {
    try {
      // Check for required browser support
      this.checkMediaDevicesSupport();

      let audioStream: MediaStream | null = null;
      let error: Error | null = null;

      // Try getDisplayMedia first
      try {
        const stream = await this.tryGetDisplayMedia();
        // Stop the video track since we only need audio
        stream.getVideoTracks().forEach(track => track.stop());
        audioStream = new MediaStream(stream.getAudioTracks());
        console.log('Successfully captured system audio via screen share');
      } catch (e) {
        console.log('Screen share audio capture failed, trying getUserMedia...');
        error = e as Error;
      }

      // If getDisplayMedia failed, try getUserMedia as fallback
      if (!audioStream) {
        try {
          audioStream = await this.tryGetUserMedia();
          console.log('Successfully captured audio via getUserMedia');
        } catch (e) {
          console.error('Both audio capture methods failed');
          throw error || e; // Throw the first error if both methods fail
        }
      }

      // Final check to ensure we have an audio track
      if (!audioStream.getAudioTracks().length) {
        throw new Error('No audio track available in the captured stream');
      }

      // Set up track ended handler
      audioStream.getAudioTracks().forEach(track => {
        track.onended = () => {
          console.log('Audio track ended:', track.label);
          // You can handle track end here if needed
        };
      });

      return audioStream;
    } catch (error) {
      console.error('Audio capture failed:', error);
      throw new Error(
        'Could not access audio source. Please ensure you have: \n' +
        '1. Allowed microphone/audio access\n' +
        '2. Selected a window with audio when sharing\n' +
        '3. Not cancelled the permission prompt'
      );
    }
  }

  static getAudioSourceLabel(stream: MediaStream): string {
    const audioTrack = stream.getAudioTracks()[0];
    return audioTrack ? audioTrack.label : 'Unknown Source';
  }
}
