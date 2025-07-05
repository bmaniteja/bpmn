import { useEffect, useState } from 'react';
import './App.css'

import SwimLanesViewer from './SwimLanesViewer'
import { generatedEdges, genereatedNodes } from './data'
import ProcessExtractor from './pages/ProcessExtractor'

function App() {

  const [data, setData] = useState<any>({
    initialNodes:[],
    initialEdges:[]
  });

  useEffect(()=> {
      setData({
        initialNodes: genereatedNodes,
        initialEdges: generatedEdges
      })
  }, []);

  return (
    <>
      <div className='flex lg:flex-row justify-center flex-col-reverse h-dvh'>
        <ProcessExtractor />
        <SwimLanesViewer initialNodes={data.initialNodes} initialEdges={data.initialEdges}/>
      </div>
    </>
  )
}

export default App
