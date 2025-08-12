import { io, Socket } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';

export class AudioStreamingService {
  private socket: Socket | null = null;
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteAudio: HTMLAudioElement | null = null;
  private roomId: string;
  private isHost: boolean = false;

  // Configuration for ICE servers (STUN servers for NAT traversal)
  private iceServers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ]
  };

  constructor() {
    this.roomId = this.getRoomIdFromUrl() || uuidv4();
    this.initializeSocket();
  }

  private getRoomIdFromUrl(): string | null {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('room');
  }

  private updateUrl(roomId: string) {
    const newUrl = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
    window.history.pushState({}, '', newUrl);
  }

  private initializeSocket() {
    // For demo purposes, we'll use a public signaling server
    // In production, you'd want your own signaling server
    this.socket = io('wss://signaling-server-demo.herokuapp.com', {
      transports: ['websocket', 'polling']
    });

    this.socket.on('connect', () => {
      console.log('Connected to signaling server');
      this.socket?.emit('join-room', this.roomId);
    });

    this.socket.on('user-joined', () => {
      console.log('Another user joined the room');
      if (this.isHost) {
        this.createOffer();
      }
    });

    this.socket.on('offer', async (offer: RTCSessionDescriptionInit) => {
      await this.handleOffer(offer);
    });

    this.socket.on('answer', async (answer: RTCSessionDescriptionInit) => {
      await this.handleAnswer(answer);
    });

    this.socket.on('ice-candidate', async (candidate: RTCIceCandidateInit) => {
      await this.handleIceCandidate(candidate);
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from signaling server');
    });
  }

  private createPeerConnection() {
    this.peerConnection = new RTCPeerConnection(this.iceServers);

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket?.emit('ice-candidate', event.candidate, this.roomId);
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
    };
  }

  private playRemoteStream(stream: MediaStream) {
    if (!this.remoteAudio) {
      this.remoteAudio = new Audio();
      this.remoteAudio.autoplay = true;
    }
    this.remoteAudio.srcObject = stream;
  }

  async startStreaming(): Promise<{ roomId: string; connectionUrl: string }> {
    try {
      this.isHost = true;
      this.updateUrl(this.roomId);
      
      // Get user media (microphone or system audio)
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

  private async createOffer() {
    if (!this.peerConnection) return;

    try {
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);
      this.socket?.emit('offer', offer, this.roomId);
    } catch (error) {
      console.error('Error creating offer:', error);
    }
  }

  private async handleOffer(offer: RTCSessionDescriptionInit) {
    this.createPeerConnection();
    
    try {
      await this.peerConnection?.setRemoteDescription(offer);
      const answer = await this.peerConnection?.createAnswer();
      await this.peerConnection?.setLocalDescription(answer);
      this.socket?.emit('answer', answer, this.roomId);
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

  private async handleIceCandidate(candidate: RTCIceCandidateInit) {
    try {
      await this.peerConnection?.addIceCandidate(candidate);
    } catch (error) {
      console.error('Error handling ICE candidate:', error);
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

    this.socket?.emit('leave-room', this.roomId);
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

  getConnectionState(): RTCPeerConnectionState | null {
    return this.peerConnection?.connectionState || null;
  }

  isConnected(): boolean {
    const state = this.getConnectionState();
    return state === 'connected';
  }

  getRoomId(): string {
    return this.roomId;
  }

  getConnectionUrl(): string {
    return `${window.location.origin}${window.location.pathname}?room=${this.roomId}`;
  }
}