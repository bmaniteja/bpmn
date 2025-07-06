import { useEffect, useState } from 'react';
import './App.css'
import './styles/styles.global.css'

import SwimLanesViewer from './SwimLanesViewer'
import { generatedEdges, genereatedNodes } from './data'
import ProcessExtractor from './pages/ProcessExtractor'

function App() {

  const [data, setData] = useState<any>({
    initialNodes: [],
    initialEdges: [],
    isMock: true
  });

  useEffect(() => {
    setData({
      initialNodes: genereatedNodes,
      initialEdges: generatedEdges,
      isMock: true
    })
  }, []);

  return (
    <>
      <div className='flex lg:flex-row justify-center flex-col-reverse h-dvh'>
        <ProcessExtractor setData={setData}/>
        <SwimLanesViewer initialNodes={data.initialNodes} initialEdges={data.initialEdges} isMock={data.isMock}/>
      </div>
    </>
  )
}

export default App
