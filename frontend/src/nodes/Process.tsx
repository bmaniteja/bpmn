import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

export default memo(({ data, isConnectable }: { data: any, isConnectable: boolean }) => {
  return (
    <>
      <Handle
        type="target"
        position={Position.Left}
        isConnectable={isConnectable}
      />
      <div style={{
        width: '90px',
        height: '50px',
        border: '1px solid transparent',
        borderRadius: '5px',
        background: 'black',
        lineHeight: '50px'
      }}>
        <p style={{
          fontSize:"10px",
          margin: '0px'
        }}>{data.label}</p>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        isConnectable={isConnectable}
      />
    </>
  );
});