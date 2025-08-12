import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Mic, MicOff, Volume2, VolumeX, Smartphone, Monitor, Wifi, WifiOff, QrCode, Copy, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { QRCodeGenerator } from './QRCodeGenerator';

export const AudioStreamer = () => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState([75]);
  const [isConnected, setIsConnected] = useState(false);
  const [deviceType, setDeviceType] = useState<'pc' | 'mobile'>('pc');
  const [audioLevel, setAudioLevel] = useState(0);
  const [showQR, setShowQR] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  
  const audioContext = useRef<AudioContext | null>(null);
  const mediaStream = useRef<MediaStream | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Detect device type
    const isMobile = window.innerWidth < 768 || /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    setDeviceType(isMobile ? 'mobile' : 'pc');
  }, []);

  const startAudioCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        }
      });
      
      mediaStream.current = stream;
      audioContext.current = new AudioContext();
      analyser.current = audioContext.current.createAnalyser();
      
      const source = audioContext.current.createMediaStreamSource(stream);
      source.connect(analyser.current);
      
      setIsStreaming(true);
      setIsConnected(true);
      
      toast({
        title: "Audio streaming started",
        description: "Successfully capturing audio from your device",
      });
      
      // Simulate audio level monitoring
      const updateAudioLevel = () => {
        if (analyser.current && isStreaming) {
          const dataArray = new Uint8Array(analyser.current.frequencyBinCount);
          analyser.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
          setAudioLevel(average / 255);
        }
      };
      
      const interval = setInterval(updateAudioLevel, 100);
      return () => clearInterval(interval);
      
    } catch (error) {
      toast({
        title: "Error accessing microphone",
        description: "Please check your audio permissions and try again",
        variant: "destructive",
      });
    }
  };

  const stopAudioCapture = () => {
    if (mediaStream.current) {
      mediaStream.current.getTracks().forEach(track => track.stop());
    }
    if (audioContext.current) {
      audioContext.current.close();
    }
    
    setIsStreaming(false);
    setIsConnected(false);
    setAudioLevel(0);
    
    toast({
      title: "Audio streaming stopped",
      description: "Audio capture has been terminated",
    });
  };

  const toggleStreaming = () => {
    if (isStreaming) {
      stopAudioCapture();
    } else {
      startAudioCapture();
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
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
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

  return (
    <div className="min-h-screen p-4 md:p-8 flex items-center justify-center">
      <div className="w-full max-w-md space-y-6">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            PC to Ear
          </h1>
          <p className="text-muted-foreground">Stream audio from your PC to any device</p>
        </div>

        {/* Connection Status */}
        <Card className="audio-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              {deviceType === 'pc' ? <Monitor className="w-5 h-5" /> : <Smartphone className="w-5 h-5" />}
              <span className="font-medium">
                {deviceType === 'pc' ? 'PC Source' : 'Mobile Receiver'}
              </span>
            </div>
            <Badge variant={isConnected ? "default" : "secondary"} className="flex items-center gap-1">
              {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {isConnected ? 'Connected' : 'Disconnected'}
            </Badge>
          </div>

          {/* Audio Level Visualization */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm text-muted-foreground">Audio Level</span>
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
                    height: isStreaming && i < audioLevel * 20 ? '100%' : '20%'
                  }}
                />
              ))}
            </div>
          </div>

          {/* Main Controls */}
          <div className="space-y-4">
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

            {/* Volume Control */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Volume</span>
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
        {!isConnected && (
          <Card className="audio-card p-4">
            <div className="text-center space-y-4">
              <div>
                <h3 className="font-medium mb-2">Connect Your Device</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {deviceType === 'pc' 
                    ? 'Share this link with your mobile device to receive audio'
                    : 'Open the shared link from your PC to establish connection'
                  }
                </p>
              </div>
              
              {/* QR Code Toggle */}
              <div className="space-y-3">
                <Button
                  variant="outline"
                  onClick={() => setShowQR(!showQR)}
                  className="w-full"
                >
                  <QrCode className="w-4 h-4 mr-2" />
                  {showQR ? 'Hide QR Code' : 'Show QR Code'}
                </Button>
                
                {showQR && (
                  <div className="flex justify-center p-4 bg-muted/20 rounded-lg">
                    <QRCodeGenerator 
                      value={window.location.href} 
                      size={180}
                    />
                  </div>
                )}
                
                {/* URL Copy */}
                <Button
                  variant="outline"
                  onClick={copyConnectionUrl}
                  className="w-full"
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
            </div>
          </Card>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="audio-card p-4 text-center">
            <div className="text-2xl font-bold text-primary">
              {isStreaming ? '24bit' : '---'}
            </div>
            <div className="text-xs text-muted-foreground">Quality</div>
          </Card>
          <Card className="audio-card p-4 text-center">
            <div className="text-2xl font-bold text-secondary">
              {isStreaming ? '48kHz' : '---'}
            </div>
            <div className="text-xs text-muted-foreground">Sample Rate</div>
          </Card>
        </div>
      </div>
    </div>
  );
};