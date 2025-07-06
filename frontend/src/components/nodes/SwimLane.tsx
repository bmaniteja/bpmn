import { memo } from 'react';

export default memo(({ data, ...rest }: { data: any, isConnectable: boolean }) => {
  return (
    <>
      <div style={{
        height: `100%`,
        border: '1px solid rgba(255,255,255,0.7)',
        borderRadius: '5px',
        background: 'rgba(255,255,255,0.3)',
        lineHeight: '50px',
      }}>
        <div style={{
          width: '100px',
          backgroundColor: 'black',
          fontSize: '10px',
          height: '20px',
          lineHeight: '20px',
          transform: 'translate(-39px, -41px)',
          rotate: '-90deg',
          borderRadius: '5px 5px 0px 0px',
          border: '1px solid black'
        }}>{data.label}</div>
      </div>
    </>
  );
});