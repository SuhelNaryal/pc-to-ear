// Mock signaling service for development
// In production, this would be replaced with a real WebSocket signaling server

export class MockSignalingService {
  private static instances: Map<string, MockSignalingService[]> = new Map();
  private roomId: string;
  private callbacks: { [key: string]: Function } = {};

  constructor(roomId: string) {
    this.roomId = roomId;
    
    if (!MockSignalingService.instances.has(roomId)) {
      MockSignalingService.instances.set(roomId, []);
    }
    
    MockSignalingService.instances.get(roomId)?.push(this);
  }

  on(event: string, callback: Function) {
    this.callbacks[event] = callback;
  }

  emit(event: string, data?: any) {
    const roomInstances = MockSignalingService.instances.get(this.roomId) || [];
    
    // Simulate network delay
    setTimeout(() => {
      roomInstances.forEach(instance => {
        if (instance !== this && instance.callbacks[event]) {
          instance.callbacks[event](data);
        }
      });
    }, 50);
  }

  join() {
    // Notify others that a new user joined
    setTimeout(() => {
      this.emit('user-joined');
    }, 100);
  }

  leave() {
    const roomInstances = MockSignalingService.instances.get(this.roomId) || [];
    const index = roomInstances.indexOf(this);
    if (index > -1) {
      roomInstances.splice(index, 1);
    }
  }
}

export class SimpleAudioStreamingService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteAudio: HTMLAudioElement | null = null;
  private signaling: MockSignalingService;
  private roomId: string;
  private isHost: boolean = false;
  private onConnectionStateChange: ((connected: boolean) => void) | null = null;

  private iceServers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ]
  };

  constructor() {
    this.roomId = this.getRoomIdFromUrl() || this.generateRoomId();
    this.signaling = new MockSignalingService(this.roomId);
    this.setupSignaling();
  }

  private generateRoomId(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  private getRoomIdFromUrl(): string | null {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('room');
  }

  private updateUrl(roomId: string) {
    const newUrl = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
    window.history.pushState({}, '', newUrl);
  }

  private setupSignaling() {
    this.signaling.on('user-joined', () => {
      console.log('Another user joined');
      if (this.isHost && this.peerConnection) {
        this.createOffer();
      }
    });

    this.signaling.on('offer', async (offer: RTCSessionDescriptionInit) => {
      await this.handleOffer(offer);
    });

    this.signaling.on('answer', async (answer: RTCSessionDescriptionInit) => {
      await this.handleAnswer(answer);
    });

    this.signaling.on('ice-candidate', async (candidate: RTCIceCandidateInit) => {
      if (this.peerConnection) {
        await this.peerConnection.addIceCandidate(candidate);
      }
    });
  }

  private createPeerConnection() {
    this.peerConnection = new RTCPeerConnection(this.iceServers);

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.signaling.emit('ice-candidate', event.candidate);
      }
    };

    this.peerConnection.ontrack = (event) => {
      console.log('Received remote stream');
      if (event.streams && event.streams[0]) {
        this.playRemoteStream(event.streams[0]);
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      console.log('Connection state:', this.peerConnection?.connectionState);
      const connected = this.peerConnection?.connectionState === 'connected';
      this.onConnectionStateChange?.(connected);
    };
  }

  private playRemoteStream(stream: MediaStream) {
    if (!this.remoteAudio) {
      this.remoteAudio = new Audio();
      this.remoteAudio.autoplay = true;
      this.remoteAudio.volume = 0.75;
    }
    this.remoteAudio.srcObject = stream;
  }

  async startStreaming(): Promise<{ roomId: string; connectionUrl: string }> {
    try {
      this.isHost = true;
      this.updateUrl(this.roomId);
      
      // Request microphone or desktop audio
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 48000,
          channelCount: 2
        }
      });

      this.createPeerConnection();
      
      // Add local stream to peer connection
      this.localStream.getTracks().forEach(track => {
        this.peerConnection?.addTrack(track, this.localStream!);
      });

      // Join the signaling room
      this.signaling.join();

      const connectionUrl = `${window.location.origin}${window.location.pathname}?room=${this.roomId}`;
      
      return {
        roomId: this.roomId,
        connectionUrl
      };
    } catch (error) {
      console.error('Error starting stream:', error);
      throw error;
    }
  }

  async joinAsReceiver(): Promise<void> {
    this.createPeerConnection();
    this.signaling.join();
  }

  private async createOffer() {
    if (!this.peerConnection) return;

    try {
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);
      this.signaling.emit('offer', offer);
    } catch (error) {
      console.error('Error creating offer:', error);
    }
  }

  private async handleOffer(offer: RTCSessionDescriptionInit) {
    if (!this.peerConnection) {
      this.createPeerConnection();
    }
    
    try {
      await this.peerConnection.setRemoteDescription(offer);
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      this.signaling.emit('answer', answer);
    } catch (error) {
      console.error('Error handling offer:', error);
    }
  }

  private async handleAnswer(answer: RTCSessionDescriptionInit) {
    try {
      await this.peerConnection?.setRemoteDescription(answer);
    } catch (error) {
      console.error('Error handling answer:', error);
    }
  }

  stopStreaming() {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    if (this.remoteAudio) {
      this.remoteAudio.pause();
      this.remoteAudio.srcObject = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.signaling.leave();
    this.isHost = false;
  }

  setVolume(volume: number) {
    if (this.remoteAudio) {
      this.remoteAudio.volume = volume / 100;
    }
  }

  mute(muted: boolean) {
    if (this.remoteAudio) {
      this.remoteAudio.muted = muted;
    }
  }

  isConnected(): boolean {
    return this.peerConnection?.connectionState === 'connected';
  }

  getRoomId(): string {
    return this.roomId;
  }

  getConnectionUrl(): string {
    return `${window.location.origin}${window.location.pathname}?room=${this.roomId}`;
  }

  onConnectionChange(callback: (connected: boolean) => void) {
    this.onConnectionStateChange = callback;
  }
}