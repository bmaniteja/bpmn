import clsx from 'clsx';
import React, { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {MagicWandIcon, DiscIcon } from '@radix-ui/react-icons'
interface ProcessExtractionPageProps {
  socketUrl?: string;
  className?: string;
}

interface ExtractionState {
  status: 'connected' | 'idle' | 'thinking' | 'extracting' | 'validating' | 'complete' | 'error';
  action?: string;
  loading: boolean;
  error: string | null;
}

const palceHolder = `Describe your business process or feature... 

Example: 'Users can submit purchase orders which need approval from their manager. If the amount is over $5000, it also requires finance team approval before being processed.'`;

const ProcessExtractor: React.FC<ProcessExtractionPageProps> = ({
  socketUrl = 'ws://localhost:3000',
  className = '',
}) => {
  const [extractionState, setExtractionState] = useState<ExtractionState>({
    status: 'idle',
    loading: false,
    error: null,
  });
  const socketRef = useRef<Socket | null>(null);
  const sessionId = useRef<string>(`session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    // Initialize socket connection
    socketRef.current = io(socketUrl);

    // Set up socket event listeners
    setupSocketListeners();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [socketUrl]);

  const setupSocketListeners = () => {
    if (!socketRef.current) return;

    const socket = socketRef.current;
    socket.on('process:extracted', (data) => { console.log(data); });
  };

  const startExtraction = (message: string) => {
    if (!socketRef.current) return;
    const socket = socketRef.current;

    socket.emit('process:extract', {
      sessionId,
      featureDescription: message
    })
  }

  return (<>
    <div className={clsx(className, 'w-1/5 p-4')}>
      <Textarea className='mb-4' placeholder={palceHolder}></Textarea>
      <Button variant={'outline'} onClick={() => { }} className='mr-2 cursor-pointer hover:text-black hover:bg-white'> <DiscIcon /> Load Mock</Button>
      <Button variant={'outline'} onClick={() => { }} className='cursor-pointer hover:text-black hover:bg-white'> <MagicWandIcon /> Generate</Button>
    </div>
  </>);
}

export default ProcessExtractor;