import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Mic, MicOff, Volume2, VolumeX, Smartphone, Monitor, Wifi, WifiOff, QrCode, Copy, CheckCircle, Users, Radio } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { QRCodeGenerator } from './QRCodeGenerator';
import { SimpleAudioStreamingService } from '@/services/SimpleAudioStreamingService';

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
  
  const streamingService = useRef<SimpleAudioStreamingService | null>(null);
  const audioLevelInterval = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Initialize streaming service
    streamingService.current = new SimpleAudioStreamingService();
    
    // Check if this is a receiver (has room parameter)
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    
    if (roomParam) {
      setIsReceiver(true);
      setDeviceType('mobile');
      // Auto-join as receiver
      joinAsReceiver();
    } else {
      // Detect device type for new sessions
      const isMobile = window.innerWidth < 768 || /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      setDeviceType(isMobile ? 'mobile' : 'pc');
    }

    // Set up connection state monitoring
    streamingService.current?.onConnectionChange((connected) => {
      setIsConnected(connected);
      if (connected) {
        toast({
          title: "Devices connected!",
          description: "Audio streaming is now active between devices",
        });
      }
    });

    return () => {
      if (audioLevelInterval.current) {
        clearInterval(audioLevelInterval.current);
      }
      streamingService.current?.stopStreaming();
    };
  }, []);

  useEffect(() => {
    // Update volume and mute on streaming service
    if (streamingService.current) {
      streamingService.current.setVolume(volume[0]);
      streamingService.current.mute(isMuted);
    }
  }, [volume, isMuted]);

  const joinAsReceiver = async () => {
    try {
      await streamingService.current?.joinAsReceiver();
      toast({
        title: "Waiting for connection",
        description: "Ready to receive audio from PC",
      });
    } catch (error) {
      toast({
        title: "Connection failed",
        description: "Could not connect to audio source",
        variant: "destructive",
      });
    }
  };

  const startAudioStreaming = async () => {
    try {
      if (!streamingService.current) return;
      
      const result = await streamingService.current.startStreaming();
      
      setIsStreaming(true);
      setConnectionUrl(result.connectionUrl);
      setRoomId(result.roomId);
      
      // Start simulated audio level monitoring
      startAudioLevelMonitoring();
      
      toast({
        title: "Audio streaming started",
        description: "Share the connection URL or QR code with your other device",
      });
      
    } catch (error) {
      toast({
        title: "Error starting stream",
        description: "Please check your microphone permissions and try again",
        variant: "destructive",
      });
    }
  };

  const stopAudioStreaming = () => {
    streamingService.current?.stopStreaming();
    
    setIsStreaming(false);
    setIsConnected(false);
    setAudioLevel(0);
    
    if (audioLevelInterval.current) {
      clearInterval(audioLevelInterval.current);
    }
    
    toast({
      title: "Audio streaming stopped",
      description: "Stream has been terminated",
    });
  };

  const startAudioLevelMonitoring = () => {
    // Simulate audio level for visual feedback
    audioLevelInterval.current = setInterval(() => {
      if (isStreaming) {
        // Generate realistic audio level simulation
        const baseLevel = 0.2 + Math.random() * 0.6;
        const variation = Math.sin(Date.now() / 200) * 0.1;
        setAudioLevel(Math.max(0, Math.min(1, baseLevel + variation)));
      }
    }, 100);
  };

  const toggleStreaming = () => {
    if (isStreaming) {
      stopAudioStreaming();
    } else {
      startAudioStreaming();
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    toast({
      title: isMuted ? "Audio unmuted" : "Audio muted",
      description: `Audio is now ${isMuted ? 'enabled' : 'disabled'}`,
    });
  };

  const copyConnectionUrl = async () => {
    const urlToCopy = connectionUrl || streamingService.current?.getConnectionUrl() || window.location.href;
    try {
      await navigator.clipboard.writeText(urlToCopy);
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

  const getCurrentUrl = () => {
    return connectionUrl || streamingService.current?.getConnectionUrl() || window.location.href;
  };

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

          {/* Room ID Display */}
          {(isStreaming || isReceiver) && (
            <div className="mb-4 p-3 bg-muted/20 rounded-lg">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">Room ID:</span>
                <code className="text-sm text-primary">{roomId || streamingService.current?.getRoomId()}</code>
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
                    <MicOff className="w-5 h-5 mr-2" />
                    Stop Streaming
                  </>
                ) : (
                  <>
                    <Mic className="w-5 h-5 mr-2" />
                    Start Streaming
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
                  onClick={toggleMute}
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
              <Radio className="w-8 h-8 mx-auto text-primary animate-pulse" />
              <div>
                <h3 className="font-medium mb-1">Waiting for Connection</h3>
                <p className="text-sm text-muted-foreground">
                  Make sure audio streaming is started on your PC
                </p>
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
      </div>
    </div>
  );
};