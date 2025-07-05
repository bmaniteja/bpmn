import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

export default memo(({ data, isConnectable }: { data: any, isConnectable: boolean }) => {
  return (
    <>
      <Handle
        type="target"
        position={Position.Left}
        isConnectable={isConnectable}
        style={{
          zIndex: '1',
          transform: 'translate(5px, -20px)'
        }}
      />
        <div style={{
          width: '50px',
          height: '50px',
          border: '1px solid transparent',
          borderRadius: '5px',
          background: 'black',
          rotate: '45deg',
          transform: 'translate(0%, -50%)'
        }}>
          <p style={{ rotate: '-45deg', height: '50px', width: '50px', fontSize: '10px' }}>{data.label}</p>
        </div>
      <Handle
        type="source"
        position={Position.Right}
        isConnectable={isConnectable}
        style={{
          zIndex: '1',
          transform: 'translate(30px, -20px)'
        }}
      />
    </>
  );
});