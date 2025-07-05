import clsx from 'clsx';
import React, { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { MagicWandIcon, CheckCircledIcon } from '@radix-ui/react-icons';
import { Loader2Icon, type LucideProps } from "lucide-react";
import { Alert } from '@/components/ui/alert';
import type { IconProps } from '@radix-ui/react-icons/dist/types';
interface ProcessExtractionPageProps {
  socketUrl?: string;
  className?: string;
  setData: any
}

interface ExtractionState {
  status: 'connecting' | 'idle' | 'thinking' | 'extracting' | 'validating' | 'complete' | 'error';
  action?: string;
  loading: boolean;
  error: string | null;
  Icon?: any
}

const palceHolder = `Describe your business process or feature... 

Example: 'Users can submit purchase orders which need approval from their manager. If the amount is over $5000, it also requires finance team approval before being processed.'`;

const ProcessExtractor: React.FC<ProcessExtractionPageProps> = ({
  socketUrl = 'ws://localhost:3000',
  className = '',
  setData
}) => {
  const [featureDescription, setFeatureDescription] = useState('');
  const [extractionState, setExtractionState] = useState<ExtractionState>({
    status: 'connecting',
    loading: false,
    error: null,
    action: 'Connecting',
    Icon: () => <Loader2Icon className="animate-spin" />
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
    // simulate some delay
    setTimeout(() => {
      setExtractionState({
        status: 'idle',
        loading: false,
        error: null,
        action: 'Conencted & Waiting',
        Icon: () => <CheckCircledIcon />
      })
    }, 1000)
    const socket = socketRef.current;
    socket.on('agent:status', (status: { status: string; action?: string }) => {
      // @ts-expect-error
      setExtractionState(prev => ({
        ...prev,
        status: status.status as any,
        action: status.action,
        loading: status.status !== 'complete' && status.status !== 'error',
        Icon: () => "🤔"
      }));
    });
    socket.on('agent:error', (error: { message: string; timestamp: string }) => {
      setExtractionState(prev => ({
        ...prev,
        status: 'error',
        loading: false,
        error: error.message,
      }));
    });
    socket.on('process:extracted', (data) => {
      console.log(data);
      setData({
        initialNodes: data.processData.nodes.map((node: any) => {
          if (node.type === 'swimLaneNode') {
            node.style = { width: 200, height: 100 } // default height and width
          }
          return node;
        }),
        initialEdges: data.processData.edges
      });
      setTimeout(() => {
        setExtractionState({
        status: 'complete',
        loading: false,
        error: null,
        action: 'Conencted & Waiting',
        Icon: () => <CheckCircledIcon />
      })
      }, 10);
    });
  };

  const startExtraction = () => {
    if (!socketRef.current) return;
    const socket = socketRef.current;

    socket.emit('process:extract', {
      sessionId,
      featureDescription
    })
  }

  return (<>
    <div className={clsx(className, 'p-4 lg:flex-1/4 flex flex-col')}>
      <Alert className='items-center content-center mb-5'>
        {extractionState.Icon && <extractionState.Icon />}{`${extractionState.action}`}
      </Alert>
      <Textarea name='featureDescription' className='mb-4' placeholder={palceHolder} value={featureDescription} onChange={(e) => setFeatureDescription(e.target.value)}></Textarea>
      <Button disabled={extractionState.status === 'connecting'} variant={'outline'} onClick={startExtraction} className='cursor-pointer hover:text-black hover:bg-white'> <MagicWandIcon /> Generate</Button>
    </div>
  </>);
}

export default ProcessExtractor;