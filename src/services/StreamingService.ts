import { Peer, MediaConnection, DataConnection} from "peerjs";
import { AudioCaptureService } from "./AudioCaptureService";

export default class StreamingService {
    private isHost: boolean = true;
    private peer: Peer | null = null;
    private connection: MediaConnection | null = null;
    public roomId: string | null = null;
    private mediaStream: MediaStream | null = null
    private dataConnection: DataConnection | null = null;

    private readyCallback: (roomId: string) => void = () => {};
    private streamCallback: (mediaStream: MediaStream) => void = () => {};
    private errorCallback: (error: any) => void = () => {};

    constructor(roomId?: string, onReady: (roomId: string) => void = () => {}, onStream: (mediaStream: MediaStream) => void = () => {}, onError: (error: any) => void = () => {}) {

        this.roomId = roomId || null;
        this.isHost = !roomId;
        this.streamCallback = onStream;
        this.readyCallback = onReady;
        this.errorCallback = onError;

        this.peer = new Peer(null, {
            debug: 3,
            config: {
                iceServers: [
                    {url:'stun:stun01.sipphone.com'},
                    {url:'stun:stun.ekiga.net'},
                    {url:'stun:stun.fwdnet.net'},
                    {url:'stun:stun.ideasip.com'},
                    {url:'stun:stun.iptel.org'},
                    {url:'stun:stun.rixtelecom.se'},
                    {url:'stun:stun.schlund.de'},
                    {url:'stun:stun.l.google.com:19302'},
                    {url:'stun:stun1.l.google.com:19302'},
                    {url:'stun:stun2.l.google.com:19302'},
                    {url:'stun:stun3.l.google.com:19302'},
                    {url:'stun:stun4.l.google.com:19302'},
                    {url:'stun:stunserver.org'},
                    {url:'stun:stun.softjoys.com'},
                    {url:'stun:stun.voiparound.com'},
                    {url:'stun:stun.voipbuster.com'},
                    {url:'stun:stun.voipstunt.com'},
                    {url:'stun:stun.voxgratia.org'},
                    {url:'stun:stun.xten.com'},
                    {
                        url: 'turn:numb.viagenie.ca',
                        credential: 'muazkh',
                        username: 'webrtc@live.com'
                    },
                    {
                        url: 'turn:192.158.29.39:3478?transport=udp',
                        credential: 'JZEOEt2V3Qb0y27GRntt2u2PAYA=',
                        username: '28224511:1379330808'
                    },
                    {
                        url: 'turn:192.158.29.39:3478?transport=tcp',
                        credential: 'JZEOEt2V3Qb0y27GRntt2u2PAYA=',
                        username: '28224511:1379330808'
                    }
                ]
            }
        });

        this.peer.on('open', async (id) => {
            console.log(`[Streaming] Peer connection established with ID: ${id}`);
            if(this.isHost) {
                this.roomId = id;

                this.mediaStream = await AudioCaptureService.captureSystemAudio();
                this.readyCallback(id);
            } else {
                this.connect();
            }
        });

        this.peer.on('connection', (connection) => {
            console.log(`[Streaming] Peer on connection : ${connection}`);

            if(this.isHost) {
                this.dataConnection = connection;

                this.startStreaming();

                // this.dataConnection.on('open', () => {
                //     console.log(`[Streaming] Data connection established with room: ${this.roomId}`);
                // });

                // this.dataConnection.on('data', (data) => {
                //     if(data === 'SEND_CALL') {
                        
                //     }
                // });
            }
            

            // connection.on('open', (function() {
            //     connection.send('Data connection is not supported on this service.');
            //     setTimeout(function() { connection.close(); }, 500);
            // }));
        });

        this.peer.on('call', async (connection) => {
            if (!this.isHost) {
                console.log(`[Streaming] Peer on call : ${connection}`);
                this.connection = connection;
                this.connection.answer();
                this.ready();
            } else {
                console.log(`[Streaming] Peer call received, but a host. Closing connection.`);
                connection.close()
            }
        });

        this.peer.on('disconnected', () => {
            console.log(`[Streaming] Peer disconnected, attempting to reconnect...`);
            this.peer.reconnect();
        });

        this.peer.on('close', () => {
            console.log(`[Streaming] Peer connection closed`);
        });

        this.peer.on('error', (error) => {
            console.error('[Streaming] Peer connection error:', error);
            this.errorCallback(error);
        });

        // if(!this.isHost) {
        //     this.connect();
        // }

        this.ready();
    }

    private connect(): void {
        if (!this.peer) {
            console.error('[Streaming] Peer connection not initialized');
            return;
        }

        if(this.dataConnection) {
            this.dataConnection.close();
        }

        this.dataConnection = this.peer.connect(this.roomId, {
            reliable: true
        });

        this.dataConnection.on('open', () => {
            console.log(`[Streaming] Data connection established with room: ${this.roomId}`);
            // this.dataConnection.send('SEND_CALL');
        });

        this.dataConnection.on('error', (error) => {
            console.log(`[Streaming] Data connection error with room: ${this.roomId}: ${error}`);
        });

        // if (this.connection) {
        //     console.warn('[Streaming] Media Stream already connected, closing existing connection');
        //     this.connection.close();
        // }
        // this.startStreaming();
        this.readyCallback(this.roomId);
    }

    async startStreaming(): Promise<void> {
        if(!this.isHost){ return;}

        if(!this.mediaStream) {
            this.mediaStream = await AudioCaptureService.captureSystemAudio();
        }

        if(this.mediaStream) {
            this.connection = this.peer.call(this.dataConnection.peer, this.mediaStream);
            this.streamCallback(null);
            this.ready();
        } else {
            console.error(`[Streaming] Failed to capture media stream`);
            this.peer.destroy();
            return;
        }

    }

    private ready(): void {
        if(!this.connection) { return; }

        console.log(`[Streaming] Media Stream ready for room: ${this.roomId}`);

        if(!this.isHost) {
            this.connection.on('stream', (stream) => {
                console.log(`[Streaming] Media Stream received for room: ${this.roomId}`);
                this.streamCallback(stream);
            });
        }

        this.connection.on('error',  (error) => {
            console.error('[Streaming] Peer connection error: ', error);
            this.errorCallback(error);
            this.connection = null;
        });

        this.connection.on('close', () => {
            console.log(`[Streaming] Media Stream closed`);
            this.connection = null;
        });
    }

    public disconnect(): void {
        this.connection?.close();
        this.peer?.destroy();
        this.connection = null;
        this.peer = null;
        this.roomId = null;
        this.readyCallback('');
    }
}