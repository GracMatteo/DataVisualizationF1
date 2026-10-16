import { useState } from 'react'
import LogoF1 from './assets/f1.svg?react';
import './App.css'

function App() {
  return (
    <>
      <div id="headerPage">
        <h1>Data visualization F1</h1>
        <LogoF1 className="icon" width="200" height="200">
        </LogoF1>
      </div>
    </>
  )
}

export default App
