import './App.css'

import SwimLanesViewer from './SwimLanesViewer'
import { generatedEdges, genereatedNodes } from './data'
import ProcessExtractor from './pages/ProcessExtractor'

function App() {
  return (
    <>
      <div className='flex justify-center'>
        <ProcessExtractor />
        <SwimLanesViewer initialNodes={genereatedNodes} initialEdges={generatedEdges}/>
      </div>
    </>
  )
}

export default App
