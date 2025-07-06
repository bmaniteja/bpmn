import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
 
export default memo(({isConnectable }: { data: any, isConnectable: boolean }) => {
  return (
    <>
      <div style={{
        width: '50px',
        height: '50px',
        border: '1px solid transparent',
        borderRadius: '25px',
        background: 'black',
        lineHeight: '50px'
      }}>
        <p style={{
          fontSize:"10px",
          margin: '0px'
        }}>Start</p>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        isConnectable={isConnectable}
      />
    </>
  );
});