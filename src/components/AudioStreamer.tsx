import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Volume2, VolumeX, Smartphone, Monitor, Wifi, WifiOff, QrCode, Copy, CheckCircle, Users, Radio, Speaker, AlertCircle } from 'lucide-react';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import { QRCodeGenerator } from './QRCodeGenerator';
import StreamingService from '@/services/StreamingService';

export const AudioStreamer = () => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState([75]);
  const [isConnected, setIsConnected] = useState(false);
  const [deviceType, setDeviceType] = useState<'pc' | 'mobile'>('pc');
  const [audioLevel, setAudioLevel] = useState(0);
  const [showQR, setShowQR] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [connectionUrl, setConnectionUrl] = useState('');
  const [roomId, setRoomId] = useState('');
  const [isReceiver, setIsReceiver] = useState(false);
  const [showAudioHelp, setShowAudioHelp] = useState(false);
  const [audioSource, setAudioSource] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState('');
  const [streamingService, setStreamingService] = useState<StreamingService | null>(null);
  const audioLevelInterval = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  const startStreaming = (force: boolean = false) => {
    const remoteAudio = new Audio();
    remoteAudio.autoplay = true;
    // Check if this is a receiver (has room ID in hash)
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    const roomId = hashParams.get('r');
    if (!roomId && !force) {
      return;
    }

    const isReceiver = !!roomId;
    setIsReceiver(isReceiver);
    // setRoomId(roomId || '');

    const onReady = (roomId : string) => {
      // setIsConnected(!isReceiver);
      setIsStreaming(true);
      setRoomId(roomId);
      setConnectionUrl(`${window.location.href}#r=${roomId}`);
    }

    const onStream = (mediaStream: MediaStream) => {
      setIsConnected(true);
      if(isReceiver) {
        setAudioSource(mediaStream.getAudioTracks()[0].label);
        setIsStreaming(true);

        const audioTracks = mediaStream.getAudioTracks();
        if (!audioTracks.length) {
          throw new Error('No audio track in received stream');
        }

        const audioContext = new (window.AudioContext /*|| (window as any).webkitAudioContext*/)();
        // await audioContext.resume();
        // Create and play a silent buffer to ensure we have permission
        const buffer = audioContext.createBuffer(1, 1, 22050);
        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContext.destination);
        source.start(0);

        remoteAudio.srcObject = mediaStream;
        remoteAudio.play();
      }
    }

    const onError = (error: any) => {
      setErrorMessage(error.message || 'An error occurred while connecting');
    }
    // Initialize streaming service
    const service = new StreamingService(roomId, onReady, onStream, onError);

    setStreamingService(service);

  }

  useEffect(startStreaming, []);

  const copyConnectionUrl = async () => {
    try {
      await navigator.clipboard.writeText(connectionUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
      toast({
        title: "URL copied!",
        description: "Share this link with your other device",
      });
    } catch (error) {
      toast({
        title: "Failed to copy URL",
        description: "Please copy the URL manually",
        variant: "destructive",
      });
    }
  };

  const toggleStreaming = async () => {
    if (isStreaming) {
      streamingService?.disconnect();
    } else {
      setShowAudioHelp(true);
    }
  }

  const getCurrentUrl = () => {
    return connectionUrl || window.location.href;
  };

  useEffect(() => {
    if (!isStreaming && !isReceiver) {
      setConnectionStatus('');
    } else if (isStreaming && !isConnected) {
      setConnectionStatus('Waiting for device to connect...');
    } else if (isReceiver && !isConnected) {
      setConnectionStatus('Connecting to audio source...');
    } else if (isConnected) {
      setConnectionStatus('Connected and streaming audio');
    }
  }, [isStreaming, isConnected, isReceiver]);

  return (
    <div className="min-h-screen p-4 md:p-8 flex items-center justify-center">
      <div className="w-full max-w-md space-y-6">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            PC to Ear
          </h1>
          <p className="text-muted-foreground">
            {isReceiver ? 'Receiving audio from PC' : 'Stream audio from your PC to any device'}
          </p>
        </div>

        {/* Connection Status */}
        <Card className="audio-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              {isReceiver ? <Radio className="w-5 h-5" /> : deviceType === 'pc' ? <Monitor className="w-5 h-5" /> : <Smartphone className="w-5 h-5" />}
              <span className="font-medium">
                {isReceiver ? 'Audio Receiver' : deviceType === 'pc' ? 'PC Source' : 'Mobile Receiver'}
              </span>
            </div>
            <Badge variant={isConnected ? "default" : "secondary"} className="flex items-center gap-1">
              {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {isConnected ? 'Connected' : 'Disconnected'}
            </Badge>
          </div>

          {/* Connection Status Message */}
          {connectionStatus && (
            <div className="mb-4 p-3 bg-primary/10 rounded-lg">
              <div className="flex items-center gap-2">
                {isConnected ? (
                  <CheckCircle className="w-4 h-4 text-primary animate-pulse" />
                ) : (
                  <div className="w-4 h-4 rounded-full bg-primary/50 animate-pulse" />
                )}
                <span className="text-sm">{connectionStatus}</span>
              </div>
            </div>
          )}
          

          {/* Room ID Display */}
          {(isStreaming || isReceiver) && (
            <div className="mb-4 p-3 bg-muted/20 rounded-lg">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">Room ID:</span>
                <code className="text-sm text-primary">{roomId}</code>
              </div>
            </div>
          )}

          {/* Audio Level Visualization */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm text-muted-foreground">
                {isReceiver ? 'Incoming Audio' : 'Audio Level'}
              </span>
            </div>
            <div className="flex items-center gap-1 h-8">
              {Array.from({ length: 20 }, (_, i) => (
                <div
                  key={i}
                  className={`audio-wave w-1 h-full rounded-full transition-all duration-150 ${
                    i < audioLevel * 20 ? 'bg-primary' : 'bg-muted'
                  }`}
                  style={{
                    animationDelay: `${i * 0.1}s`,
                    height: (isStreaming || isConnected) && i < audioLevel * 20 ? '100%' : '20%'
                  }}
                />
              ))}
            </div>
          </div>

          {/* Main Controls */}
          <div className="space-y-4">
            {!isReceiver && (
              <Button
                onClick={toggleStreaming}
                className={`audio-button w-full h-12 ${isStreaming ? 'audio-active' : ''}`}
                variant={isStreaming ? "default" : "outline"}
              >
                {isStreaming ? (
                  <>
                    <Speaker className="w-5 h-5 mr-2" />
                    Stop Streaming
                  </>
                ) : (
                  <>
                    <Speaker className="w-5 h-5 mr-2" />
                    Share Audio
                  </>
                )}
              </Button>
            )}

            {/* Volume Control */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {isReceiver ? 'Playback Volume' : 'Volume'}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  // onClick={toggleMute}
                  className="h-8 w-8 p-0"
                >
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </Button>
              </div>
              <Slider
                value={volume}
                onValueChange={setVolume}
                max={100}
                step={1}
                className="w-full"
                disabled={isMuted}
              />
              <div className="text-xs text-muted-foreground text-center">
                {isMuted ? 'Muted' : `${volume[0]}%`}
              </div>
            </div>
          </div>
        </Card>

        {/* Connection Instructions */}
        {!isReceiver && !isConnected && (
          <Card className="audio-card p-4">
            <div className="text-center space-y-4">
              <div>
                <h3 className="font-medium mb-2">Connect Your Device</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {isStreaming 
                    ? 'Share this connection with your mobile device to receive audio'
                    : 'Start streaming first, then share the connection'
                  }
                </p>
              </div>
              
              {isStreaming && (
                <div className="space-y-3">
                  <Button
                    variant="outline"
                    onClick={() => setShowQR(!showQR)}
                    className="w-full"
                    disabled={!isStreaming}
                  >
                    <QrCode className="w-4 h-4 mr-2" />
                    {showQR ? 'Hide QR Code' : 'Show QR Code'}
                  </Button>
                  
                  {showQR && (
                    <div className="flex justify-center p-4 bg-muted/20 rounded-lg">
                      <QRCodeGenerator 
                        value={getCurrentUrl()} 
                        size={180}
                      />
                    </div>
                  )}
                  
                  {/* URL Copy */}
                  <Button
                    variant="outline"
                    onClick={copyConnectionUrl}
                    className="w-full"
                    disabled={!isStreaming}
                  >
                    {copiedUrl ? (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2 text-primary" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 mr-2" />
                        Copy Connection URL
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Receiver Status */}
        {isReceiver && !isConnected && (
          <Card className="audio-card p-4">
            <div className="text-center space-y-3">
              <div className="relative">
                <Radio className="w-8 h-8 mx-auto text-primary animate-pulse" />
                {/* Connection animation rings */}
                <div className="absolute inset-0 w-8 h-8 mx-auto rounded-full border-2 border-primary/20 animate-ping" />
                <div className="absolute inset-0 w-8 h-8 mx-auto rounded-full border-2 border-primary/20 animate-ping" style={{ animationDelay: '0.5s' }} />
              </div>
              <div>
                <h3 className="font-medium mb-2">Connecting...</h3>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Make sure on your PC:
                  </p>
                  <ul className="text-xs text-muted-foreground text-left list-disc list-inside space-y-1">
                    <li>Audio streaming is started</li>
                    <li>A window/tab with audio is shared</li>
                    <li>Audio sharing is enabled in the popup</li>
                  </ul>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="audio-card p-4 text-center">
            <div className="text-2xl font-bold text-primary">
              {(isStreaming || isConnected) ? '24bit' : '---'}
            </div>
            <div className="text-xs text-muted-foreground">Quality</div>
          </Card>
          <Card className="audio-card p-4 text-center">
            <div className="text-2xl font-bold text-secondary">
              {(isStreaming || isConnected) ? '48kHz' : '---'}
            </div>
            <div className="text-xs text-muted-foreground">Sample Rate</div>
          </Card>
        </div>

        {/* Audio Help Dialog */}
        <AlertDialog open={showAudioHelp} onOpenChange={setShowAudioHelp}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {errorMessage?.includes('secure context') ? 'Security Requirements' : 'Select Audio Source'}
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-4">
                {errorMessage?.includes('secure context') ? (
                  <>
                    <p>For security reasons, audio sharing requires either:</p>
                    <ul className="list-disc list-inside space-y-2">
                      <li>A secure HTTPS connection, or</li>
                      <li>Running on localhost</li>
                    </ul>
                    <p>Please access this app via:</p>
                    <code className="block p-2 bg-muted rounded">
                      {window.location.protocol === 'https:' 
                        ? window.location.href 
                        : `https://${window.location.host}`}
                    </code>
                    <div className="flex items-center gap-2 p-2 bg-muted rounded">
                      <AlertCircle className="w-4 h-4 text-primary" />
                      <span className="text-sm">
                        Or run it locally and access via{' '}
                        <code className="px-1 bg-background">http://localhost:5173</code>
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <p>To share your PC audio:</p>
                    <ol className="list-decimal list-inside space-y-2">
                      <li>Click "Share System Audio" below</li>
                      <li>In the popup, select "Chrome Tab" or "Window"</li>
                      <li>Make sure "Share audio" is checked</li>
                      <li>Select the window/tab playing audio</li>
                      <li>Click "Share"</li>
                    </ol>
                    <div className="flex items-center gap-2 p-2 bg-muted rounded">
                      <AlertCircle className="w-4 h-4 text-primary" />
                      <span className="text-sm">
                        Tip: Choose the application or browser tab that's playing the audio you want to share
                      </span>
                    </div>
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setShowAudioHelp(false)}>
                {errorMessage?.includes('secure context') ? 'Close' : 'Cancel'}
              </AlertDialogCancel>
              {!errorMessage?.includes('secure context') && (
                <AlertDialogAction onClick={() => (startStreaming(true))}>
                  <Speaker className="w-4 h-4 mr-2" />
                  Share System Audio
                </AlertDialogAction>
              )}
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};